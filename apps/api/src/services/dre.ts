import type { PrismaClient } from "@erpsitio/db";
import { comDerivados } from "../routes/colheitas.routes.js";
import { ratearPorPeso } from "./rateio.js";

const arredondar = (v: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

export interface ParametrosDre {
  propriedadeId: string;
  dataInicio: Date;
  dataFim: Date;
  /** Quando ausente, o DRE e do sitio inteiro. */
  talhaoId?: string;
}

export interface CategoriaValor {
  categoria: string;
  valor: number;
}

export interface LinhaTalhaoDre {
  talhaoId: string;
  nome: string;
  codigo: string | null;
  areaHa: number | null;
  receita: number;
  custoDireto: number;
  despesasRateadas: number;
  resultado: number;
}

export interface ResultadoDre {
  periodo: { inicio: string; fim: string };
  talhao: { id: string; nome: string; codigo: string | null; areaHa: number | null } | null;
  receita: {
    colheitas: number;
    caixas: number;
  };
  custos: {
    // Mao de obra + insumo das operacoes (pulverizacao, adubacao...), ja
    // rateado por talhao no momento do lancamento (AtividadeTalhao.custoRateado).
    operacoes: number;
    // Mao de obra da colheita em si (Colheita.custoColheita), separado das
    // operacoes porque nasce de um lancamento diferente.
    colheita: number;
    // Despesa lancada direto neste talhao (so existe na visao por talhao).
    despesasProprias: number;
    // Despesa geral do sitio (sem talhao), rateada por area. Na visao global
    // e o total das despesas gerais, sem rateio nenhum (o sitio e "um talhao só").
    despesasRateadas: number;
    total: number;
  };
  resultado: number;
  margemPercentual: number | null;
  despesasPorCategoria: CategoriaValor[];
  // So preenchido na visao global: permite comparar talhao a talhao.
  porTalhao: LinhaTalhaoDre[] | null;
}

/**
 * Monta o DRE (receita - custo direto - despesa) de um periodo, global ou de
 * um talhao especifico. Receita e custo direto vem de Colheita/Atividade, ja
 * lancados no dia a dia - o unico dado novo e a despesa geral (Despesa),
 * porque essa nao nasce de nenhuma operacao de campo.
 */
export async function calcularDre(prisma: PrismaClient, params: ParametrosDre): Promise<ResultadoDre> {
  const { propriedadeId, dataInicio, dataFim, talhaoId } = params;
  const filtroData = { gte: dataInicio, lte: dataFim };

  const todosTalhoes = await prisma.talhao.findMany({
    where: { propriedadeId },
    select: { id: true, nome: true, codigo: true, areaHa: true },
  });

  let talhaoAlvo: (typeof todosTalhoes)[number] | null = null;
  if (talhaoId) {
    talhaoAlvo = todosTalhoes.find((t) => t.id === talhaoId) ?? null;
  }

  const [colheitas, atividadesTalhao, despesas] = await Promise.all([
    prisma.colheita.findMany({
      where: { propriedadeId, data: filtroData, talhaoId: talhaoId ?? undefined },
      include: {
        talhao: {
          select: { areaHa: true, cultura: { select: { pesoCaixaKg: true } } },
        },
      },
    }),
    prisma.atividadeTalhao.findMany({
      where: {
        talhaoId: talhaoId ?? undefined,
        atividade: { propriedadeId, data: filtroData },
      },
      select: { talhaoId: true, custoRateado: true },
    }),
    // Despesas: sempre busca TODAS as do periodo (proprias + gerais), o
    // filtro por talhao acontece depois - a geral precisa ser vista para
    // ratear entre todos os talhoes, nao so o pedido.
    prisma.despesa.findMany({
      where: { propriedadeId, data: filtroData },
      select: { talhaoId: true, categoria: true, valor: true },
    }),
  ]);

  const receitaColheitas = arredondar(
    colheitas.reduce((soma, c) => soma + (comDerivados(c).valorVendaTotal ?? 0), 0),
  );
  const caixas = colheitas.reduce((soma, c) => soma + c.quantidadeCaixas, 0);
  const custoColheita = arredondar(colheitas.reduce((soma, c) => soma + (c.custoColheita ?? 0), 0));
  const custoOperacoes = arredondar(
    atividadesTalhao.reduce((soma, a) => soma + (a.custoRateado ?? 0), 0),
  );

  const despesasGerais = despesas.filter((d) => !d.talhaoId);
  const despesasComTalhao = despesas.filter((d) => d.talhaoId);
  const totalDespesasGerais = despesasGerais.reduce((soma, d) => soma + d.valor, 0);

  // Rateio das despesas gerais por area, entre TODOS os talhoes - preciso do
  // sitio inteiro mesmo pedindo so um, para a proporcao ficar certa.
  const rateioGeral = ratearPorPeso(
    todosTalhoes.map((t) => ({ id: t.id, peso: t.areaHa ?? 0 })),
    totalDespesasGerais || null,
  );
  const rateioPorTalhao = new Map(rateioGeral.map((r) => [r.id, r.custoRateado ?? 0]));

  const despesasProprias = talhaoId
    ? arredondar(despesasComTalhao.filter((d) => d.talhaoId === talhaoId).reduce((s, d) => s + d.valor, 0))
    : arredondar(despesasComTalhao.reduce((s, d) => s + d.valor, 0));

  const despesasRateadas = talhaoId
    ? arredondar(rateioPorTalhao.get(talhaoId) ?? 0)
    : arredondar(totalDespesasGerais);

  const totalCustos = arredondar(custoOperacoes + custoColheita + despesasProprias + despesasRateadas);
  const resultado = arredondar(receitaColheitas - totalCustos);
  const margemPercentual = receitaColheitas > 0 ? arredondar((resultado / receitaColheitas) * 100) : null;

  const porCategoriaMap = new Map<string, number>();
  for (const d of despesas) {
    if (talhaoId && d.talhaoId && d.talhaoId !== talhaoId) continue;
    porCategoriaMap.set(d.categoria, (porCategoriaMap.get(d.categoria) ?? 0) + d.valor);
  }
  const despesasPorCategoria: CategoriaValor[] = Array.from(porCategoriaMap.entries())
    .map(([categoria, valor]) => ({ categoria, valor: arredondar(valor) }))
    .sort((a, b) => b.valor - a.valor);

  let porTalhao: LinhaTalhaoDre[] | null = null;
  if (!talhaoId) {
    const receitaPorTalhao = new Map<string, number>();
    for (const c of colheitas) {
      const v = comDerivados(c).valorVendaTotal ?? 0;
      receitaPorTalhao.set(c.talhaoId, (receitaPorTalhao.get(c.talhaoId) ?? 0) + v);
    }
    const custoColheitaPorTalhao = new Map<string, number>();
    for (const c of colheitas) {
      custoColheitaPorTalhao.set(c.talhaoId, (custoColheitaPorTalhao.get(c.talhaoId) ?? 0) + (c.custoColheita ?? 0));
    }
    const custoOpPorTalhao = new Map<string, number>();
    for (const a of atividadesTalhao) {
      custoOpPorTalhao.set(a.talhaoId, (custoOpPorTalhao.get(a.talhaoId) ?? 0) + (a.custoRateado ?? 0));
    }
    const despesaPropriaPorTalhao = new Map<string, number>();
    for (const d of despesasComTalhao) {
      if (!d.talhaoId) continue;
      despesaPropriaPorTalhao.set(d.talhaoId, (despesaPropriaPorTalhao.get(d.talhaoId) ?? 0) + d.valor);
    }

    porTalhao = todosTalhoes
      .map((t) => {
        const receita = arredondar(receitaPorTalhao.get(t.id) ?? 0);
        const custoDireto = arredondar(
          (custoOpPorTalhao.get(t.id) ?? 0) + (custoColheitaPorTalhao.get(t.id) ?? 0),
        );
        const rateada = arredondar((rateioPorTalhao.get(t.id) ?? 0) + (despesaPropriaPorTalhao.get(t.id) ?? 0));
        return {
          talhaoId: t.id,
          nome: t.nome,
          codigo: t.codigo,
          areaHa: t.areaHa,
          receita,
          custoDireto,
          despesasRateadas: rateada,
          resultado: arredondar(receita - custoDireto - rateada),
        };
      })
      .sort((a, b) => b.resultado - a.resultado);
  }

  return {
    periodo: { inicio: dataInicio.toISOString(), fim: dataFim.toISOString() },
    talhao: talhaoAlvo
      ? { id: talhaoAlvo.id, nome: talhaoAlvo.nome, codigo: talhaoAlvo.codigo, areaHa: talhaoAlvo.areaHa }
      : null,
    receita: { colheitas: receitaColheitas, caixas: arredondar(caixas) },
    custos: {
      operacoes: custoOperacoes,
      colheita: custoColheita,
      despesasProprias,
      despesasRateadas,
      total: totalCustos,
    },
    resultado,
    margemPercentual,
    despesasPorCategoria,
    porTalhao,
  };
}
