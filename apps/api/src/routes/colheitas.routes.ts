import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";
import type { PrismaClient } from "@erpsitio/db";

// Momento 1 - lancamento de campo (encarregado, diario)
const colheitaCampoSchema = z.object({
  clientId: z.string().min(1).optional(),
  talhaoId: z.string().uuid(),
  safraId: z.string().uuid().optional().nullable(),
  data: z.coerce.date(),
  quantidadeCaixas: z.number().positive(),
  executorId: z.string().uuid().optional().nullable(),
  valorPorCaixa: z.number().min(0).optional().nullable(),
  classificacao: z.string().optional(),
  observacoes: z.string().optional(),
  origem: z.enum(["WEB", "APP"]).default("WEB"),
});

/**
 * Peso da caixa usado quando a cultura do talhao nao esta cadastrada.
 *
 * Nao e uma regra de negocio: e o que o sistema fazia para todo mundo antes de
 * a unidade virar campo da cultura. Serve so para colheita em talhao sem
 * cultura definida continuar dando o mesmo numero de antes. Com a cultura
 * cadastrada, quem manda e o `pesoCaixaKg` dela.
 */
export const PESO_CAIXA_PADRAO_KG = 27.2;

// Momento 2 - complemento comercial (gestor, depois)
const colheitaComercialSchema = z.object({
  pesoTotalKg: z.number().min(0).optional().nullable(),
  pesoRefugoKg: z.number().min(0).optional().nullable(),
  precoCaixaBom: z.number().min(0).optional().nullable(),
  precoCaixaRefugo: z.number().min(0).optional().nullable(),
  valorTotalVenda: z.number().min(0).optional().nullable(),
  quantidadeCaixas: z.number().positive().optional(),
  valorPorCaixa: z.number().min(0).optional().nullable(),
  executorId: z.string().uuid().optional().nullable(),
  classificacao: z.string().optional(),
  observacoes: z.string().optional(),
  data: z.coerce.date().optional(),
});

const loteSchema = z.object({
  itens: z.array(colheitaCampoSchema).min(1).max(100),
});

const INCLUDE_COMPLETO = {
  // A cultura vem junto porque e ela que diz se o preco lancado e por caixa
  // ou por quilo (ver pesoCaixaKg em Cultura).
  talhao: {
    select: {
      id: true,
      nome: true,
      codigo: true,
      areaHa: true,
      cultura: { select: { id: true, nome: true, pesoCaixaKg: true } },
    },
  },
  executor: true,
  safra: true,
} as const;

const arredondar = (v: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

// Indicadores derivados - nunca digitados, sempre calculados a partir do que
// foi lancado no campo + o complemento comercial.
type ColheitaComRelacoes = Awaited<
  ReturnType<PrismaClient["colheita"]["findFirstOrThrow"]>
> & {
  talhao?: {
    areaHa: number | null;
    cultura?: { pesoCaixaKg: number | null } | null;
  } | null;
};

// Exportada para poder ser exercitada por fora (ver verificacoes/), sem subir
// servidor nem banco. E conta de dinheiro do usuario: precisa de prova.
export function comDerivados<T extends ColheitaComRelacoes>(c: T) {
  const kgPorCaixa =
    c.pesoTotalKg != null && c.quantidadeCaixas > 0
      ? arredondar(c.pesoTotalKg / c.quantidadeCaixas, 3)
      : null;

  const pesoLiquidoKg =
    c.pesoTotalKg != null ? arredondar(c.pesoTotalKg - (c.pesoRefugoKg ?? 0), 2) : null;

  const percentualRefugo =
    c.pesoTotalKg != null && c.pesoTotalKg > 0 && c.pesoRefugoKg != null
      ? arredondar((c.pesoRefugoKg / c.pesoTotalKg) * 100, 2)
      : null;

  // Receita por qualidade. A fruta e sempre pesada em quilos; o preco e que
  // muda de unidade conforme a cultura:
  //   limao  -> cultura com pesoCaixaKg (27,2): o preco e por caixa e vira
  //             preco do quilo dividindo por esse peso
  //   abacate -> cultura sem pesoCaixaKg: o preco lancado JA e por quilo,
  //             entao nao se divide nada
  // Talhao sem cultura cadastrada cai no peso padrao, que e o comportamento
  // que o sistema tinha antes de a unidade existir.
  const culturaCadastrada = c.talhao?.cultura !== undefined && c.talhao?.cultura !== null;
  const pesoCaixaKg = culturaCadastrada
    ? (c.talhao?.cultura?.pesoCaixaKg ?? null)
    : PESO_CAIXA_PADRAO_KG;

  // Divisor 1 = preco ja esta por quilo. Nunca divide por zero: peso de caixa
  // zerado seria erro de cadastro, e tratamos como "por quilo".
  const divisor = pesoCaixaKg != null && pesoCaixaKg > 0 ? pesoCaixaKg : 1;

  // Seis casas no preco do quilo: e a precisao com que a packing house
  // trabalha, e o sistema precisa fechar com o papel dela. Usar a divisao
  // inteira daria um numero mais "exato" que nao bate com a conferencia deles,
  // e discussao de centavo com quem compra a fruta nao vale a precisao extra.
  const precoKgBom = c.precoCaixaBom != null ? arredondar(c.precoCaixaBom / divisor, 6) : null;
  const precoKgRefugo =
    c.precoCaixaRefugo != null ? arredondar(c.precoCaixaRefugo / divisor, 6) : null;

  const valorVendaBom =
    precoKgBom != null && pesoLiquidoKg != null
      ? arredondar(pesoLiquidoKg * precoKgBom, 2)
      : null;

  const valorVendaRefugo =
    precoKgRefugo != null && c.pesoRefugoKg != null
      ? arredondar(c.pesoRefugoKg * precoKgRefugo, 2)
      : null;

  // Precos por qualidade mandam quando existem. Sem eles, vale o valor fechado
  // que era digitado antes - e o que preserva a receita dos lancamentos
  // antigos, em vez de zera-los.
  const temPrecoPorQualidade = valorVendaBom != null || valorVendaRefugo != null;
  const valorVendaTotal = temPrecoPorQualidade
    ? arredondar((valorVendaBom ?? 0) + (valorVendaRefugo ?? 0), 2)
    : (c.valorTotalVenda ?? null);

  const margem =
    valorVendaTotal != null ? arredondar(valorVendaTotal - (c.custoColheita ?? 0), 2) : null;

  const areaHa = c.talhao?.areaHa ?? null;
  const caixasPorHectare =
    areaHa && areaHa > 0 ? arredondar(c.quantidadeCaixas / areaHa, 2) : null;

  return {
    ...c,
    kgPorCaixa,
    pesoLiquidoKg,
    percentualRefugo,
    // Ja vem com as 6 casas da packing house; arredondar de novo aqui
    // esconderia justamente a precisao que o usuario quer conferir.
    precoKgBom,
    precoKgRefugo,
    valorVendaBom,
    valorVendaRefugo,
    valorVendaTotal,
    // null = o preco desta colheita e por quilo. A tela usa isto para rotular
    // o campo ("R$/cx de 27,2 kg" ou "R$/kg") sem precisar saber da cultura.
    pesoCaixaKg,
    margem,
    caixasPorHectare,
  };
}

async function criarColheita(
  prisma: PrismaClient,
  propriedadeId: string,
  dados: z.infer<typeof colheitaCampoSchema>,
) {
  if (dados.clientId) {
    const existente = await prisma.colheita.findUnique({ where: { clientId: dados.clientId } });
    if (existente) return { colheita: existente, criada: false };
  }

  const talhao = await prisma.talhao.findFirst({
    where: { id: dados.talhaoId, propriedadeId },
  });
  if (!talhao) throw new NaoEncontradoError("Talhão não encontrado");

  // Custo so existe quando ha valor por caixa (tipicamente empreiteiro).
  const custoColheita =
    dados.valorPorCaixa != null
      ? arredondar(dados.quantidadeCaixas * dados.valorPorCaixa)
      : null;

  const colheita = await prisma.colheita.create({
    data: {
      ...dados,
      executorId: dados.executorId ?? undefined,
      safraId: dados.safraId ?? undefined,
      valorPorCaixa: dados.valorPorCaixa ?? undefined,
      custoColheita,
      propriedadeId,
    },
  });
  return { colheita, criada: true };
}

export default async function colheitasRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("colheitas", "VER"));

  fastify.get("/colheitas", async (request) => {
    const query = request.query as {
      talhaoId?: string;
      executorId?: string;
      dataInicio?: string;
      dataFim?: string;
      pendentesComercial?: string;
    };

    const colheitas = await fastify.prisma.colheita.findMany({
      where: {
        propriedadeId: request.user.propriedadeId,
        talhaoId: query.talhaoId ?? undefined,
        executorId: query.executorId ?? undefined,
        // "pendentes" = ja colhidas mas ainda sem venda lancada. Precisa cobrir
        // as duas formas: os precos por qualidade (atual) e o valor fechado
        // (como era antes) - senao lancamento antigo com venda apareceria como
        // pendente, e vice-versa.
        ...(query.pendentesComercial === "true"
          ? { precoCaixaBom: null, precoCaixaRefugo: null, valorTotalVenda: null }
          : {}),
        data: {
          gte: query.dataInicio ? new Date(query.dataInicio) : undefined,
          lte: query.dataFim ? new Date(query.dataFim) : undefined,
        },
      },
      include: INCLUDE_COMPLETO,
      orderBy: { data: "desc" },
      take: 500,
    });

    return colheitas.map(comDerivados);
  });

  // Resumo por talhao - base para produtividade e custo de colheita
  fastify.get("/colheitas/resumo", async (request) => {
    const colheitas = await fastify.prisma.colheita.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      include: INCLUDE_COMPLETO,
    });

    const porTalhao = new Map<
      string,
      {
        talhaoId: string;
        nome: string;
        codigo: string | null;
        areaHa: number | null;
        caixas: number;
        custoColheita: number;
        receita: number;
        pesoTotalKg: number;
      }
    >();

    for (const bruta of colheitas) {
      // Passa pelo mesmo calculo da listagem: a receita do resumo tem de ser a
      // soma exata do que aparece linha a linha na tela, senao o total nao
      // fecha com as partes e o usuario perde a confianca no numero.
      const c = comDerivados(bruta);
      const atual = porTalhao.get(c.talhaoId) ?? {
        talhaoId: c.talhaoId,
        nome: bruta.talhao.nome,
        codigo: bruta.talhao.codigo,
        areaHa: bruta.talhao.areaHa,
        caixas: 0,
        custoColheita: 0,
        receita: 0,
        pesoTotalKg: 0,
      };
      atual.caixas += c.quantidadeCaixas;
      atual.custoColheita += c.custoColheita ?? 0;
      atual.receita += c.valorVendaTotal ?? 0;
      atual.pesoTotalKg += c.pesoTotalKg ?? 0;
      porTalhao.set(c.talhaoId, atual);
    }

    return [...porTalhao.values()].map((t) => ({
      ...t,
      caixas: arredondar(t.caixas),
      custoColheita: arredondar(t.custoColheita),
      receita: arredondar(t.receita),
      margem: arredondar(t.receita - t.custoColheita),
      caixasPorHectare: t.areaHa && t.areaHa > 0 ? arredondar(t.caixas / t.areaHa, 2) : null,
      kgPorCaixa: t.caixas > 0 && t.pesoTotalKg > 0 ? arredondar(t.pesoTotalKg / t.caixas, 3) : null,
    }));
  });

  fastify.post("/colheitas", async (request, reply) => {
    const dados = colheitaCampoSchema.parse(request.body);
    const { colheita, criada } = await criarColheita(
      fastify.prisma,
      request.user.propriedadeId,
      dados,
    );
    return reply.status(criada ? 201 : 200).send(colheita);
  });

  // Fila offline do app de campo, mesmo contrato do sync de operacoes.
  fastify.post("/colheitas/sync-lote", async (request, reply) => {
    const { itens } = loteSchema.parse(request.body);
    const resultados = [];
    for (const item of itens) {
      try {
        const { colheita, criada } = await criarColheita(
          fastify.prisma,
          request.user.propriedadeId,
          item,
        );
        resultados.push({
          clientId: item.clientId,
          id: colheita.id,
          status: criada ? "criado" : "ja_existia",
        });
      } catch (err) {
        resultados.push({
          clientId: item.clientId,
          status: "erro",
          erro: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    }
    return reply.send({ resultados });
  });

  fastify.patch<{ Params: { id: string } }>(
    "/colheitas/:id",
    { preHandler: fastify.requirePermissao("colheitas", "EDITAR") },
    async (request, reply) => {
      const dados = colheitaComercialSchema.parse(request.body);
      const existente = await fastify.prisma.colheita.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();

      // Recalcula o custo se caixas ou valor/caixa mudarem.
      const caixas = dados.quantidadeCaixas ?? existente.quantidadeCaixas;
      const valorCaixa =
        dados.valorPorCaixa !== undefined ? dados.valorPorCaixa : existente.valorPorCaixa;
      const custoColheita = valorCaixa != null ? arredondar(caixas * valorCaixa) : null;

      const colheita = await fastify.prisma.colheita.update({
        where: { id: existente.id },
        data: { ...dados, custoColheita },
        include: INCLUDE_COMPLETO,
      });
      return reply.send(comDerivados(colheita));
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/colheitas/:id",
    { preHandler: fastify.requirePermissao("colheitas", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.colheita.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.colheita.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
