// Motor de diagnostico agronomico simples: compara uma analise de solo com o
// perfil de correcao (faixas ideais) cadastrado para a cultura do talhao.
//
// Este e um diagnostico de apoio a decisao, NAO uma recomendacao tecnica de
// adubacao pronta. A necessidade de calagem usa a formula classica de
// saturacao por bases (NC = (V2 - V1) x CTC / 100) assumindo PRNT de 100%,
// o que e uma simplificacao — o valor real depende do corretivo escolhido.
// Sempre validar com um responsavel tecnico antes de aplicar em campo.

export type StatusParametro = "BAIXO" | "ADEQUADO" | "ALTO" | "SEM_REFERENCIA";

export interface ParametroDiagnostico {
  parametro: string;
  valorMedido: number | null;
  faixaIdealMin: number | null;
  faixaIdealMax: number | null;
  status: StatusParametro;
}

export interface DiagnosticoSolo {
  possuiPerfil: boolean;
  perfilNome?: string;
  dataAnaliseUtilizada?: Date;
  parametros: ParametroDiagnostico[];
  necessidadeCalagemToneladasPorHectare: number | null;
  observacaoCalagem: string | null;
}

interface AnaliseSoloEntrada {
  dataColeta: Date;
  ph: number | null;
  materiaOrganica: number | null;
  fosforo: number | null;
  potassio: number | null;
  calcio: number | null;
  magnesio: number | null;
  ctc: number | null;
  saturacaoBases: number | null;
}

interface PerfilCorrecaoEntrada {
  nome: string;
  phIdealMin: number | null;
  phIdealMax: number | null;
  materiaOrganicaIdeal: number | null;
  fosforoIdeal: number | null;
  potassioIdeal: number | null;
  calcioIdeal: number | null;
  magnesioIdeal: number | null;
  saturacaoBasesIdeal: number | null;
}

function classificarFaixa(
  valor: number | null,
  min: number | null,
  max: number | null,
): StatusParametro {
  if (valor === null || (min === null && max === null)) return "SEM_REFERENCIA";
  if (min !== null && valor < min) return "BAIXO";
  if (max !== null && valor > max) return "ALTO";
  return "ADEQUADO";
}

// Para parametros que tem apenas um valor "ideal minimo" de referencia
// (fosforo, potassio, calcio, magnesio, materia organica), usamos uma
// margem de tolerancia simples: abaixo de 90% do ideal = baixo, acima de
// 150% do ideal = alto.
function classificarMinimoIdeal(valor: number | null, ideal: number | null): StatusParametro {
  if (valor === null || ideal === null) return "SEM_REFERENCIA";
  if (valor < ideal * 0.9) return "BAIXO";
  if (valor > ideal * 1.5) return "ALTO";
  return "ADEQUADO";
}

export function gerarDiagnosticoSolo(
  analise: AnaliseSoloEntrada,
  perfil: PerfilCorrecaoEntrada | null,
): DiagnosticoSolo {
  if (!perfil) {
    return {
      possuiPerfil: false,
      parametros: [],
      necessidadeCalagemToneladasPorHectare: null,
      observacaoCalagem:
        "Nenhum perfil de correção de solo cadastrado para a cultura deste talhão.",
    };
  }

  const parametros: ParametroDiagnostico[] = [
    {
      parametro: "pH",
      valorMedido: analise.ph,
      faixaIdealMin: perfil.phIdealMin,
      faixaIdealMax: perfil.phIdealMax,
      status: classificarFaixa(analise.ph, perfil.phIdealMin, perfil.phIdealMax),
    },
    {
      parametro: "Matéria orgânica (g/dm³)",
      valorMedido: analise.materiaOrganica,
      faixaIdealMin: perfil.materiaOrganicaIdeal,
      faixaIdealMax: null,
      status: classificarMinimoIdeal(analise.materiaOrganica, perfil.materiaOrganicaIdeal),
    },
    {
      parametro: "Fósforo - P (mg/dm³)",
      valorMedido: analise.fosforo,
      faixaIdealMin: perfil.fosforoIdeal,
      faixaIdealMax: null,
      status: classificarMinimoIdeal(analise.fosforo, perfil.fosforoIdeal),
    },
    {
      parametro: "Potássio - K (mmolc/dm³)",
      valorMedido: analise.potassio,
      faixaIdealMin: perfil.potassioIdeal,
      faixaIdealMax: null,
      status: classificarMinimoIdeal(analise.potassio, perfil.potassioIdeal),
    },
    {
      parametro: "Cálcio - Ca (mmolc/dm³)",
      valorMedido: analise.calcio,
      faixaIdealMin: perfil.calcioIdeal,
      faixaIdealMax: null,
      status: classificarMinimoIdeal(analise.calcio, perfil.calcioIdeal),
    },
    {
      parametro: "Magnésio - Mg (mmolc/dm³)",
      valorMedido: analise.magnesio,
      faixaIdealMin: perfil.magnesioIdeal,
      faixaIdealMax: null,
      status: classificarMinimoIdeal(analise.magnesio, perfil.magnesioIdeal),
    },
    {
      parametro: "Saturação por bases - V (%)",
      valorMedido: analise.saturacaoBases,
      faixaIdealMin: perfil.saturacaoBasesIdeal,
      faixaIdealMax: null,
      status: classificarMinimoIdeal(analise.saturacaoBases, perfil.saturacaoBasesIdeal),
    },
  ];

  let necessidadeCalagemToneladasPorHectare: number | null = null;
  let observacaoCalagem: string | null = null;

  if (
    perfil.saturacaoBasesIdeal !== null &&
    analise.saturacaoBases !== null &&
    analise.ctc !== null
  ) {
    if (analise.saturacaoBases < perfil.saturacaoBasesIdeal) {
      const nc = ((perfil.saturacaoBasesIdeal - analise.saturacaoBases) * analise.ctc) / 100;
      necessidadeCalagemToneladasPorHectare = Math.round(nc * 100) / 100;
      observacaoCalagem =
        "Estimativa simplificada (NC = (V2−V1)×CTC/100, assumindo PRNT 100%). Ajuste conforme o PRNT do calcário disponível e validação técnica.";
    } else {
      observacaoCalagem = "Saturação por bases dentro ou acima do ideal — calagem não indicada.";
    }
  }

  return {
    possuiPerfil: true,
    perfilNome: perfil.nome,
    dataAnaliseUtilizada: analise.dataColeta,
    parametros,
    necessidadeCalagemToneladasPorHectare,
    observacaoCalagem,
  };
}
