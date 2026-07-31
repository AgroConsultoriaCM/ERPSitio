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
 *  Faixa usual de 0,60 a 0,75; 0,70 é o valor médio adotado aqui. Deixado
 *  explícito e como parâmetro para poder ser ajustado sem caçar no código. */
export const KC_CITROS_ADULTO = 0.7;

export type QualidadeJanela = "boa" | "atencao" | "ruim";

export interface DiaJanela {
  data: string;
  qualidade: QualidadeJanela;
  motivo: string;
  chuvaMm: number;
  probabilidade: number | null;
  /**
   * Chuva forte prevista para o dia seguinte. Não rebaixa a qualidade — um dia
   * seco continua sendo dia de aplicar, e aplicar cedo resolve. Mas o aviso
   * precisa aparecer, porque produto de contato aplicado no fim da tarde pode
   * ser lavado pela chuva da manhã seguinte.
   */
  avisoDiaSeguinte?: string;
}

const CLASSE_ORDEM: Record<QualidadeJanela, number> = { boa: 0, atencao: 1, ruim: 2 };

/**
 * Classifica os próximos dias para pulverização.
 *
 * O critério é a lavagem da calda: chuva logo após a aplicação tira o produto
 * da folha e o dinheiro vai junto. Como a previsão diária não diz a hora da
 * chuva, o dia seguinte também pesa — chover de manhã depois de aplicar à
 * tarde dá no mesmo.
 */
export function janelaPulverizacao(dias: DiaClima[]): DiaJanela[] {
  const futuros = dias.filter((d) => !d.passado);

  return futuros.map((d, i) => {
    const chuva = d.chuvaMm ?? 0;
    const prob = d.probabilidadeChuva;
    const seguinte = futuros[i + 1];
    const chuvaSeguinte = seguinte?.chuvaMm ?? 0;

    // A qualidade olha só o próprio dia. Misturar o dia seguinte aqui fazia
    // um dia seco antes de uma frente virar "atenção", e a semana inteira
    // ficava sem nenhum dia bom — justamente quando havia um.
    let qualidade: QualidadeJanela = "boa";
    let motivo = "sem chuva prevista";

    if (chuva >= 5 || (prob != null && prob >= 70)) {
      qualidade = "ruim";
      motivo = chuva >= 5 ? `${chuva.toFixed(0)} mm previstos` : `${prob}% de chance de chuva`;
    } else if (chuva >= 1 || (prob != null && prob >= 40)) {
      qualidade = "atencao";
      motivo = chuva >= 1 ? `${chuva.toFixed(1)} mm previstos` : `${prob}% de chance de chuva`;
    }

    const avisoDiaSeguinte =
      chuvaSeguinte >= 5 ? `${chuvaSeguinte.toFixed(0)} mm no dia seguinte — aplique cedo` : undefined;

    return { data: d.data, qualidade, motivo, chuvaMm: chuva, probabilidade: prob, avisoDiaSeguinte };
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
export function resumoClima(clima: RespostaClima): string {
  const janela = janelaPulverizacao(clima.dias);
  const boa = proximaJanelaBoa(janela);
  const balanco = balancoHidrico(clima.dias);

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
