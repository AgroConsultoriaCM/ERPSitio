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
  /** Umidade relativa média do dia (%) — calda evapora rápido abaixo de ~50%. */
  umidadeMediaPct: number | null;
  /** Vento máximo do dia (km/h) — deriva acima de ~15, inversão térmica abaixo de ~3. */
  ventoMaxKmh: number | null;
  /** Rajada máxima do dia (km/h). */
  rajadaMaxKmh: number | null;
  /** Índice UV máximo do dia. */
  indiceUv: number | null;
  passado: boolean;
}

/** Leitura do instante da consulta - não é média nem máximo do dia, é "agora". */
export interface AgoraClima {
  hora: string;
  tempC: number | null;
  umidadePct: number | null;
  ventoKmh: number | null;
  rajadaKmh: number | null;
  precipitacaoMm: number | null;
}

export interface RespostaClima {
  latitude: number;
  longitude: number;
  atualizadoEm: string;
  /** null quando a Open-Meteo não devolveu o bloco `current` (raro, mas acontece). */
  agora: AgoraClima | null;
  dias: DiaClima[];
  chuva7DiasMm: number;
  chuva30DiasMm: number;
  chuvaPrevista7DiasMm: number;
  diasSemChuva: number | null;
}

interface RespostaOpenMeteo {
  current?: {
    time: string;
    temperature_2m: number | null;
    relative_humidity_2m: number | null;
    wind_speed_10m: number | null;
    wind_gusts_10m: number | null;
    precipitation: number | null;
  };
  daily: {
    time: string[];
    precipitation_sum: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    et0_fao_evapotranspiration?: (number | null)[];
    relative_humidity_2m_mean?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
    wind_gusts_10m_max?: (number | null)[];
    uv_index_max?: (number | null)[];
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
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max,et0_fao_evapotranspiration,relative_humidity_2m_mean,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max` +
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

  // "en-CA" formata como AAAA-MM-DD — mas o que importa aqui é o timeZone: a
  // Open-Meteo devolve `daily.time` no calendário de America/Sao_Paulo (por
  // causa do parametro `timezone` na URL), e comparar isso com um "hoje" em
  // UTC erra um dia inteiro entre 21h e meia-noite no horario de Brasilia -
  // foi exatamente o que fez o dia de hoje sumir da janela de pulverizacao a
  // noite, mostrando so 6 dos 7 dias.
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const dias: DiaClima[] = json.daily.time.map((data, i) => ({
    data,
    chuvaMm: json.daily.precipitation_sum[i] ?? null,
    tempMax: json.daily.temperature_2m_max[i] ?? null,
    tempMin: json.daily.temperature_2m_min[i] ?? null,
    probabilidadeChuva: json.daily.precipitation_probability_max?.[i] ?? null,
    evapotranspiracaoMm: json.daily.et0_fao_evapotranspiration?.[i] ?? null,
    umidadeMediaPct: json.daily.relative_humidity_2m_mean?.[i] ?? null,
    ventoMaxKmh: json.daily.wind_speed_10m_max?.[i] ?? null,
    rajadaMaxKmh: json.daily.wind_gusts_10m_max?.[i] ?? null,
    indiceUv: json.daily.uv_index_max?.[i] ?? null,
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

  const agora: AgoraClima | null = json.current
    ? {
        hora: json.current.time,
        tempC: json.current.temperature_2m ?? null,
        umidadePct: json.current.relative_humidity_2m ?? null,
        ventoKmh: json.current.wind_speed_10m ?? null,
        rajadaKmh: json.current.wind_gusts_10m ?? null,
        precipitacaoMm: json.current.precipitation ?? null,
      }
    : null;

  const dados: RespostaClima = {
    latitude,
    longitude,
    atualizadoEm: new Date().toISOString(),
    agora,
    dias,
    chuva7DiasMm: somar(passados.slice(-7)),
    chuva30DiasMm: somar(passados),
    chuvaPrevista7DiasMm: somar(futuros),
    diasSemChuva,
  };

  cache.set(chave, { em: Date.now(), dados });
  return dados;
}
