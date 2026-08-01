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

export interface ProdutoAgrofit {
  numeroRegistro?: string;
  marcaComercial?: string;
  titularRegistro?: string;
  ingredienteAtivo?: string;
  classeAgronomica?: string;
  modoAcao?: string;
  classificacaoToxicologica?: string;
  classificacaoAmbiental?: string;
  organico?: boolean;
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
 * Produtos formulados registrados, com filtro.
 *
 * Os nomes dos parametros seguem a documentacao da AgroAPI; o que o Agrofit
 * nao reconhecer, ele ignora — por isso mandamos apenas o que foi informado.
 */
export async function buscarProdutosFormulados(filtros: {
  cultura?: string;
  praga?: string;
  ingredienteAtivo?: string;
  marcaComercial?: string;
  pagina?: number;
  tamanho?: number;
}) {
  return buscar<unknown>("/produtos-formulados", {
    cultura: filtros.cultura,
    praga: filtros.praga,
    ingredienteAtivo: filtros.ingredienteAtivo,
    marcaComercial: filtros.marcaComercial,
    page: filtros.pagina ?? 1,
    size: filtros.tamanho ?? 20,
  });
}

export async function listarCulturas() {
  return buscar<unknown>("/culturas", {});
}

export async function listarPragas(filtros: { nome?: string; pagina?: number } = {}) {
  return buscar<unknown>("/pragas", { nome: filtros.nome, page: filtros.pagina ?? 1 });
}

/** Chamada mínima só para provar que a credencial funciona. */
export async function testarConexao() {
  const acesso = await obterToken();
  return { autenticado: true, tamanhoDoToken: acesso.length };
}
