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
  enxofre: number | null;
  potassio: number | null;
  calcio: number | null;
  magnesio: number | null;
  ctc: number | null;
  saturacaoBases: number | null;
  /** { boro: 1.2, cobre: 0.5, ... } - mesmas chaves do perfil, ver MICRONUTRIENTES_COMPARADOS. */
  micronutrientes?: unknown;
}

interface PerfilCorrecaoEntrada {
  nome: string;
  phIdealMin: number | null;
  phIdealMax: number | null;
  materiaOrganicaIdeal: number | null;
  fosforoIdeal: number | null;
  enxofreIdeal: number | null;
  potassioIdeal: number | null;
  calcioIdeal: number | null;
  magnesioIdeal: number | null;
  saturacaoBasesIdeal: number | null;
  /** Relacoes de equilibrio cationico - comparadas contra o Ca/Mg/K calculado da propria analise. */
  relacaoCaMgIdeal: number | null;
  relacaoMgKIdeal: number | null;
  relacaoCaMgKIdeal: number | null;
  /** { boro: 1.2, cobre: 0.5, ... } - ideal minimo de cada micronutriente. */
  micronutrientesIdeais?: unknown;
}

/** Ca/Mg, Mg/K ou (Ca+Mg)/K - null se faltar alguma parte ou o divisor for zero. */
function calcularRelacao(numerador: number | null, denominador: number | null): number | null {
  if (numerador === null || denominador === null || denominador === 0) return null;
  return numerador / denominador;
}

const arred2 = (v: number) => Math.round(v * 100) / 100;

/** Micronutrientes com "ideal minimo" no mesmo espirito de P/K/Ca/Mg. */
const MICRONUTRIENTES_COMPARADOS = ["boro", "cobre", "ferro", "manganes", "zinco"] as const;

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

// --- resumo em 4 niveis (para a bolinha colorida do Manejo Nutricional) -----

export type StatusGeral = "BAIXO" | "MARGEM" | "ADEQUADO" | "ALTO" | "SEM_REFERENCIA";

/**
 * Classifica um valor medido contra uma faixa ideal em QUATRO niveis, nao
 * tres: alem de "baixo" e "alto" (gerarDiagnosticoSolo acima), separa quem
 * esta perto da borda (MARGEM, amarelo) de quem esta claramente dentro
 * (ADEQUADO, verde) ou claramente fora (BAIXO vermelho / ALTO azul). E o que
 * sustenta a bolinha de resumo do bloco de solo.
 *
 * Faixa com minimo E maximo (hoje so pH usa isso): a margem e uma fatia da
 * largura da propria faixa - faixa estreita tem margem estreita.
 * Faixa com so um "ideal minimo" (todos os outros parametros hoje
 * cadastraveis): a margem e um percentual do ideal, no mesmo espirito do
 * classificarMinimoIdeal usado no diagnostico por talhao.
 *
 * Limiares (25% da largura da faixa; 70%/140% do ideal minimo) sao um ponto
 * de partida razoavel, nao literatura fechada - ajustar se a prática mostrar
 * outra coisa.
 */
function classificarQuatroNiveis(
  valor: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): StatusGeral {
  // "== null" de proposito: pega null E undefined no mesmo teste - um campo
  // opcional ausente e "sem valor" nos dois casos, e Json do Prisma pode
  // devolver undefined para uma chave que nao existe no objeto.
  if (valor == null || (min == null && max == null)) return "SEM_REFERENCIA";

  if (min != null && max != null) {
    const largura = max - min;
    const margem = largura > 0 ? largura * 0.25 : Math.abs(min || max || 1) * 0.1;
    if (valor < min - margem) return "BAIXO";
    if (valor < min) return "MARGEM";
    if (valor <= max + margem) return "ADEQUADO";
    return "ALTO";
  }

  const ideal = (min ?? max) as number;
  if (ideal === 0) return "SEM_REFERENCIA";
  const razao = valor / ideal;
  if (razao < 0.7) return "BAIXO";
  if (razao < 1) return "MARGEM";
  if (razao <= 1.4) return "ADEQUADO";
  return "ALTO";
}

/** Do pior para o melhor - um só parâmetro crítico já marca a bolinha toda. */
const PRIORIDADE_STATUS: StatusGeral[] = ["BAIXO", "ALTO", "MARGEM", "ADEQUADO"];

/**
 * Um único status resumindo a última análise de solo contra o perfil da
 * cultura - a bolinha do canto do bloco. Pega o PIOR entre os parâmetros
 * comparáveis: um só nutriente fora da faixa já chama atenção, mesmo que os
 * outros estejam bons. Sem perfil cadastrado (ou nenhum parâmetro em comum
 * preenchido), devolve SEM_REFERENCIA - cinza, não "adequado" por omissão.
 */
/** Le um numero de dentro de um JSON de micronutrientes, sem confiar no formato. */
function numeroDoJson(json: unknown, chave: string): number | null {
  if (!json || typeof json !== "object") return null;
  const v = (json as Record<string, unknown>)[chave];
  return typeof v === "number" ? v : null;
}

export function classificarStatusGeralSolo(
  analise: AnaliseSoloEntrada,
  perfil: PerfilCorrecaoEntrada | null,
): StatusGeral {
  if (!perfil) return "SEM_REFERENCIA";

  const avaliacoes = [
    classificarQuatroNiveis(analise.ph, perfil.phIdealMin, perfil.phIdealMax),
    classificarQuatroNiveis(analise.materiaOrganica, perfil.materiaOrganicaIdeal, null),
    classificarQuatroNiveis(analise.fosforo, perfil.fosforoIdeal, null),
    classificarQuatroNiveis(analise.enxofre, perfil.enxofreIdeal, null),
    classificarQuatroNiveis(analise.potassio, perfil.potassioIdeal, null),
    classificarQuatroNiveis(analise.calcio, perfil.calcioIdeal, null),
    classificarQuatroNiveis(analise.magnesio, perfil.magnesioIdeal, null),
    classificarQuatroNiveis(analise.saturacaoBases, perfil.saturacaoBasesIdeal, null),
    classificarQuatroNiveis(
      calcularRelacao(analise.calcio, analise.magnesio),
      perfil.relacaoCaMgIdeal,
      null,
    ),
    classificarQuatroNiveis(
      calcularRelacao(analise.magnesio, analise.potassio),
      perfil.relacaoMgKIdeal,
      null,
    ),
    classificarQuatroNiveis(
      calcularRelacao(
        analise.calcio !== null && analise.magnesio !== null ? analise.calcio + analise.magnesio : null,
        analise.potassio,
      ),
      perfil.relacaoCaMgKIdeal,
      null,
    ),
    ...MICRONUTRIENTES_COMPARADOS.map((chave) =>
      classificarQuatroNiveis(
        numeroDoJson(analise.micronutrientes, chave),
        numeroDoJson(perfil.micronutrientesIdeais, chave),
        null,
      ),
    ),
  ].filter((s): s is Exclude<StatusGeral, "SEM_REFERENCIA"> => s !== "SEM_REFERENCIA");

  if (avaliacoes.length === 0) return "SEM_REFERENCIA";
  return PRIORIDADE_STATUS.find((p) => (avaliacoes as StatusGeral[]).includes(p)) ?? "ADEQUADO";
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
      parametro: "Enxofre - S (mg/dm³)",
      valorMedido: analise.enxofre,
      faixaIdealMin: perfil.enxofreIdeal,
      faixaIdealMax: null,
      status: classificarMinimoIdeal(analise.enxofre, perfil.enxofreIdeal),
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
    ...(() => {
      const relCaMg = calcularRelacao(analise.calcio, analise.magnesio);
      const relMgK = calcularRelacao(analise.magnesio, analise.potassio);
      const relCaMgK = calcularRelacao(
        analise.calcio !== null && analise.magnesio !== null ? analise.calcio + analise.magnesio : null,
        analise.potassio,
      );
      return [
        {
          parametro: "Relação Ca/Mg",
          valorMedido: relCaMg === null ? null : arred2(relCaMg),
          faixaIdealMin: perfil.relacaoCaMgIdeal,
          faixaIdealMax: null,
          status: classificarMinimoIdeal(relCaMg, perfil.relacaoCaMgIdeal),
        },
        {
          parametro: "Relação Mg/K",
          valorMedido: relMgK === null ? null : arred2(relMgK),
          faixaIdealMin: perfil.relacaoMgKIdeal,
          faixaIdealMax: null,
          status: classificarMinimoIdeal(relMgK, perfil.relacaoMgKIdeal),
        },
        {
          parametro: "Relação (Ca+Mg)/K",
          valorMedido: relCaMgK === null ? null : arred2(relCaMgK),
          faixaIdealMin: perfil.relacaoCaMgKIdeal,
          faixaIdealMax: null,
          status: classificarMinimoIdeal(relCaMgK, perfil.relacaoCaMgKIdeal),
        },
      ];
    })(),
    ...([
      ["boro", "Boro - B (mg/dm³)"],
      ["cobre", "Cobre - Cu (mg/dm³)"],
      ["ferro", "Ferro - Fe (mg/dm³)"],
      ["manganes", "Manganês - Mn (mg/dm³)"],
      ["zinco", "Zinco - Zn (mg/dm³)"],
    ] as const).map(([chave, rotulo]) => {
      const valorMedido = numeroDoJson(analise.micronutrientes, chave);
      const faixaIdealMin = numeroDoJson(perfil.micronutrientesIdeais, chave);
      return {
        parametro: rotulo,
        valorMedido,
        faixaIdealMin,
        faixaIdealMax: null,
        status: classificarMinimoIdeal(valorMedido, faixaIdealMin),
      };
    }),
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
