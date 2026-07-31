// Descobre, pela descricao da nota, quanto vem em cada embalagem.
//
// A nota diz "ZAPP QI 620 20 L BRA" e cobra por balde. O estoque controla em
// litros. Alguem precisa saber que cada balde tem 20 L - e essa informacao ja
// esta escrita ali, so nao em campo proprio.
//
// A armadilha: nem todo numero e embalagem. Em "ZAPP QI 620" o 620 e a
// concentracao em g/L; em "SUMYZIN 500 SC" o 500 tambem. Ler o primeiro numero
// faria o fator sair 620 em vez de 20, e o custo por litro errar por 30 vezes.
//
// Por isso a leitura e conservadora: na duvida, nao adivinha. Fator errado
// contamina o custo de toda pulverizacao daquele produto, para sempre.

/**
 * Codigos de formulacao que aparecem DEPOIS da concentracao.
 * "620 SL", "500 SC", "200 EC" - o numero ali e concentracao, nao embalagem.
 */
const FORMULACOES =
  "SL|SC|EC|WG|WP|CS|SE|EW|ME|OD|ZC|SG|DF|FS|TS|WS|GR|SP|EO|UL|AL";

/** Quanto cada unidade vale na unidade base (litro ou quilo). */
const EQUIVALENCIA: Record<string, { base: "L" | "KG"; fator: number }> = {
  L: { base: "L", fator: 1 },
  LT: { base: "L", fator: 1 },
  LTS: { base: "L", fator: 1 },
  LITRO: { base: "L", fator: 1 },
  LITROS: { base: "L", fator: 1 },
  ML: { base: "L", fator: 0.001 },
  KG: { base: "KG", fator: 1 },
  KGS: { base: "KG", fator: 1 },
  QUILO: { base: "KG", fator: 1 },
  G: { base: "KG", fator: 0.001 },
  GR: { base: "KG", fator: 0.001 },
  GRS: { base: "KG", fator: 0.001 },
  GRAMA: { base: "KG", fator: 0.001 },
  GRAMAS: { base: "KG", fator: 0.001 },
};

export interface Embalagem {
  /** Quanto vem na embalagem, na base (litros ou quilos). */
  quantidade: number;
  base: "L" | "KG";
  /** Trecho da descricao que gerou a leitura - o gestor confere de onde veio. */
  trecho: string;
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

function converter(valorTexto: string, unidade: string, trecho: string): Embalagem | null {
  const eq = EQUIVALENCIA[unidade];
  if (!eq) return null;
  const valor = Number(valorTexto.replace(",", "."));
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const quantidade = valor * eq.fator;
  // Embalagem de 5 toneladas ou de 1 mililitro nao existe em insumo agricola:
  // numero fora dessa faixa quase certamente e outra coisa.
  if (quantidade < 0.01 || quantidade > 2000) return null;
  return { quantidade: Math.round(quantidade * 1000) / 1000, base: eq.base, trecho };
}

/**
 * Le a descricao e devolve a embalagem, quando da para afirmar.
 *
 * Devolve null de proposito quando a descricao nao diz - e melhor o gestor
 * digitar do que o sistema chutar um numero que vira custo errado.
 */
export function lerEmbalagem(descricao: string): Embalagem | null {
  const d = normalizar(descricao);
  const UNI = Object.keys(EQUIVALENCIA).sort((a, b) => b.length - a.length).join("|");

  // 1. "1X20L", "2 X 5 KG" - o segundo numero e o conteudo de cada embalagem.
  const multiplo = d.match(new RegExp(`\\d+\\s*X\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNI})\\b`));
  if (multiplo) {
    const r = converter(multiplo[1], multiplo[2], multiplo[0]);
    if (r) return r;
  }

  // 2. Dentro de parenteses: "(20 LT)", "(250 GR)". E onde o fornecedor
  //    costuma pos a embalagem, entao e a leitura mais confiavel.
  for (const grupo of d.match(/\([^)]*\)/g) ?? []) {
    const m = grupo.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNI})\\b`));
    if (m) {
      const r = converter(m[1], m[2], grupo);
      if (r) return r;
    }
    // "(LT)" sozinho: a embalagem e de um litro.
    const sozinha = grupo.match(new RegExp(`^\\(\\s*(${UNI})\\s*\\)$`));
    if (sozinha) {
      const r = converter("1", sozinha[1], grupo);
      if (r) return r;
    }
  }

  // 3. Fora de parenteses, ignorando o que for concentracao.
  const solto = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNI})\\b(?!\\s*(?:${FORMULACOES})\\b)`, "g");
  const candidatos: Embalagem[] = [];
  for (const m of d.matchAll(solto)) {
    // Numero seguido de codigo de formulacao e concentracao: "620 SL".
    const depois = d.slice(m.index! + m[0].length).trimStart();
    if (new RegExp(`^(?:${FORMULACOES})\\b`).test(depois)) continue;
    const r = converter(m[1], m[2], m[0].trim());
    if (r) candidatos.push(r);
  }
  // O ultimo e o mais provavel: nome e concentracao vem antes, embalagem no fim.
  if (candidatos.length) return candidatos[candidatos.length - 1];

  return null;
}

/**
 * Sugere o nome do produto, tirando o que e embalagem.
 *
 * Sugestao mesmo - o gestor edita. Separar nome comercial de principio ativo e
 * de marca nao tem regra confiavel, e errar o nome e barato de corrigir; errar
 * calado, nao.
 */
export function sugerirNome(descricao: string): string {
  let nome = descricao;

  // Tira exatamente o trecho que foi reconhecido como embalagem. Usar a
  // mesma leitura evita que nome e fator discordem sobre o que era embalagem.
  const emb = lerEmbalagem(descricao);
  if (emb) {
    const i = nome.toUpperCase().indexOf(emb.trecho.toUpperCase());
    if (i >= 0) nome = nome.slice(0, i) + " " + nome.slice(i + emb.trecho.length);
  }

  nome = nome
    // parenteses que sobraram so com unidade: "(BD)", "(UN)"
    .replace(/\(\s*(?:L|LT|LTS|ML|KG|G|GR|GRS|BD|CX|UN|SC|FR)\s*\)/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/[\s|,-]+$/, "")
    .trim();

  return nome || descricao.trim();
}
