import type { PrismaClient, Prisma } from "@erpsitio/db";
import { AppError } from "../lib/errors.js";
import type { AmostraLida, TipoLaudo } from "./analiseLaudo.js";

/**
 * Da amostra lida ate a analise gravada no talhao.
 *
 * O ciclo e o mesmo das notas fiscais, que o produtor ja conhece: o arquivo
 * chega PENDENTE, ele confere os numeros, diz a que talhao (ou lote de
 * composto) cada amostra pertence, e so entao vira analise. Pode tambem
 * ignorar - laudo de outra propriedade, duplicado, enviado por engano.
 *
 * NADA e gravado em talhao sem confirmacao. Analise errada vira adubacao
 * errada, que vira prejuizo no campo - por isso a conferencia nao e opcional.
 */

/** Texto comparavel: sem acento, sem caixa, sem pontuacao e sem espaco duplo. */
function chaveComparacao(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Quanto duas identificacoes se parecem, de 0 a 1.
 *
 * Compara palavra a palavra, nao letra a letra: "LIMAO NOVO" e "Limão Novo"
 * dao 1; "LIMAO NOVO" e "Limao Anao" dao 0,5, que nao basta para sugerir.
 * Proposital ser conservador - sugestao errada aceita sem olhar poe a analise
 * no talhao errado, e isso e pior que nao sugerir nada.
 */
export function semelhanca(a: string, b: string): number {
  const pa = chaveComparacao(a).split(" ").filter(Boolean);
  const pb = chaveComparacao(b).split(" ").filter(Boolean);
  if (pa.length === 0 || pb.length === 0) return 0;
  const iguais = pa.filter((p) => pb.includes(p)).length;
  return iguais / Math.max(pa.length, pb.length);
}

/** Abaixo disto nao sugere nada: melhor campo vazio que sugestao errada. */
const CORTE_SUGESTAO = 0.5;

export interface Sugestao {
  talhaoId: string;
  nome: string;
  confianca: number;
}

/**
 * Talhao provavel para a identificacao que veio no laudo.
 *
 * Funciona porque o produtor ja escreve o nome do talhao na coleta: os laudos
 * trazem "LIMAO NOVO", "ABACATE", "REFORMA". A sugestao poupa digitacao, mas
 * quem confirma e sempre o usuario.
 */
export function sugerirTalhao(
  identificacao: string | null,
  talhoes: { id: string; nome: string; codigo: string | null }[],
): Sugestao | null {
  if (!identificacao) return null;

  let melhor: Sugestao | null = null;
  for (const t of talhoes) {
    const alvos = [t.nome, t.codigo].filter((x): x is string => !!x);
    for (const alvo of alvos) {
      const pontos = semelhanca(identificacao, alvo);
      if (pontos > (melhor?.confianca ?? 0)) {
        melhor = { talhaoId: t.id, nome: t.nome, confianca: pontos };
      }
    }
  }
  return melhor && melhor.confianca >= CORTE_SUGESTAO ? melhor : null;
}

/** Chaves que cada tipo de laudo grava, e em que tabela. */
const CAMPOS_QUIMICA = [
  "ph", "materiaOrganica", "fosforo", "enxofre", "calcio", "magnesio",
  "potassio", "aluminio", "hAl", "somaBases", "ctc", "saturacaoBases",
  "saturacaoAluminio",
] as const;

const CAMPOS_FOLIAR = [
  "nitrogenio", "fosforo", "potassio", "calcio", "magnesio", "enxofre",
] as const;

const CAMPOS_FISICA = [
  "argila", "silte", "areiaTotal", "areiaMuitoGrossa", "areiaGrossa",
  "areiaMedia", "areiaFina", "areiaMuitoFina", "argilaDispersaAgua",
  "grauFloculacao", "grauDispersao",
] as const;

const CAMPOS_COMPOSTO = [
  "materiaOrganica", "carbonoOrganico", "nitrogenio", "p2o5Total", "k2o",
  "calcio", "magnesio", "enxofre", "ph", "umidade", "relacaoCN",
] as const;

const MICRONUTRIENTES = ["boro", "cobre", "ferro", "manganes", "zinco", "silicio"] as const;

function apenas(valores: Record<string, number>, chaves: readonly string[]) {
  const saida: Record<string, number> = {};
  for (const c of chaves) if (valores[c] != null) saida[c] = valores[c];
  return saida;
}

function micros(valores: Record<string, number>) {
  const saida = apenas(valores, MICRONUTRIENTES);
  return Object.keys(saida).length > 0 ? saida : null;
}

export interface DadosAmostraConfirmada {
  amostraId: string;
  /**
   * Para onde vai. Uma coleta pode valer para mais de um talhao (grid de
   * amostragem que cobre area maior que um talhao so) - cada um vira uma
   * analise propria, com os mesmos valores. Lista vazia e loteCompostoId
   * ausente = o usuario decidiu arquivar esta amostra.
   */
  talhaoIds?: string[];
  loteCompostoId?: string | null;
  /** Valores ja conferidos e eventualmente corrigidos na tela. */
  valores: Record<string, number>;
  dataColeta?: string | null;
  profundidade?: string | null;
}

/**
 * Grava a analise de UM talhao a partir dos valores conferidos. Chamada uma
 * vez por talhao marcado - a mesma coleta pode gerar varias analises
 * identicas em talhoes diferentes.
 *
 * MICRO nao cria analise propria: ela COMPLEMENTA a quimica do mesmo talhao e
 * data, entrando no campo de micronutrientes. Criar uma analise separada so
 * com boro e zinco deixaria a tela do talhao com duas linhas para a mesma
 * coleta, e nenhuma delas completa.
 */
async function gravarAnaliseNoTalhao(
  prisma: Prisma.TransactionClient,
  tipo: TipoLaudo,
  talhaoId: string,
  base: { propriedadeId: string; dataColeta: Date; laboratorio: string | undefined },
  valores: Record<string, number>,
  profundidade: string | null,
): Promise<void> {
  if (tipo === "FISICA") {
    await prisma.analiseFisicaSolo.create({
      data: { ...base, talhaoId, profundidadeCm: profundidade ?? undefined, ...apenas(valores, CAMPOS_FISICA) },
    });
  } else if (tipo === "FOLIAR") {
    await prisma.analiseFoliar.create({
      data: { ...base, talhaoId, ...apenas(valores, CAMPOS_FOLIAR), micronutrientes: micros(valores) ?? undefined },
    });
  } else if (tipo === "MICRO") {
    // Procura a quimica da MESMA coleta para completar, em vez de criar uma
    // analise so de micronutrientes.
    const janela = 45 * 864e5;
    const quimica = await prisma.analiseSolo.findFirst({
      where: {
        talhaoId,
        dataColeta: {
          gte: new Date(base.dataColeta.getTime() - janela),
          lte: new Date(base.dataColeta.getTime() + janela),
        },
      },
      orderBy: { dataColeta: "desc" },
    });
    if (quimica) {
      await prisma.analiseSolo.update({
        where: { id: quimica.id },
        data: { micronutrientes: micros(valores) ?? undefined },
      });
    } else {
      await prisma.analiseSolo.create({
        data: {
          ...base,
          talhaoId,
          profundidadeCm: profundidade ?? undefined,
          micronutrientes: micros(valores) ?? undefined,
        },
      });
    }
  } else {
    await prisma.analiseSolo.create({
      data: {
        ...base,
        talhaoId,
        profundidadeCm: profundidade ?? undefined,
        ...apenas(valores, CAMPOS_QUIMICA),
        micronutrientes: micros(valores) ?? undefined,
      },
    });
  }
}

/**
 * Tudo numa transacao so: se uma amostra no meio do laudo falhar (unidade
 * estranha, talhao invalido...), nenhuma das anteriores fica gravada com a
 * amostra ainda marcada como pendente - ou entra o laudo inteiro, ou nao
 * entra nada. Sem isso, um erro na segunda amostra deixava a primeira com
 * AmostraLaudo.talhaoIds preenchido mas SEM a analise correspondente criada,
 * e reabrir para tentar de novo duplicava o que ja tinha ido.
 */
export async function confirmarAmostras(
  prisma: PrismaClient,
  propriedadeId: string,
  usuarioId: string,
  laudoId: string,
  amostras: DadosAmostraConfirmada[],
): Promise<{ gravadas: number; arquivadas: number }> {
  return prisma.$transaction(async (tx) => {
    const laudo = await tx.laudoImportado.findFirst({
      where: { id: laudoId, propriedadeId },
      include: { amostras: true },
    });
    if (!laudo) throw new AppError("Laudo não encontrado.", 404);
    if (laudo.situacao === "IMPORTADO") {
      throw new AppError("Este laudo já foi importado.", 409);
    }

    let gravadas = 0;
    let arquivadas = 0;
    // A tela deixa corrigir a data de coleta antes de confirmar - guarda a
    // correcao no laudo tambem, senao reabrir depois volta para a data
    // errada que a planilha trouxe.
    let dataColetaCorrigida: Date | null = null;

    for (const dados of amostras) {
      const amostra = laudo.amostras.find((a) => a.id === dados.amostraId);
      if (!amostra) continue;

      const talhaoIds = dados.talhaoIds ?? [];
      const data = dados.dataColeta
        ? new Date(dados.dataColeta)
        : (laudo.dataColeta ?? new Date());
      if (dados.dataColeta) dataColetaCorrigida = data;
      const profundidade = dados.profundidade ?? amostra.profundidade;

      // Guarda o que o usuario conferiu, mesmo se decidir arquivar: se ele
      // reabrir depois, os numeros corrigidos continuam la.
      await tx.amostraLaudo.update({
        where: { id: amostra.id },
        data: {
          valores: dados.valores,
          profundidade,
          talhaoIds,
          loteCompostoId: dados.loteCompostoId ?? null,
        },
      });

      if (talhaoIds.length === 0 && !dados.loteCompostoId) {
        arquivadas++;
        continue;
      }

      const base = { propriedadeId, dataColeta: data, laboratorio: laudo.cliente ?? undefined };

      if (dados.loteCompostoId) {
        await tx.analiseComposto.create({
          data: {
            ...base,
            loteId: dados.loteCompostoId,
            ...apenas(dados.valores, CAMPOS_COMPOSTO),
            micronutrientes: micros(dados.valores) ?? undefined,
          },
        });
        gravadas++;
        continue;
      }

      for (const talhaoId of talhaoIds) {
        await gravarAnaliseNoTalhao(tx, laudo.tipo, talhaoId, base, dados.valores, profundidade);
        gravadas++;
      }
    }

    await tx.laudoImportado.update({
      where: { id: laudo.id },
      data: {
        situacao: "IMPORTADO",
        importadoEm: new Date(),
        importadoPorId: usuarioId,
        dataColeta: dataColetaCorrigida ?? undefined,
      },
    });

    return { gravadas, arquivadas };
  });
}

export const TIPOS_QUE_VAO_PARA_TALHAO: TipoLaudo[] = ["QUIMICA", "FISICA", "MICRO", "FOLIAR"];

export function rotuloTipo(tipo: TipoLaudo): string {
  return {
    QUIMICA: "Química do solo",
    FISICA: "Física do solo",
    MICRO: "Micronutrientes do solo",
    FOLIAR: "Foliar (tecido vegetal)",
    ORGANICO: "Composto orgânico",
  }[tipo];
}

export type { AmostraLida };
