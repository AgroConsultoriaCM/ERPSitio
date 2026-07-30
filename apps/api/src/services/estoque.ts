import type { Prisma } from "@erpsitio/db";
import { AppError } from "../lib/errors.js";

const arredondar = (v: number, casas = 4) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

export interface ConsumoDeLote {
  loteId: string;
  quantidade: number;
  precoUnitario: number;
  custo: number;
}

export interface ResultadoConsumo {
  quantidadeConsumida: number;
  custoTotal: number;
  custoUnitarioMedio: number;
  consumos: ConsumoDeLote[];
}

/**
 * Retira `quantidade` do estoque de um insumo e devolve o custo real.
 *
 * - Com `loteIdPreferido`, consome daquele lote especifico (o usuario pode
 *   atrelar o uso a uma compra) e so recorre aos demais se ele nao cobrir.
 * - Sem lote informado, consome em FIFO (lote mais antigo primeiro), que e o
 *   que mais se aproxima do giro real de defensivo/fertilizante.
 * - Se o saldo em lotes nao cobrir tudo, o excedente sai sem custo conhecido
 *   e fica registrado - assim o estoque nao trava a operacao de campo por
 *   causa de compra que ainda nao foi lancada.
 *
 * Deve ser chamada dentro de uma transacao: atualiza `quantidadeRestante`.
 */
export async function consumirDoEstoque(
  tx: Prisma.TransactionClient,
  params: {
    insumoId: string;
    propriedadeId: string;
    quantidade: number;
    loteIdPreferido?: string | null;
  },
): Promise<ResultadoConsumo> {
  const { insumoId, propriedadeId, quantidade, loteIdPreferido } = params;

  if (quantidade <= 0) {
    return { quantidadeConsumida: 0, custoTotal: 0, custoUnitarioMedio: 0, consumos: [] };
  }

  const lotes = await tx.loteInsumo.findMany({
    where: { insumoId, propriedadeId, quantidadeRestante: { gt: 0 } },
    orderBy: { data: "asc" },
  });

  // lote escolhido pelo usuario vai para o inicio da fila
  const ordenados = loteIdPreferido
    ? [
        ...lotes.filter((l) => l.id === loteIdPreferido),
        ...lotes.filter((l) => l.id !== loteIdPreferido),
      ]
    : lotes;

  let restante = quantidade;
  let custoTotal = 0;
  const consumos: ConsumoDeLote[] = [];

  for (const lote of ordenados) {
    if (restante <= 0) break;
    const usar = Math.min(restante, lote.quantidadeRestante);
    const custo = arredondar(usar * lote.precoUnitario, 2);

    await tx.loteInsumo.update({
      where: { id: lote.id },
      data: { quantidadeRestante: arredondar(lote.quantidadeRestante - usar) },
    });

    consumos.push({
      loteId: lote.id,
      quantidade: arredondar(usar),
      precoUnitario: lote.precoUnitario,
      custo,
    });
    custoTotal = arredondar(custoTotal + custo, 2);
    restante = arredondar(restante - usar);
  }

  const consumidoDeLotes = arredondar(quantidade - restante);
  const custoUnitarioMedio =
    consumidoDeLotes > 0 ? arredondar(custoTotal / consumidoDeLotes, 4) : 0;

  return {
    // a quantidade usada e sempre a informada: o que faltou em lote saiu
    // do estoque mesmo assim, apenas sem custo atribuido
    quantidadeConsumida: quantidade,
    custoTotal,
    custoUnitarioMedio,
    consumos,
  };
}

/**
 * Devolve ao estoque o que sobrou (usado quando uma operacao e corrigida ou
 * excluida). Repoe nos lotes de onde saiu, na ordem inversa.
 */
export async function estornarConsumo(
  tx: Prisma.TransactionClient,
  movimentacoes: { loteId: string | null; quantidade: number }[],
) {
  for (const mov of movimentacoes) {
    if (!mov.loteId) continue;
    const lote = await tx.loteInsumo.findUnique({ where: { id: mov.loteId } });
    if (!lote) continue;
    await tx.loteInsumo.update({
      where: { id: lote.id },
      data: {
        quantidadeRestante: arredondar(
          Math.min(lote.quantidade, lote.quantidadeRestante + mov.quantidade),
        ),
      },
    });
  }
}

export function validarQuantidadesPulverizacao(levada: number, retornada: number) {
  if (retornada > levada) {
    throw new AppError(
      "A quantidade devolvida não pode ser maior que a quantidade levada para o campo.",
      400,
    );
  }
  return arredondar(levada - retornada);
}
