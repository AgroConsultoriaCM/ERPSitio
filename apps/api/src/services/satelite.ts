import { env } from "../env.js";
import { AppError } from "../lib/errors.js";
import type { LeituraSatelite } from "./notaTalhao.js";

/**
 * Sentinel-2 pelo Copernicus Data Space (Sentinel Hub).
 *
 * Entrega duas coisas para cada talhao, sempre recortadas no contorno
 * desenhado - nao num retangulo em volta:
 *   - imagem NDVI colorida, para olhar variacao dentro da area
 *   - serie de estatisticas (NDVI, OSAVI, desvio), que alimenta a nota
 *
 * Conta gratuita: 10.000 processing units e 10.000 requisicoes por mes. Um
 * talhao de ~5 ha bate no piso de 0,005 PU por chamada, entao o sitio inteiro
 * consome fracao de 1% do teto mesmo atualizando todo dia.
 *
 * A credencial fica no servidor. O navegador pede ao nosso backend, que pede
 * ao Copernicus - a chave nunca chega ao aparelho de ninguem.
 */

const URL_TOKEN =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const URL_PROCESSO = "https://sh.dataspace.copernicus.eu/api/v1/process";
const URL_ESTATISTICA = "https://sh.dataspace.copernicus.eu/api/v1/statistics";

/**
 * Resolucao em GRAUS, nao metros.
 *
 * Com o poligono em EPSG:4326 o Sentinel Hub le resx/resy na unidade do CRS.
 * Passar "10" pedindo 10 metros devolve UM pixel para o talhao inteiro, e a
 * estatistica sai com media, minimo e maximo identicos - numero que parece
 * plausivel e nao significa nada. Na latitude do sitio, 10 m ~ 0,00009 grau.
 */
const RESOLUCAO_GRAUS = 0.00009;

/** Acima disso a cena tem nuvem demais para servir de leitura. */
const NUVEM_MAXIMA = 40;

export interface PoligonoGeoJSON {
  type: "Polygon";
  coordinates: number[][][];
}

export function sateliteConfigurado(): boolean {
  return !!env.COPERNICUS_CLIENT_ID && !!env.COPERNICUS_CLIENT_SECRET;
}

let token: { valor: string; expiraEm: number } | null = null;

async function obterToken(): Promise<string> {
  if (token && Date.now() < token.expiraEm) return token.valor;

  if (!sateliteConfigurado()) {
    throw new AppError(
      "Imagens de satélite indisponíveis: credenciais do Copernicus não configuradas no servidor.",
      503,
    );
  }

  const res = await fetch(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.COPERNICUS_CLIENT_ID as string,
      client_secret: env.COPERNICUS_CLIENT_SECRET as string,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    // Nao repassa o corpo: pode ecoar parte da credencial.
    throw new AppError(`Não foi possível autenticar no Copernicus (HTTP ${res.status}).`, 502);
  }

  const dados = (await res.json()) as { access_token: string; expires_in?: number };
  const segundos = dados.expires_in ?? 1800;
  token = { valor: dados.access_token, expiraEm: Date.now() + (segundos - 60) * 1000 };
  return token.valor;
}

function limites(poligono: PoligonoGeoJSON) {
  return {
    geometry: poligono,
    properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
  };
}

/**
 * Imagem NDVI em faixas de cor, recortada no contorno.
 *
 * O canal alfa recebe o dataMask: fora do poligono fica transparente, entao a
 * imagem se encaixa no mapa sem quadrado branco em volta.
 */
const EVALSCRIPT_IMAGEM = `//VERSION=3
function setup() {
  return { input: ["B04","B08","dataMask"], output: { bands: 4 } };
}
function evaluatePixel(s) {
  let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
  let cor;
  if (ndvi < 0.1) cor = [0.65, 0.60, 0.50];
  else if (ndvi < 0.2) cor = [0.85, 0.78, 0.55];
  else if (ndvi < 0.3) cor = [0.90, 0.85, 0.35];
  else if (ndvi < 0.4) cor = [0.75, 0.85, 0.25];
  else if (ndvi < 0.5) cor = [0.55, 0.78, 0.20];
  else if (ndvi < 0.6) cor = [0.35, 0.68, 0.18];
  else if (ndvi < 0.7) cor = [0.20, 0.55, 0.15];
  else cor = [0.08, 0.40, 0.12];
  return [...cor, s.dataMask];
}`;

/**
 * NDVI e OSAVI juntos. O 0,16 do OSAVI desconta o solo exposto entre as ruas.
 *
 * maxCloudCoverage (abaixo) filtra pela nuvem da CENA inteira, mas um talhão
 * de poucos hectares cabe várias vezes dentro de uma cena de 100x100 km - a
 * cena pode passar no filtro (ex.: 35% de nuvem) com a nuvem caindo bem em
 * cima do talhão. Por isso o SCL (Scene Classification Layer) entra aqui: é
 * a classificação por PIXEL que o próprio Sentinel-2 já calcula, e zerar o
 * dataMask nas classes de nuvem/sombra tira esses pixels da média ANTES dela
 * ser calculada - mais confiável que tentar filtrar depois pela estatística.
 * Classes descartadas: 3 sombra de nuvem, 8/9 nuvem média/alta probabilidade,
 * 10 cirrus fino. (6 água e 11 neve ficam, não são nuvem.)
 */
const EVALSCRIPT_ESTATISTICA = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04","B08","SCL","dataMask"] }],
    output: [
      { id: "ndvi", bands: 1 },
      { id: "osavi", bands: 1 },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  var nuvemOuSombra = s.SCL === 3 || s.SCL === 8 || s.SCL === 9 || s.SCL === 10;
  var valido = s.dataMask === 1 && !nuvemOuSombra ? 1 : 0;
  return {
    ndvi: [(s.B08 - s.B04) / (s.B08 + s.B04)],
    osavi: [(s.B08 - s.B04) / (s.B08 + s.B04 + 0.16)],
    dataMask: [valido]
  };
}`;

export async function imagemNdvi(
  poligono: PoligonoGeoJSON,
  opcoes: { dias?: number; largura?: number } = {},
): Promise<Buffer> {
  const acesso = await obterToken();
  const dias = opcoes.dias ?? 60;
  const largura = Math.min(opcoes.largura ?? 512, 1024);
  const ate = new Date();
  const de = new Date(ate.getTime() - dias * 864e5);

  const res = await fetch(URL_PROCESSO, {
    method: "POST",
    headers: { Authorization: `Bearer ${acesso}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        bounds: limites(poligono),
        data: [
          {
            type: "sentinel-2-l2a",
            dataFilter: {
              timeRange: { from: de.toISOString(), to: ate.toISOString() },
              maxCloudCoverage: 30,
              // A cena menos nublada do periodo, nao a mais recente: imagem
              // com nuvem em cima do talhao nao serve para nada.
              mosaickingOrder: "leastCC",
            },
          },
        ],
      },
      output: {
        width: largura,
        height: largura,
        responses: [{ identifier: "default", format: { type: "image/png" } }],
      },
      evalscript: EVALSCRIPT_IMAGEM,
    }),
    signal: AbortSignal.timeout(40_000),
  });

  if (!res.ok) {
    throw new AppError(`Copernicus respondeu HTTP ${res.status} ao gerar a imagem.`, 502);
  }
  return Buffer.from(await res.arrayBuffer());
}

interface RespostaEstatistica {
  data?: {
    interval: { from: string; to: string };
    outputs?: Record<string, { bands?: Record<string, { stats?: Record<string, number> }> }>;
  }[];
}

export async function serieSatelite(
  poligono: PoligonoGeoJSON,
  opcoes: { de: Date; ate: Date; intervalo?: string },
): Promise<LeituraSatelite[]> {
  const acesso = await obterToken();

  const res = await fetch(URL_ESTATISTICA, {
    method: "POST",
    headers: { Authorization: `Bearer ${acesso}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        bounds: limites(poligono),
        data: [{ type: "sentinel-2-l2a", dataFilter: { maxCloudCoverage: NUVEM_MAXIMA } }],
      },
      aggregation: {
        timeRange: { from: opcoes.de.toISOString(), to: opcoes.ate.toISOString() },
        aggregationInterval: { of: opcoes.intervalo ?? "P15D" },
        resx: RESOLUCAO_GRAUS,
        resy: RESOLUCAO_GRAUS,
        evalscript: EVALSCRIPT_ESTATISTICA,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new AppError(`Copernicus respondeu HTTP ${res.status} ao calcular a série.`, 502);
  }

  const corpo = (await res.json()) as RespostaEstatistica;
  return (corpo.data ?? []).map((d) => {
    const ndvi = d.outputs?.ndvi?.bands?.B0?.stats;
    const osavi = d.outputs?.osavi?.bands?.B0?.stats;
    const pixels = ndvi?.sampleCount ?? 0;
    // Cena nublada volta com contagem zero: nao inventa numero, devolve nulo.
    const vazia = !pixels || pixels === 0;
    return {
      data: d.interval.from,
      ndviMedio: vazia ? null : (ndvi?.mean ?? null),
      osaviMedio: vazia ? null : (osavi?.mean ?? null),
      desvio: vazia ? null : (ndvi?.stDev ?? null),
      pixels,
    };
  });
}
