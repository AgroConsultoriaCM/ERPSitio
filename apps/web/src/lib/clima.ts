import type { DiaClima, RespostaClima } from "./types";

/**
 * Leituras derivadas da previsão do tempo (Open-Meteo, já consumida pela API
 * em /clima). São contas simples feitas sobre dados que já chegam prontos —
 * nada aqui vai ao banco nem depende de outro serviço.
 *
 * Tudo isto é ORIENTAÇÃO, não receita: a decisão de pulverizar ou irrigar é do
 * agrônomo. O objetivo é poupar a consulta manual à previsão antes de decidir.
 */

/** Coeficiente de cultura do citros adulto em produção.
 *  Faixa usual de 0,60 a 0,75; 0,70 é o valor médio adotado aqui. Hoje é
 *  apenas o valor-padrão do cadastro (ver ParametroPulverizacao) — o Igor
 *  pode ajustar em Cadastros → Janela de pulverização. */
export const KC_CITROS_ADULTO = 0.7;

/**
 * Parâmetros ideais da janela de pulverização, editáveis em
 * Cadastros → Janela de pulverização (model ParametroPulverizacao no banco).
 * Estes são só os valores-padrão para quando o cadastro ainda não carregou.
 */
export interface ParametrosJanela {
  chuvaMmZero: number;
  chuvaProbPctZero: number;
  ventoIdealMinKmh: number;
  ventoIdealMaxKmh: number;
  ventoZeroBaixoKmh: number;
  ventoZeroAltoKmh: number;
  umidadeIdealMinPct: number;
  umidadeZeroPct: number;
  kcCultura: number;
}

export const PARAMETROS_PADRAO: ParametrosJanela = {
  chuvaMmZero: 5,
  chuvaProbPctZero: 70,
  ventoIdealMinKmh: 3,
  ventoIdealMaxKmh: 8,
  ventoZeroBaixoKmh: 1,
  ventoZeroAltoKmh: 15,
  umidadeIdealMinPct: 55,
  umidadeZeroPct: 30,
  kcCultura: 0.7,
};

export type QualidadeJanela = "boa" | "atencao" | "ruim";

export interface DiaJanela {
  data: string;
  /** 0 a 100 — 100 é condição perfeita, 0 é dia a evitar. Pega sempre o PIOR entre chuva/vento/umidade. */
  score: number;
  qualidade: QualidadeJanela;
  motivo: string;
  chuvaMm: number;
  probabilidade: number | null;
  /**
   * Chuva forte prevista para o dia seguinte. Não rebaixa o score — um dia
   * seco continua sendo dia de aplicar, e aplicar cedo resolve. Mas o aviso
   * precisa aparecer, porque produto de contato aplicado no fim da tarde pode
   * ser lavado pela chuva da manhã seguinte.
   */
  avisoDiaSeguinte?: string;
}

const CLASSE_ORDEM: Record<QualidadeJanela, number> = { boa: 0, atencao: 1, ruim: 2 };

/** Interpola linear entre "zero" (score 0) e "cem" (score 100), sem sair de 0-100. */
function pontuar(valor: number, cem: number, zero: number): number {
  if (cem === zero) return 100;
  const razao = (valor - zero) / (cem - zero);
  return Math.max(0, Math.min(100, razao * 100));
}

/** Faixa com "sweet spot" (100% dentro dela) e um lado zero de cada fora. */
function pontuarFaixa(valor: number, idealMin: number, idealMax: number, zeroBaixo: number, zeroAlto: number): number {
  if (valor < idealMin) return pontuar(valor, idealMin, zeroBaixo);
  if (valor > idealMax) return pontuar(valor, idealMax, zeroAlto);
  return 100;
}

interface Fator {
  score: number;
  motivo: string;
}

/** Chuva: o critério mais forte — lava a calda e o dinheiro vai junto. Pega o pior entre mm previstos e probabilidade. */
function fatorChuva(chuva: number, prob: number | null, p: ParametrosJanela): Fator {
  const porMm = pontuar(chuva, 0, p.chuvaMmZero);
  const porProb = prob != null ? pontuar(prob, 0, p.chuvaProbPctZero) : 100;
  const score = Math.min(porMm, porProb);
  const motivo =
    porMm <= porProb
      ? chuva > 0
        ? `${chuva.toFixed(1)} mm previstos`
        : "sem chuva prevista"
      : prob != null
        ? `${prob}% de chance de chuva`
        : "sem chuva prevista";
  return { score, motivo };
}

/**
 * Vento: faixa ideal configurável (padrão 3–8 km/h). Acima do limite alto a
 * deriva leva o produto para fora do alvo; abaixo do limite baixo o ar não
 * se mistura (inversão térmica) e a nuvem de aplicação fica solta.
 */
function fatorVento(ventoKmh: number | null, p: ParametrosJanela): Fator {
  if (ventoKmh == null) return { score: 100, motivo: "vento dentro do esperado" };
  const score = pontuarFaixa(ventoKmh, p.ventoIdealMinKmh, p.ventoIdealMaxKmh, p.ventoZeroBaixoKmh, p.ventoZeroAltoKmh);
  const motivo =
    ventoKmh > p.ventoIdealMaxKmh
      ? `vento de ${ventoKmh.toFixed(0)} km/h — risco de deriva`
      : ventoKmh < p.ventoIdealMinKmh
        ? `vento fraco (${ventoKmh.toFixed(0)} km/h) — risco de inversão térmica`
        : `vento de ${ventoKmh.toFixed(0)} km/h`;
  return { score, motivo };
}

/** Umidade baixa evapora a gota antes de chegar no alvo. */
function fatorUmidade(umidadePct: number | null, p: ParametrosJanela): Fator {
  if (umidadePct == null) return { score: 100, motivo: "umidade dentro do esperado" };
  const score = pontuar(umidadePct, p.umidadeIdealMinPct, p.umidadeZeroPct);
  const motivo =
    umidadePct < p.umidadeIdealMinPct
      ? `umidade baixa (${umidadePct.toFixed(0)}%) — a calda evapora rápido`
      : `umidade de ${umidadePct.toFixed(0)}%`;
  return { score, motivo };
}

function qualidadeDoScore(score: number): QualidadeJanela {
  if (score >= 70) return "boa";
  if (score >= 40) return "atencao";
  return "ruim";
}

/**
 * Classifica os próximos dias para pulverização com um score contínuo de
 * 0 a 100 (100 = condição perfeita) — o pior entre chuva, vento e umidade
 * vence, mesma lógica de antes, só que agora contínua em vez de 3 categorias
 * fixas, e com os limiares vindos do cadastro em vez de constantes no código.
 *
 * Como a previsão diária não diz a hora da chuva, o dia seguinte também
 * pesa no AVISO (não no score) — chover de manhã depois de aplicar à tarde
 * dá no mesmo.
 */
export function janelaPulverizacao(dias: DiaClima[], parametros: ParametrosJanela = PARAMETROS_PADRAO): DiaJanela[] {
  const futuros = dias.filter((d) => !d.passado);

  return futuros.map((d, i) => {
    const chuva = d.chuvaMm ?? 0;
    const prob = d.probabilidadeChuva;
    const seguinte = futuros[i + 1];
    const chuvaSeguinte = seguinte?.chuvaMm ?? 0;

    // O score olha só o próprio dia. Misturar o dia seguinte aqui fazia um
    // dia seco antes de uma frente virar "atenção", e a semana inteira
    // ficava sem nenhum dia bom - justamente quando havia um.
    const fatores = [
      fatorChuva(chuva, prob, parametros),
      fatorVento(d.ventoMaxKmh, parametros),
      fatorUmidade(d.umidadeMediaPct, parametros),
    ];

    const pior = fatores.reduce((p, f) => (f.score < p.score ? f : p));
    const score = Math.round(pior.score);
    const motivo = score >= 95 ? "sem chuva prevista, vento e umidade dentro do esperado" : pior.motivo;

    const avisoDiaSeguinte =
      chuvaSeguinte >= 5 ? `${chuvaSeguinte.toFixed(0)} mm no dia seguinte — aplique cedo` : undefined;

    return {
      data: d.data,
      score,
      qualidade: qualidadeDoScore(score),
      motivo,
      chuvaMm: chuva,
      probabilidade: prob,
      avisoDiaSeguinte,
    };
  });
}

/** O primeiro dia bom da janela, se houver. Usado para a frase de resumo. */
export function proximaJanelaBoa(janela: DiaJanela[]): DiaJanela | null {
  return janela.find((d) => d.qualidade === "boa") ?? null;
}

export function piorQualidade(janela: DiaJanela[]): QualidadeJanela {
  return janela.reduce<QualidadeJanela>(
    (pior, d) => (CLASSE_ORDEM[d.qualidade] > CLASSE_ORDEM[pior] ? d.qualidade : pior),
    "boa",
  );
}

export interface BalancoHidrico {
  dias: number;
  chuvaMm: number;
  demandaMm: number;
  saldoMm: number;
  /** true quando o período fechou com mais demanda do que chuva */
  deficit: boolean;
  /** false quando a fonte não trouxe evapotranspiração para o período */
  temDados: boolean;
}

/**
 * Balanço entre a chuva que caiu e a água que a planta pediu no período.
 *
 * demanda = ET0 (evapotranspiração de referência, vinda da Open-Meteo) × Kc.
 * Saldo negativo significa que a diferença precisou sair da irrigação ou da
 * reserva do solo. Não substitui tensiômetro nem sonda — serve para dar ordem
 * de grandeza e apontar quando o assunto merece olhada.
 */
export function balancoHidrico(
  dias: DiaClima[],
  janelaDias = 7,
  kc = KC_CITROS_ADULTO,
): BalancoHidrico {
  const periodo = dias.filter((d) => d.passado).slice(-janelaDias);
  const comEt = periodo.filter((d) => d.evapotranspiracaoMm != null);

  const chuvaMm = periodo.reduce((s, d) => s + (d.chuvaMm ?? 0), 0);
  const demandaMm = comEt.reduce((s, d) => s + (d.evapotranspiracaoMm ?? 0) * kc, 0);
  const saldoMm = chuvaMm - demandaMm;

  return {
    dias: periodo.length,
    chuvaMm: Math.round(chuvaMm * 10) / 10,
    demandaMm: Math.round(demandaMm * 10) / 10,
    saldoMm: Math.round(saldoMm * 10) / 10,
    deficit: saldoMm < 0,
    temDados: comEt.length > 0,
  };
}

/** Frase curta de topo, para quem só vai bater o olho. */
export function resumoClima(clima: RespostaClima, parametros: ParametrosJanela = PARAMETROS_PADRAO): string {
  const janela = janelaPulverizacao(clima.dias, parametros);
  const boa = proximaJanelaBoa(janela);
  const balanco = balancoHidrico(clima.dias, 7, parametros.kcCultura);

  const partes: string[] = [];

  if (clima.diasSemChuva != null) {
    partes.push(
      clima.diasSemChuva === 0
        ? "choveu hoje"
        : `${clima.diasSemChuva} dia${clima.diasSemChuva > 1 ? "s" : ""} sem chuva`,
    );
  }

  if (balanco.temDados && balanco.deficit) {
    partes.push(`déficit de ${Math.abs(balanco.saldoMm).toFixed(0)} mm em ${balanco.dias} dias`);
  }

  if (clima.chuvaPrevista7DiasMm >= 1) {
    partes.push(`${clima.chuvaPrevista7DiasMm.toFixed(0)} mm previstos na semana`);
  } else if (boa) {
    partes.push("semana seca");
  }

  return partes.join(" · ");
}

export function diaCurto(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function diaSemana(iso: string): string {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "");
}
