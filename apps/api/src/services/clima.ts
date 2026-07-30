import { AppError } from "../lib/errors.js";

// Open-Meteo: gratuita, sem chave de API e sem cadastro. Entrega historico
// (past_days) e previsao no mesmo endpoint.
const BASE = "https://api.open-meteo.com/v1/forecast";
const TIMEZONE = "America/Sao_Paulo";

export interface DiaClima {
  data: string;
  chuvaMm: number | null;
  tempMax: number | null;
  tempMin: number | null;
  probabilidadeChuva: number | null;
  evapotranspiracaoMm: number | null;
  passado: boolean;
}

export interface RespostaClima {
  latitude: number;
  longitude: number;
  atualizadoEm: string;
  dias: DiaClima[];
  chuva7DiasMm: number;
  chuva30DiasMm: number;
  chuvaPrevista7DiasMm: number;
  diasSemChuva: number | null;
}

interface RespostaOpenMeteo {
  daily: {
    time: string[];
    precipitation_sum: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    et0_fao_evapotranspiration?: (number | null)[];
  };
}

// Cache em memoria: o clima diario nao muda a cada minuto e evita bater na
// API a cada carregamento de tela.
const cache = new Map<string, { em: number; dados: RespostaClima }>();
const TTL_MS = 30 * 60 * 1000;

const arred = (v: number) => Math.round(v * 10) / 10;

export async function buscarClima(latitude: number, longitude: number): Promise<RespostaClima> {
  const chave = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const emCache = cache.get(chave);
  if (emCache && Date.now() - emCache.em < TTL_MS) return emCache.dados;

  const url =
    `${BASE}?latitude=${latitude}&longitude=${longitude}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max,et0_fao_evapotranspiration` +
    `&timezone=${encodeURIComponent(TIMEZONE)}&past_days=30&forecast_days=7`;

  let json: RespostaOpenMeteo;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = (await res.json()) as RespostaOpenMeteo;
  } catch (err) {
    // se ja tivemos resposta antes, entrega a ultima conhecida em vez de
    // quebrar a tela por instabilidade de rede
    if (emCache) return emCache.dados;
    throw new AppError(
      `Não foi possível consultar a previsão do tempo agora (${
        err instanceof Error ? err.message : "erro desconhecido"
      }).`,
      503,
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const dias: DiaClima[] = json.daily.time.map((data, i) => ({
    data,
    chuvaMm: json.daily.precipitation_sum[i] ?? null,
    tempMax: json.daily.temperature_2m_max[i] ?? null,
    tempMin: json.daily.temperature_2m_min[i] ?? null,
    probabilidadeChuva: json.daily.precipitation_probability_max?.[i] ?? null,
    evapotranspiracaoMm: json.daily.et0_fao_evapotranspiration?.[i] ?? null,
    passado: data < hoje,
  }));

  const passados = dias.filter((d) => d.passado);
  const futuros = dias.filter((d) => !d.passado);
  const somar = (lista: DiaClima[]) => arred(lista.reduce((s, d) => s + (d.chuvaMm ?? 0), 0));

  // dias desde a ultima chuva relevante (>= 1 mm)
  let diasSemChuva: number | null = null;
  const ordenadosDesc = [...passados].reverse();
  const idx = ordenadosDesc.findIndex((d) => (d.chuvaMm ?? 0) >= 1);
  if (idx >= 0) diasSemChuva = idx;

  const dados: RespostaClima = {
    latitude,
    longitude,
    atualizadoEm: new Date().toISOString(),
    dias,
    chuva7DiasMm: somar(passados.slice(-7)),
    chuva30DiasMm: somar(passados),
    chuvaPrevista7DiasMm: somar(futuros),
    diasSemChuva,
  };

  cache.set(chave, { em: Date.now(), dados });
  return dados;
}
