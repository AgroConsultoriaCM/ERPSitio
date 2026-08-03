import { env } from "../env.js";
import { AppError } from "../lib/errors.js";

/**
 * Consulta ao Agrofit — o cadastro oficial do MAPA de agrotoxicos e afins.
 *
 * Serve para responder, no momento da aplicacao, uma pergunta que hoje o
 * sistema nao sabe responder: *este produto esta registrado para esta cultura
 * e para esta praga?* Aplicar produto sem registro para a cultura e infracao,
 * derruba certificacao e pode gerar residuo acima do limite.
 *
 * Fonte: API Agrofit, da plataforma AgroAPI (Embrapa Agricultura Digital).
 * Plano "Gratuito100KPorMes": 100 mil requisicoes por mes, sem custo.
 *
 * As credenciais NUNCA saem do servidor. O navegador fala com a nossa API, que
 * fala com a Embrapa — assim a chave nao vai parar no aparelho do encarregado.
 */

const BASE = "https://api.cnptia.embrapa.br/agrofit/v1";
const URL_TOKEN = "https://api.cnptia.embrapa.br/token";

/**
 * Formato de verdade da resposta — medido em 01/08/2026 batendo direto na
 * API. Vem em snake_case, nao no camelCase que se esperaria de um JSON
 * moderno. `classe_categoria_agronomica` e o campo que diz se e inseticida,
 * fungicida etc — e o que alimenta a sugestao de Função na nota fiscal.
 */
export interface ProdutoAgrofit {
  numero_registro?: string;
  marca_comercial?: string[];
  titular_registro?: string;
  produto_biologico?: boolean;
  classe_categoria_agronomica?: string[];
  formulacao?: string;
  ingrediente_ativo?: string[];
  modo_acao?: string[];
  classificacao_toxicologica?: string;
  classificacao_ambiental?: string;
  produto_agricultura_organica?: boolean;
  [k: string]: unknown;
}

export function agrofitConfigurado(): boolean {
  return !!env.AGROFIT_CONSUMER_KEY && !!env.AGROFIT_CONSUMER_SECRET;
}

// O token da AgroAPI vale muito tempo, mas nao se guarda em disco: se a API
// reiniciar, pede outro. Um a menos e barato; um vazado, nao.
let token: { valor: string; expiraEm: number } | null = null;

async function obterToken(): Promise<string> {
  if (token && Date.now() < token.expiraEm) return token.valor;

  if (!agrofitConfigurado()) {
    throw new AppError(
      "Consulta ao Agrofit indisponível: credenciais não configuradas no servidor.",
      503,
    );
  }

  const basico = Buffer.from(
    `${env.AGROFIT_CONSUMER_KEY}:${env.AGROFIT_CONSUMER_SECRET}`,
  ).toString("base64");

  const res = await fetch(URL_TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basico}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    // Nao repassa o corpo da resposta: pode ecoar parte da credencial.
    throw new AppError(`Não foi possível autenticar no Agrofit (HTTP ${res.status}).`, 502);
  }

  const dados = (await res.json()) as { access_token: string; expires_in?: number };
  const segundos = dados.expires_in ?? 3600;
  // Renova com folga de 60 s para nao usar token que expira no meio do voo.
  token = { valor: dados.access_token, expiraEm: Date.now() + (segundos - 60) * 1000 };
  return token.valor;
}

async function buscar<T>(caminho: string, parametros: Record<string, string | number | undefined>) {
  const acesso = await obterToken();
  const url = new URL(`${BASE}${caminho}`);
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== "") url.searchParams.set(chave, String(valor));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${acesso}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 401) {
    // Token pode ter sido revogado do outro lado: joga fora e deixa a proxima
    // chamada pedir um novo, em vez de repetir o erro para sempre.
    token = null;
    throw new AppError("Agrofit recusou a credencial. Tente novamente.", 502);
  }
  if (!res.ok) {
    throw new AppError(`Agrofit respondeu HTTP ${res.status}.`, 502);
  }

  return (await res.json()) as T;
}

/**
 * O QUE ESTA API ACEITA DE VERDADE — medido em 01/08/2026.
 *
 * Ela **nao filtra**. Testei 14 nomes de parametro (cultura, praga,
 * marca_comercial, ingrediente_ativo, nome_comum, search, q...) e todos foram
 * ignorados: a resposta vinha identica. As rotas /busca, /search e /filtro
 * existem mas devolvem sempre lista vazia — sao tratadas como identificador,
 * nao como pesquisa.
 *
 * O unico parametro que funciona e `page`, com 100 itens por pagina.
 *
 * Isso parece limitacao, mas nao e: o cadastro inteiro tem **43 paginas**
 * (~4.252 produtos formulados). Espelhar tudo custa 43 requisicoes de um teto
 * de 100 mil por mes. Ou seja, sai mais barato baixar o cadastro completo e
 * pesquisar aqui dentro do que tentar consultar produto a produto.
 *
 * Vantagem sobre o CSV de dados abertos do MAPA (mesma informacao): la sao
 * 372 MB e 279 mil linhas desnormalizadas, com aspas e `;` dentro dos campos
 * que quebram leitor ingenuo. Aqui vem JSON estruturado, com as culturas e
 * pragas ja em lista dentro de cada produto.
 */

const ITENS_POR_PAGINA = 100;

export async function paginaDeProdutosFormulados(pagina = 1) {
  return buscar<ProdutoAgrofit[]>("/produtos-formulados", { page: pagina });
}

export async function paginaDeProdutosTecnicos(pagina = 1) {
  return buscar<ProdutoAgrofit[]>("/produtos-tecnicos", { page: pagina });
}

/**
 * Baixa o cadastro inteiro, pagina a pagina, ate vir uma vazia.
 *
 * `limitePaginas` existe como freio: se a API mudar e passar a devolver
 * sempre a mesma pagina, o laco nao roda para sempre queimando a cota.
 */
export async function espelharProdutosFormulados(limitePaginas = 200) {
  const todos: ProdutoAgrofit[] = [];
  for (let pagina = 1; pagina <= limitePaginas; pagina++) {
    const lote = await paginaDeProdutosFormulados(pagina);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todos.push(...lote);
    if (lote.length < ITENS_POR_PAGINA) break; // pagina incompleta = ultima
  }
  return todos;
}

export async function listarCulturas() {
  return buscar<{ nome: string }[]>("/culturas", {});
}

export async function listarPragas(pagina = 1) {
  return buscar<
    { classificacao: string; nome_cientifico: string; nome_comum: string[]; cultura: string[] }[]
  >("/pragas", { page: pagina });
}

export async function listarIngredientesAtivos() {
  return buscar<{ nome_comum: string; grupo_quimico: string; classe: string }[]>(
    "/ingredientes-ativos",
    {},
  );
}

/** Chamada mínima só para provar que a credencial funciona. */
export async function testarConexao() {
  const acesso = await obterToken();
  return { autenticado: true, tamanhoDoToken: acesso.length };
}

/**
 * Produto por numero de registro — busca direta, testada e funcionando
 * (`GET /produtos-formulados/{numero}`, devolve lista com 1 item). Diferente
 * da paginacao, esta e a unica consulta que vale a pena fazer produto a
 * produto: e exatamente o numero que `extrairRegistroMapa` (nfe.ts) tira do
 * texto livre da nota, e e a UNICA chave exata entre a nota e o Agrofit.
 *
 * Cache em memoria, sem TTL: registro no MAPA nao muda a cada dia, e o
 * processo reinicia a cada deploy de qualquer forma.
 */
const cacheProduto = new Map<string, ProdutoAgrofit | null>();

export async function buscarProdutoPorRegistro(numeroRegistro: string): Promise<ProdutoAgrofit | null> {
  if (cacheProduto.has(numeroRegistro)) return cacheProduto.get(numeroRegistro)!;

  let produto: ProdutoAgrofit | null;
  try {
    const lista = await buscar<ProdutoAgrofit[]>(`/produtos-formulados/${numeroRegistro}`, {});
    produto = Array.isArray(lista) && lista.length > 0 ? lista[0] : null;
  } catch {
    // Registro que a Embrapa nao reconhece, ou instabilidade momentanea: nao
    // e erro fatal para quem so queria uma SUGESTAO de função. O usuario
    // continua podendo marcar a mao.
    produto = null;
  }
  cacheProduto.set(numeroRegistro, produto);
  return produto;
}

/**
 * Classe agronomica do Agrofit ("Inseticida", "Fungicida"...) -> função do
 * nosso cadastro. So mapeia o que da para afirmar com confiança; classe sem
 * correspondencia clara (ex. "Espalhante Adesivo" isolado) fica de fora em
 * vez de virar um chute em "Outro".
 */
const MAPA_CLASSE_FUNCAO: Record<string, "INSETICIDA" | "FUNGICIDA" | "HERBICIDA" | "ACARICIDA" | "NEMATICIDA" | "ADJUVANTE"> = {
  INSETICIDA: "INSETICIDA",
  FUNGICIDA: "FUNGICIDA",
  BACTERICIDA: "FUNGICIDA",
  HERBICIDA: "HERBICIDA",
  ACARICIDA: "ACARICIDA",
  NEMATICIDA: "NEMATICIDA",
  NEMATOCIDA: "NEMATICIDA",
  ADJUVANTE: "ADJUVANTE",
};

/** Sem acento, sem caixa: "Adjuvante" e "ADJUVANTE" têm que casar igual. */
function chaveClasse(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

export function funcoesSugeridasDoAgrofit(produto: ProdutoAgrofit): string[] {
  const classes = produto.classe_categoria_agronomica ?? [];
  const funcoes = new Set<string>();
  for (const c of classes) {
    const mapeada = MAPA_CLASSE_FUNCAO[chaveClasse(c)];
    if (mapeada) funcoes.add(mapeada);
  }
  return [...funcoes];
}
