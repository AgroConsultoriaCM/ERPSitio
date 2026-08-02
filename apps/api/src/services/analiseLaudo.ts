/**
 * Leitor dos laudos de laboratorio (planilha).
 *
 * Recebe a planilha ja aberta, como matriz de celulas, e devolve as amostras.
 * Nao depende de biblioteca de xlsx: quem abre o arquivo passa a matriz. Isso
 * deixa a parte dificil - achar o cabecalho, casar coluna com nutriente,
 * separar amostra de rodape - testavel sem abrir arquivo nenhum, e permite
 * rodar o mesmo codigo no navegador e no servidor.
 *
 * POR QUE PLANILHA E NAO PDF: o mesmo laudo, nos dois formatos, nao tem a
 * mesma precisao. No PDF o pH sai "5,7"; na planilha, 5.650000095367432. O PDF
 * ja vem arredondado pelo laboratorio, e ainda embola cabecalho e quebra numero
 * entre linhas. Planilha e a fonte; PDF serve de anexo.
 *
 * SAO CINCO LAUDOS DIFERENTES, com colunas, cabecalho em linha diferente e
 * ate nome de aba diferente:
 *   QUIMICA  - pH, M.O., P, S, Ca, Mg, Na, K, Al, H+Al, SB, CTC, V%, m%
 *   FISICA   - argila, silte, areia e fracoes (nao muda com o tempo)
 *   MICRO    - boro, cobre, ferro, manganes, zinco
 *   FOLIAR   - tecido vegetal: N, P, K, Ca, Mg, S, B, Cu, Fe, Mn, Zn, Si
 *   ORGANICO - composto/esterco: %MO, %CO, %N, %P2O5, %K2O... (nao e solo)
 *
 * Provado contra os 13 laudos reais do sitio: 33 amostras, todas as colunas
 * com numero reconhecidas. Ver verificacoes/analise-laudo.mts.
 */

export type TipoLaudo = "QUIMICA" | "FISICA" | "MICRO" | "FOLIAR" | "ORGANICO";

/** Celula crua da planilha: numero, texto, data ou vazio. */
export type Celula = string | number | Date | null | undefined;
export type Planilha = Celula[][];

export interface AmostraLida {
  /** Codigo do laboratorio, ex "S26/89869". Identifica a amostra no laudo. */
  codigoLaboratorio: string | null;
  /** Como VOCE identificou a amostra na coleta: "LIMAO NOVO", "SACOLA AMARELA". */
  identificacao: string | null;
  propriedade: string | null;
  profundidade: string | null;
  /** Nutriente -> valor. Chaves conforme o tipo do laudo. */
  valores: Record<string, number>;
  /** Colunas que vieram no laudo mas nao foram reconhecidas. */
  naoReconhecidas: string[];
}

export interface LaudoLido {
  tipo: TipoLaudo;
  cliente: string | null;
  material: string | null;
  dataColeta: Date | null;
  amostras: AmostraLida[];
}

export class LaudoInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "LaudoInvalidoError";
  }
}

/** Texto da celula, sem acento, espaco duplicado nem caixa. */
function normalizar(v: Celula): string {
  if (v == null) return "";
  return String(v)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function texto(v: Celula): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s === "-" ? null : s;
}

/**
 * Numero da celula.
 *
 * O laboratorio usa "-" para nao analisado e "ns" para nao solicitado. Os dois
 * viram ausencia, nao zero: zero e um resultado, ausencia e a falta dele, e
 * confundir os dois estragaria qualquer media depois.
 */
function numero(v: Celula): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === "" || s === "-" || /^n\.?s\.?$/i.test(s) || /^<?\s*lq$/i.test(s)) return null;
  // Planilha brasileira as vezes traz "5,65" como texto.
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Cabecalho -> chave interna.
 *
 * Casa por TEXTO, nao por posicao: a posicao da coluna muda entre laboratorios
 * e entre versoes do mesmo laudo; o texto nao.
 *
 * A ORDEM IMPORTA. Como o rotulo de uma coluna e a juncao das linhas de
 * cabecalho (ver montarRotulos), ele costuma vir com sobra: a coluna da argila
 * chega como "ANALISE FISICA DO SOLO ARGILA". Por isso os padroes nao sao
 * ancorados no comeco - e por isso o mais especifico tem de ser testado antes
 * do mais generico, senao "ARGILA DISPERSA EM AGUA" cairia em "argila" e o
 * teor de argila do talhao ficaria errado.
 */
const MAPA_COLUNAS: { chave: string; padrao: RegExp }[] = [
  // --- organico: testado primeiro porque usa "%" e nao colide com os demais
  { chave: "materiaOrganica", padrao: /%\s?MO\b/ },
  { chave: "carbonoOrganico", padrao: /%\s?CO\b/ },
  { chave: "nitrogenio", padrao: /%\s?N\b/ },
  { chave: "p2o5Total", padrao: /%\s?P2O5\s?\(\s?TOTAL/ },
  { chave: "p2o5Ac", padrao: /%\s?P2O5\s?\(\s?AC/ },
  { chave: "p2o5Agua", padrao: /%\s?P2O5\s?\(\s?H2O/ },
  { chave: "k2o", padrao: /%\s?K2O\b/ },
  { chave: "umidade", padrao: /%\s?UMIDADE/ },
  { chave: "relacaoCN", padrao: /RELACAO\s?C\s?\/\s?N/ },
  { chave: "calcio", padrao: /%\s?CA\b/ },
  { chave: "magnesio", padrao: /%\s?MG\b/ },
  { chave: "enxofre", padrao: /%\s?S\b/ },
  { chave: "boro", padrao: /%\s?B\b/ },
  { chave: "cobre", padrao: /%\s?CU\b/ },
  { chave: "ferro", padrao: /%\s?FE\b/ },
  { chave: "manganes", padrao: /%\s?MN\b/ },
  { chave: "zinco", padrao: /%\s?ZN\b/ },

  // --- fisica: "argila dispersa" antes de "argila", "fracao" antes de "total"
  { chave: "argilaDispersaAgua", padrao: /ARGILA\s?DISPERSA/ },
  { chave: "grauFloculacao", padrao: /GRAU\s?DE\s?FLOCULACAO/ },
  { chave: "grauDispersao", padrao: /GRAU\s?DE\s?DISPERSAO/ },
  { chave: "areiaMuitoGrossa", padrao: /\bAMG\b/ },
  { chave: "areiaMuitoFina", padrao: /\bAMF\b/ },
  { chave: "areiaGrossa", padrao: /\bAG\b/ },
  { chave: "areiaMedia", padrao: /\bAM\b/ },
  { chave: "areiaFina", padrao: /\bAF\b/ },
  { chave: "areiaTotal", padrao: /AREIA\s?TOTAL/ },
  { chave: "argila", padrao: /\bARGILA\b/ },
  { chave: "silte", padrao: /\bSILTE\b/ },

  // --- quimica: compostos antes dos simbolos de uma letra
  { chave: "saturacaoBases", padrao: /SAT.*BASES|\bV\s?%/ },
  { chave: "saturacaoAluminio", padrao: /SAT.*\bAL\b|\bM\s?%/ },
  { chave: "somaBases", padrao: /SOMA\s?BASES|\bS\.?\s?B\.?\b/ },
  { chave: "hAl", padrao: /\bH\s?\+\s?AL\b/ },
  { chave: "materiaOrganica", padrao: /\bM\.?\s?O\.?\b/ },
  { chave: "ctc", padrao: /\bCTC\b/ },
  { chave: "ph", padrao: /\bPH\b/ },
  // Simbolos de uma ou duas letras: ancorados no COMECO, com limite de palavra
  // no fim. O rotulo real vem com a unidade colada - "P -----------mg dm-3" -
  // entao ancorar tambem no fim descartaria a coluna. E o limite de palavra e
  // o que impede "P" de casar com "PROPRIEDADE" ou "PH".
  { chave: "aluminio", padrao: /^AL\b/ },
  { chave: "calcio", padrao: /^CA\b/ },
  { chave: "magnesio", padrao: /^MG\b/ },
  { chave: "sodio", padrao: /^NA\b/ },
  { chave: "nitrogenio", padrao: /^N\b/ },
  { chave: "potassio", padrao: /^K\b/ },
  { chave: "fosforo", padrao: /^P\b/ },
  { chave: "enxofre", padrao: /^S\b/ },
  { chave: "silicio", padrao: /^SI\b/ },

  // --- micro e foliar (nomes por extenso; os simbolos caem logo abaixo)
  { chave: "boro", padrao: /\bBORO\b|^B\b/ },
  { chave: "cobre", padrao: /\bCOBRE\b|^CU\b/ },
  { chave: "ferro", padrao: /\bFERRO\b|^FE\b/ },
  { chave: "manganes", padrao: /\bMANGANES\b|^MN\b/ },
  { chave: "zinco", padrao: /\bZINCO\b|^ZN\b/ },
];

export type PapelColuna =
  | { papel: "propriedade" }
  | { papel: "identificacao" }
  | { papel: "profundidade" }
  | { papel: "ignorar" }
  | { papel: "valor"; chave: string }
  | null;

/**
 * O que a coluna significa.
 *
 * Identificacao vem antes de nutriente porque o rotulo juntado costuma ter as
 * duas coisas: no laudo de micro, a coluna do talhao chega como
 * "IDENTIFICACOES DO CLIENTE TALHAO".
 */
export function classificarColuna(rotulo: string): PapelColuna {
  if (!rotulo) return null;
  // "ID 1", "ID 2", "ID 3": o laudo de folha reparte a identificacao em tres
  // colunas ("1 | Limao | Geada"). Todas contam como identificacao e sao
  // juntadas depois - ficar so com a primeira daria "1", que nao diz nada.
  if (/\bTALHAO\b|^ID\b/.test(rotulo)) return { papel: "identificacao" };
  if (/\bPROPRIEDADE\b/.test(rotulo)) return { papel: "propriedade" };
  if (/\bPROF\b|\bPROFUNDIDADE\b/.test(rotulo)) return { papel: "profundidade" };
  if (/LABORAT|^N.?\s?LAB\.?$|^LAB\.?$|\bGRID\b|\bCLIENTE\b/.test(rotulo)) {
    return { papel: "ignorar" };
  }
  for (const { chave, padrao } of MAPA_COLUNAS) {
    if (padrao.test(rotulo)) return { papel: "valor", chave };
  }
  return null;
}

/**
 * Que laudo e este.
 *
 * A ORDEM IMPORTA: o laudo de folha se chama "ANALISE QUIMICA DE MATERIAL
 * VEGETAL" e cairia em QUIMICA se testado depois - e viraria analise de solo,
 * com valores de folha. Por isso FOLIAR e testado antes.
 */
export function detectarTipo(planilha: Planilha): TipoLaudo | null {
  const todo = planilha
    .slice(0, 20)
    .map((l) => l.map(normalizar).join(" "))
    .join(" ");
  if (/ANALISE FISICA|AREIA TOTAL/.test(todo)) return "FISICA";
  if (/%MO|%P2O5|ORGANICO SOLIDO/.test(todo)) return "ORGANICO";
  if (/TECIDO VEGETAL|MATERIAL VEGETAL|MATERIAL:? TV\b/.test(todo)) return "FOLIAR";
  if (/BORO.*COBRE|MANGANES.*ZINCO/.test(todo)) return "MICRO";
  if (/\bCTC\b|SOMA BASES|H \+ AL|H\+AL/.test(todo)) return "QUIMICA";
  return null;
}

/** Codigo de amostra do laboratorio: "S26/89869", "FC25/13633", "LS4636". */
const CODIGO_AMOSTRA = /^[A-Z]{1,3}\d{2}\/\d+$|^[A-Z]{2}\d{3,}$/;

/**
 * A coluna do codigo do laboratorio varia: na quimica e a 0, na fisica e a 1.
 * Por isso procura nas primeiras colunas em vez de fixar a posicao.
 */
function colunaDoCodigo(linha: Celula[]): number {
  for (let c = 0; c < Math.min(3, linha.length); c++) {
    if (CODIGO_AMOSTRA.test(normalizar(linha[c]))) return c;
  }
  return -1;
}

function pareceLinhaDeAmostra(linha: Celula[]): boolean {
  return colunaDoCodigo(linha) >= 0;
}

/**
 * Monta o rotulo de cada coluna JUNTANDO as linhas de cabecalho.
 *
 * Os laudos trazem o cabecalho repartido em duas ou tres linhas, com celulas
 * mescladas, e as partes se completam: na quimica, a coluna 14 e "H+Al" em
 * cima e "SMP" embaixo; a 17 e "Sat." em cima e "Bases" embaixo. Ficar so com
 * uma das linhas perderia o sentido - "Sat." sozinho nao diz se e saturacao
 * por bases ou por aluminio, que sao colunas vizinhas e valores diferentes.
 */
export function montarRotulos(planilha: Planilha, linhasCabecalho: number[]): string[] {
  const largura = Math.max(...linhasCabecalho.map((i) => planilha[i]?.length ?? 0), 0);
  const rotulos: string[] = [];
  for (let c = 0; c < largura; c++) {
    const partes = linhasCabecalho
      .map((i) => normalizar(planilha[i]?.[c]))
      .filter((v) => v.length > 0);
    rotulos[c] = [...new Set(partes)].join(" ");
  }
  return rotulos;
}

/**
 * Uma linha e cabecalho quando traz pelo menos duas colunas reconheciveis.
 *
 * Isso separa o cabecalho de verdade das linhas de identificacao do laudo
 * ("Nome: Igor | Material: Solo"), que ficam logo acima e tem cara de tabela.
 * Sem esse filtro, "Material:" era lido como rotulo da coluna do talhao e a
 * identificacao da amostra sumia.
 */
export function pareceCabecalho(linha: Celula[]): boolean {
  let reconhecidas = 0;
  for (const celula of linha) {
    const papel = classificarColuna(normalizar(celula));
    if (papel) reconhecidas++;
    if (reconhecidas >= 2) return true;
  }
  return false;
}

function comoData(valor: Celula): Date | null {
  if (valor instanceof Date) return valor;
  const s = texto(valor);
  if (!s) return null;
  // "8/5/2026 até 18/5/2026" -> fica com a primeira, que e o inicio do ensaio.
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

/**
 * Data de recebimento da amostra - a mais proxima da coleta que o laudo traz.
 *
 * O valor nao fica ao lado do rotulo: nestes laudos o rotulo cai numa celula e
 * a data aparece tres ou mais colunas adiante, porque a planilha usa celulas
 * mescladas para alinhar o cabecalho. Por isso varre a linha inteira a direita
 * do rotulo, em vez de olhar so a celula seguinte.
 */
export function acharData(planilha: Planilha): Date | null {
  const alvos = [/DATA D[OE] RECEBIMENTO/, /RECEBIMENTO/, /REALIZACAO DOS ENSAIOS/];
  for (const alvo of alvos) {
    for (let l = 0; l < Math.min(15, planilha.length); l++) {
      const linha = planilha[l] ?? [];
      for (let c = 0; c < linha.length; c++) {
        if (!alvo.test(normalizar(linha[c]))) continue;
        for (let d = c + 1; d < linha.length; d++) {
          const data = comoData(linha[d]);
          if (data) return data;
        }
        // Alguns laudos poem a data na linha de baixo, na mesma coluna.
        for (let d = c; d < (planilha[l + 1]?.length ?? 0); d++) {
          const data = comoData(planilha[l + 1]?.[d]);
          if (data) return data;
        }
      }
    }
  }
  return null;
}

function acharCampo(planilha: Planilha, padrao: RegExp): string | null {
  for (const linha of planilha.slice(0, 12)) {
    for (let c = 0; c < linha.length; c++) {
      if (padrao.test(normalizar(linha[c]))) {
        for (let d = c + 1; d < Math.min(c + 3, linha.length); d++) {
          const v = texto(linha[d]);
          if (v) return v;
        }
      }
    }
  }
  return null;
}

export function lerLaudo(planilha: Planilha): LaudoLido {
  const tipo = detectarTipo(planilha);
  if (!tipo) {
    throw new LaudoInvalidoError(
      "Não reconheci este arquivo como laudo de análise. Confira se enviou a planilha do laboratório.",
    );
  }

  // A primeira linha de amostra delimita onde o cabecalho termina.
  const primeiraAmostra = planilha.findIndex(pareceLinhaDeAmostra);
  if (primeiraAmostra < 0) {
    throw new LaudoInvalidoError("O laudo foi reconhecido, mas não encontrei nenhuma amostra nele.");
  }

  // Cabecalho: entre as linhas acima da amostra, so as que parecem cabecalho.
  // Olha ate 5 acima porque a distancia varia por tipo de laudo (a quimica tem
  // uma linha em branco no meio do proprio cabecalho).
  const linhasCabecalho: number[] = [];
  for (let i = Math.max(0, primeiraAmostra - 5); i < primeiraAmostra; i++) {
    if (pareceCabecalho(planilha[i] ?? [])) linhasCabecalho.push(i);
  }
  if (linhasCabecalho.length === 0) {
    throw new LaudoInvalidoError(
      "Encontrei as amostras, mas não reconheci o cabeçalho com o nome dos nutrientes.",
    );
  }
  const rotulos = montarRotulos(planilha, linhasCabecalho);

  const amostras: AmostraLida[] = [];
  for (let i = primeiraAmostra; i < planilha.length; i++) {
    const linha = planilha[i];
    if (!pareceLinhaDeAmostra(linha)) {
      // Rodape (metodologia, assinatura) encerra a lista. Parar na primeira
      // linha que nao e amostra evita ler observacao como se fosse dado.
      if (amostras.length > 0) break;
      continue;
    }

    const valores: Record<string, number> = {};
    const naoReconhecidas: string[] = [];
    const partesIdentificacao: string[] = [];
    let propriedade: string | null = null;
    let profundidade: string | null = null;

    for (let c = 0; c < linha.length; c++) {
      const rotulo = rotulos[c] ?? "";
      if (!rotulo) continue;

      const papel = classificarColuna(rotulo);
      if (papel?.papel === "propriedade") {
        propriedade = propriedade ?? texto(linha[c]);
        continue;
      }
      if (papel?.papel === "identificacao") {
        const v = texto(linha[c]);
        if (v) partesIdentificacao.push(v);
        continue;
      }
      if (papel?.papel === "profundidade") {
        profundidade = profundidade ?? texto(linha[c]);
        continue;
      }
      if (papel?.papel === "ignorar") continue;

      const n = numero(linha[c]);
      if (papel?.papel === "valor") {
        if (n != null) valores[papel.chave] = n;
      } else if (n != null) {
        // Coluna com numero que nao soubemos nomear: avisa em vez de descartar
        // calado. Laudo novo com coluna nova aparece aqui, e o usuario ve.
        naoReconhecidas.push(rotulo);
      }
    }

    const colCodigo = colunaDoCodigo(linha);
    amostras.push({
      codigoLaboratorio: colCodigo >= 0 ? texto(linha[colCodigo]) : null,
      identificacao: partesIdentificacao.length > 0 ? partesIdentificacao.join(" · ") : null,
      propriedade,
      profundidade,
      valores,
      naoReconhecidas,
    });
  }

  return {
    tipo,
    cliente: acharCampo(planilha, /^(NOME|CLIENTE):?$/),
    material: acharCampo(planilha, /^MATERIAL:?$/),
    dataColeta: acharData(planilha),
    amostras,
  };
}
