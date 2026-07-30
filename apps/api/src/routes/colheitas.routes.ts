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

// Momento 2 - complemento comercial (gestor, depois)
const colheitaComercialSchema = z.object({
  pesoTotalKg: z.number().min(0).optional().nullable(),
  pesoRefugoKg: z.number().min(0).optional().nullable(),
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
  talhao: { select: { id: true, nome: true, codigo: true, areaHa: true } },
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
  talhao?: { areaHa: number | null } | null;
};

function comDerivados<T extends ColheitaComRelacoes>(c: T) {
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

  const margem =
    c.valorTotalVenda != null ? arredondar(c.valorTotalVenda - (c.custoColheita ?? 0), 2) : null;

  const areaHa = c.talhao?.areaHa ?? null;
  const caixasPorHectare =
    areaHa && areaHa > 0 ? arredondar(c.quantidadeCaixas / areaHa, 2) : null;

  return {
    ...c,
    kgPorCaixa,
    pesoLiquidoKg,
    percentualRefugo,
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
        // "pendentes" = ja colhidas mas ainda sem os dados de venda
        valorTotalVenda: query.pendentesComercial === "true" ? null : undefined,
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

    for (const c of colheitas) {
      const atual = porTalhao.get(c.talhaoId) ?? {
        talhaoId: c.talhaoId,
        nome: c.talhao.nome,
        codigo: c.talhao.codigo,
        areaHa: c.talhao.areaHa,
        caixas: 0,
        custoColheita: 0,
        receita: 0,
        pesoTotalKg: 0,
      };
      atual.caixas += c.quantidadeCaixas;
      atual.custoColheita += c.custoColheita ?? 0;
      atual.receita += c.valorTotalVenda ?? 0;
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
