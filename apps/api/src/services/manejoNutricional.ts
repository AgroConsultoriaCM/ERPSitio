import type { PrismaClient } from "@erpsitio/db";
import { sateliteConfigurado } from "./satelite.js";
import { leiturasArmazenadas } from "./leituraSatelite.js";
import { apenasValidas, type LeituraSatelite } from "./notaTalhao.js";
import { classificarStatusGeralSolo, type StatusGeral } from "./recomendacaoSolo.js";

/**
 * Manejo nutricional: junta, por talhao, tres coisas que hoje vivem separadas.
 *
 *   1. um ano de OSAVI     - como o vigor se comportou
 *   2. ultimas analises    - o que o laboratorio disse do solo e da folha
 *   3. adubacoes do periodo - o que foi de fato aplicado, solo e foliar
 *
 * O QUE ESTE RELATORIO FAZ E NAO FAZ:
 *
 * Ele poe as tres coisas na mesma linha do tempo e aponta lacunas objetivas
 * (analise vencida, talhao sem adubacao, vigor caindo). NAO afirma que uma
 * adubacao causou uma subida de vigor - entre as duas ha chuva, colheita, poda
 * e florada, e atribuir causa a partir de duas curvas seria irresponsavel.
 * A correlacao e apresentada para o agronomo julgar, nao concluida por conta.
 */

/** Depois disso a analise de solo perde valor de decisao para citros. */
const MESES_VALIDADE_SOLO = 18;
const MESES_VALIDADE_FOLIAR = 12;

function inicioDoMes(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Inicio da janela do grafico: o MESMO MES do ano passado. Assim a janela tem
 * sempre 13 meses (o mes vigente aparece nas duas pontas, este ano e no ano
 * passado) e da para comparar agosto com agosto, nao agosto com um "12 meses
 * atras" que desliza de dia em dia.
 */
function inicioJanelaTrezeMeses(agora: Date): Date {
  const inicio = inicioDoMes(agora);
  inicio.setUTCMonth(inicio.getUTCMonth() - 12);
  return inicio;
}

export interface AdubacaoResumo {
  data: string;
  tipoAtividade: string;
  produtos: { nome: string; quantidade: number; unidade: string; foliar: boolean }[];
  temFoliar: boolean;
  temSolo: boolean;
}

export interface AlertaNutricional {
  gravidade: "atencao" | "critico";
  mensagem: string;
}

export interface TalhaoNutricional {
  talhaoId: string;
  nome: string;
  codigo: string | null;
  areaHa: number | null;
  cultura: string | null;
  serieOsavi: LeituraSatelite[];
  osaviMedioAno: number | null;
  variacaoAnual: number | null;
  analiseSolo: Record<string, unknown> | null;
  analiseFoliar: Record<string, unknown> | null;
  /** % de variação de cada nutriente frente à análise anterior (a penúltima). */
  variacaoSolo: Record<string, number>;
  variacaoFoliar: Record<string, number>;
  /** Data da análise usada como comparação (a penúltima) - para a tela mostrar contra o que está variando. */
  dataAnaliseSoloAnterior: string | null;
  dataAnaliseFoliarAnterior: string | null;
  /** Resumo da última análise de solo x perfil da cultura - a bolinha do canto do bloco. */
  statusGeralSolo: StatusGeral;
  adubacoes: AdubacaoResumo[];
  alertas: AlertaNutricional[];
}

const arred = (v: number, casas = 3) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

function mesesDesde(data: Date): number {
  return Math.floor((Date.now() - data.getTime()) / (30 * 864e5));
}

/**
 * Variacao do vigor: compara a leitura mais recente com a do MESMO MES, um
 * ano antes - nao a ponta esquerda da janela, que desliza a cada mes e faria
 * o "resultado no periodo" comparar meses diferentes ao longo do ano.
 *
 * Sem leitura para o mesmo mes do ano passado (talhao novo, ou mes sem cena
 * limpa em nenhum dos dois anos), devolve null em vez de comparar com outro
 * mes qualquer e chamar de "ano passado" o que nao e.
 */
export function variacaoNoPeriodo(leituras: LeituraSatelite[]): number | null {
  const validas = apenasValidas(leituras);
  if (validas.length === 0) return null;

  const ultima = validas[validas.length - 1];
  const mesUltima = inicioDoMes(new Date(ultima.data));
  const mesAnoPassado = new Date(mesUltima);
  mesAnoPassado.setUTCMonth(mesAnoPassado.getUTCMonth() - 12);

  const anoPassado = validas.find(
    (l) => inicioDoMes(new Date(l.data)).getTime() === mesAnoPassado.getTime(),
  );
  if (!anoPassado) return null;

  const base = anoPassado.osaviMedio as number;
  if (base === 0) return null;
  return arred((((ultima.osaviMedio as number) - base) / base) * 100, 1);
}

export function montarAlertas(dados: {
  analiseSolo: { dataColeta: Date } | null;
  analiseFoliar: { dataColeta: Date } | null;
  adubacoes: AdubacaoResumo[];
  variacaoAnual: number | null;
}): AlertaNutricional[] {
  const alertas: AlertaNutricional[] = [];

  if (!dados.analiseSolo) {
    alertas.push({ gravidade: "critico", mensagem: "nunca teve análise de solo" });
  } else {
    const meses = mesesDesde(dados.analiseSolo.dataColeta);
    if (meses >= MESES_VALIDADE_SOLO) {
      alertas.push({
        gravidade: meses >= MESES_VALIDADE_SOLO * 1.5 ? "critico" : "atencao",
        mensagem: `análise de solo com ${meses} meses`,
      });
    }
  }

  if (!dados.analiseFoliar) {
    alertas.push({ gravidade: "atencao", mensagem: "nunca teve análise foliar" });
  } else {
    const meses = mesesDesde(dados.analiseFoliar.dataColeta);
    if (meses >= MESES_VALIDADE_FOLIAR) {
      alertas.push({ gravidade: "atencao", mensagem: `análise foliar com ${meses} meses` });
    }
  }

  const temSolo = dados.adubacoes.some((a) => a.temSolo);
  const temFoliar = dados.adubacoes.some((a) => a.temFoliar);
  if (dados.adubacoes.length === 0) {
    alertas.push({ gravidade: "critico", mensagem: "nenhuma adubação lançada em 12 meses" });
  } else {
    if (!temSolo) alertas.push({ gravidade: "atencao", mensagem: "sem adubação de solo no período" });
    if (!temFoliar) alertas.push({ gravidade: "atencao", mensagem: "sem nutrição foliar no período" });
  }

  // Vigor caindo com nutricao em dia continua sendo motivo de olhar - pode ser
  // praga, compactacao ou agua, e o relatorio nao tem como distinguir.
  if (dados.variacaoAnual != null && dados.variacaoAnual <= -10) {
    alertas.push({
      gravidade: dados.variacaoAnual <= -20 ? "critico" : "atencao",
      mensagem: `vigor ${Math.abs(dados.variacaoAnual).toFixed(0)}% menor que no início do período`,
    });
  }

  return alertas;
}

/** Micronutrientes ficam num JSON (mesma chave nos dois tipos de análise). */
const MICRONUTRIENTES = ["boro", "cobre", "ferro", "manganes", "zinco", "silicio", "molibdenio"] as const;

/** Nutrientes com % de variação mostrada em cada bloco da tela: todos os macro e micro da análise, mais os calculados. */
const NUTRIENTES_SOLO_COMPARADOS = [
  "ph", "materiaOrganica", "fosforo", "enxofre", "potassio", "calcio", "magnesio",
  "aluminio", "hAl", "somaBases", "ctc", "saturacaoBases", "saturacaoAluminio",
  ...MICRONUTRIENTES,
] as const;
const NUTRIENTES_FOLIAR_COMPARADOS = [
  "nitrogenio", "fosforo", "potassio", "calcio", "magnesio", "enxofre",
  ...MICRONUTRIENTES,
] as const;

/**
 * Achata o JSON de micronutrientes para dentro do objeto da análise, para o
 * resto do código (variação, tela) tratar "boro" igual a "fósforo" - uma
 * chave no mesmo objeto, sem precisar saber que uma vem de coluna e outra de
 * JSON.
 */
function comMicronutrientesAchatados<T extends { micronutrientes?: unknown }>(
  analise: T | null,
): (Record<string, unknown> & T) | null {
  if (!analise) return null;
  const micros = (analise.micronutrientes ?? {}) as Record<string, unknown>;
  return { ...analise, ...micros };
}

/**
 * % de variação de cada nutriente frente à ANÁLISE ANTERIOR (a penúltima
 * coleta, seja qual for a data dela). Vermelho na tela quando caiu, verde
 * quando subiu - o sinal de que a fertilidade está melhorando ou piorando
 * de uma coleta para a outra, não só o número absoluto mais recente. Não é
 * "frente ao ano passado": o solo pode ser reamostrado fora de um ciclo
 * anual fixo, e comparar com a coleta imediatamente anterior é o que
 * responde "subiu ou desceu desde a última vez que olhamos".
 */
function variacaoPorNutriente(
  atual: Record<string, unknown> | null,
  anterior: Record<string, unknown> | null,
  chaves: readonly string[],
): Record<string, number> {
  const saida: Record<string, number> = {};
  if (!atual || !anterior) return saida;
  for (const chave of chaves) {
    const a = atual[chave];
    const b = anterior[chave];
    if (typeof a === "number" && typeof b === "number" && b !== 0) {
      saida[chave] = arred(((a - b) / b) * 100, 1);
    }
  }
  return saida;
}

export async function montarManejoNutricional(
  prisma: PrismaClient,
  propriedadeId: string,
): Promise<{
  talhoes: TalhaoNutricional[];
  satelite: boolean;
  ultimaSincronizacao: string | null;
  fonte: string;
}> {
  const agora = new Date();
  const desde = inicioJanelaTrezeMeses(agora);

  const talhoes = await prisma.talhao.findMany({
    where: { propriedadeId },
    select: {
      id: true,
      nome: true,
      codigo: true,
      areaHa: true,
      poligono: true,
      cultura: { select: { nome: true } },
    },
    orderBy: [{ codigo: "asc" }, { nome: "asc" }],
  });

  // Perfil de correcao por cultura, para a bolinha de status do bloco de
  // solo. Vale pela ESPECIE (culturaNome: "Limão", "Abacate"), nao por uma
  // Cultura especifica - ver comentario no schema de PerfilCorrecaoSolo. Uma
  // consulta so para a propriedade inteira; o mais recente de cada nome
  // vence se por acaso houver mais de um perfil cadastrado para ele.
  const perfis = await prisma.perfilCorrecaoSolo.findMany({
    where: { propriedadeId },
    orderBy: { createdAt: "desc" },
  });
  const perfilPorCultura = new Map<string, (typeof perfis)[number]>();
  for (const p of perfis) {
    if (!perfilPorCultura.has(p.culturaNome)) perfilPorCultura.set(p.culturaNome, p);
  }

  // As adubacoes vem numa consulta so, para nao bater no banco por talhao.
  const atividades = await prisma.atividade.findMany({
    where: {
      propriedadeId,
      data: { gte: desde },
      insumos: {
        some: {
          insumo: { funcoes: { hasSome: ["FERTILIZANTE_SOLO", "NUTRICAO_FOLIAR"] } },
        },
      },
    },
    select: {
      data: true,
      tipoAtividade: { select: { nome: true } },
      talhoes: { select: { talhaoId: true } },
      insumos: {
        select: {
          quantidade: true,
          unidade: true,
          insumo: { select: { nome: true, funcoes: true } },
        },
      },
    },
    orderBy: { data: "desc" },
  });

  const [solos, foliares] = await Promise.all([
    prisma.analiseSolo.findMany({
      where: { propriedadeId },
      orderBy: { dataColeta: "desc" },
    }),
    prisma.analiseFoliar.findMany({
      where: { propriedadeId },
      orderBy: { dataColeta: "desc" },
    }),
  ]);

  const temSatelite = sateliteConfigurado();

  // Ultima leitura gravada de QUALQUER talhao, para a tela mostrar "sincronizado
  // em ...". null quando nunca rodou sincronizacao nenhuma.
  const ultimaLeitura = await prisma.leituraSatelite.findFirst({
    where: { propriedadeId },
    orderBy: { periodo: "desc" },
    select: { periodo: true },
  });

  const resultado: TalhaoNutricional[] = [];

  for (const t of talhoes) {
    // So le o banco - nao ha chamada externa aqui. Quem alimenta a tabela e o
    // agendador semanal (domingo de madrugada, ver agendador.ts). Ja limpa
    // (sem cena vazia nem picos/vales isolados - ver apenasValidas em
    // notaTalhao.ts) para o grafico nao precisar refazer esse trabalho.
    const serieOsaviBruta: LeituraSatelite[] = await leiturasArmazenadas(prisma, t.id, desde);
    const serieOsavi = apenasValidas(serieOsaviBruta);

    const osaviMedioAno =
      serieOsavi.length > 0
        ? arred(serieOsavi.reduce((s, l) => s + (l.osaviMedio as number), 0) / serieOsavi.length)
        : null;

    const adubacoes: AdubacaoResumo[] = atividades
      .filter((a) => a.talhoes.some((x) => x.talhaoId === t.id))
      .map((a) => {
        const produtos = a.insumos
          .filter((i) =>
            i.insumo.funcoes.some((f) => f === "FERTILIZANTE_SOLO" || f === "NUTRICAO_FOLIAR"),
          )
          .map((i) => ({
            nome: i.insumo.nome,
            quantidade: i.quantidade,
            unidade: i.unidade,
            foliar: i.insumo.funcoes.includes("NUTRICAO_FOLIAR"),
          }));
        return {
          data: a.data.toISOString(),
          tipoAtividade: a.tipoAtividade?.nome ?? "Operação",
          produtos,
          temFoliar: produtos.some((p) => p.foliar),
          temSolo: produtos.some((p) => !p.foliar),
        };
      });

    // Historico completo deste talhao, ordenado do mais novo para o mais
    // velho (as duas consultas la em cima ja trazem assim) - a penultima
    // posicao e a analise anterior, seja qual for a data dela.
    const solosDoTalhao = solos.filter((s) => s.talhaoId === t.id);
    const foliaresDoTalhao = foliares.filter((f) => f.talhaoId === t.id);
    const analiseSolo = solosDoTalhao[0] ?? null;
    const analiseFoliar = foliaresDoTalhao[0] ?? null;
    const soloAnterior = solosDoTalhao[1] ?? null;
    const foliarAnterior = foliaresDoTalhao[1] ?? null;
    const variacaoAnual = variacaoNoPeriodo(serieOsavi);

    const analiseSoloAchatada = comMicronutrientesAchatados(analiseSolo);
    const analiseFoliarAchatada = comMicronutrientesAchatados(analiseFoliar);

    const perfil = t.cultura?.nome ? (perfilPorCultura.get(t.cultura.nome) ?? null) : null;
    const statusGeralSolo = analiseSolo ? classificarStatusGeralSolo(analiseSolo, perfil) : "SEM_REFERENCIA";

    resultado.push({
      talhaoId: t.id,
      nome: t.nome,
      codigo: t.codigo,
      areaHa: t.areaHa,
      cultura: t.cultura?.nome ?? null,
      serieOsavi,
      osaviMedioAno,
      variacaoAnual,
      analiseSolo: analiseSoloAchatada,
      analiseFoliar: analiseFoliarAchatada,
      variacaoSolo: variacaoPorNutriente(
        analiseSoloAchatada,
        comMicronutrientesAchatados(soloAnterior),
        NUTRIENTES_SOLO_COMPARADOS,
      ),
      variacaoFoliar: variacaoPorNutriente(
        analiseFoliarAchatada,
        comMicronutrientesAchatados(foliarAnterior),
        NUTRIENTES_FOLIAR_COMPARADOS,
      ),
      dataAnaliseSoloAnterior: soloAnterior?.dataColeta.toISOString() ?? null,
      dataAnaliseFoliarAnterior: foliarAnterior?.dataColeta.toISOString() ?? null,
      statusGeralSolo,
      adubacoes,
      alertas: montarAlertas({ analiseSolo, analiseFoliar, adubacoes, variacaoAnual }),
    });
  }

  return {
    talhoes: resultado,
    satelite: temSatelite,
    ultimaSincronizacao: ultimaLeitura?.periodo.toISOString() ?? null,
    fonte: `Contains modified Copernicus Sentinel data ${agora.getFullYear()}`,
  };
}
