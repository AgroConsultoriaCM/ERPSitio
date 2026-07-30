import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, NaoEncontradoError } from "../lib/errors.js";
import { ratearPorArea } from "../services/rateio.js";
import { consumirDoEstoque, validarQuantidadesPulverizacao } from "../services/estoque.js";
import type { PrismaClient } from "@erpsitio/db";

// Duas formas de declarar o produto:
//  - direto: "usei 5 L"  -> quantidade
//  - pulverizacao: "levei 20 L e voltei com 3 L" -> levada/retornada, e o
//    sistema calcula o usado. loteId opcional atrela a uma compra especifica.
const insumoUsadoSchema = z
  .object({
    insumoId: z.string().uuid(),
    quantidade: z.number().min(0).optional(),
    quantidadeLevada: z.number().min(0).optional(),
    quantidadeRetornada: z.number().min(0).optional(),
    loteId: z.string().uuid().optional().nullable(),
    unidade: z.string().min(1),
  })
  .refine((d) => d.quantidade != null || d.quantidadeLevada != null, {
    message: "Informe a quantidade usada ou a quantidade levada ao campo.",
  });

// A operacao aceita talhoes avulsos, grupos, ou os dois - o servidor resolve
// os grupos em talhoes e remove duplicatas.
const atividadeSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    tipoAtividadeId: z.string().uuid(),
    talhaoIds: z.array(z.string().uuid()).optional().default([]),
    grupoIds: z.array(z.string().uuid()).optional().default([]),
    executorId: z.string().uuid().optional().nullable(),
    custoMaoDeObra: z.number().min(0).optional().nullable(),
    safraId: z.string().uuid().optional().nullable(),
    data: z.coerce.date(),
    observacoes: z.string().optional(),
    origem: z.enum(["WEB", "APP"]).default("APP"),
    insumos: z.array(insumoUsadoSchema).optional().default([]),
  })
  .refine((d) => d.talhaoIds.length > 0 || d.grupoIds.length > 0, {
    message: "Selecione ao menos um talhão ou um grupo.",
    path: ["talhaoIds"],
  });

const loteSchema = z.object({
  itens: z.array(atividadeSchema).min(1).max(100),
});

const INCLUDE_COMPLETO = {
  tipoAtividade: true,
  executor: true,
  responsavel: { select: { id: true, nome: true } },
  talhoes: { include: { talhao: { select: { id: true, nome: true, codigo: true } } } },
  insumos: { include: { insumo: true } },
} as const;

// Expande grupos em talhoes e devolve a lista final (sem duplicatas), ja
// com a area de cada um para o rateio.
async function resolverTalhoes(
  prisma: PrismaClient,
  propriedadeId: string,
  talhaoIds: string[],
  grupoIds: string[],
) {
  const idsDosGrupos =
    grupoIds.length > 0
      ? (
          await prisma.grupoTalhaoItem.findMany({
            where: { grupoId: { in: grupoIds }, grupo: { propriedadeId } },
            select: { talhaoId: true },
          })
        ).map((i) => i.talhaoId)
      : [];

  const todos = [...new Set([...talhaoIds, ...idsDosGrupos])];
  if (todos.length === 0) {
    throw new AppError("Nenhum talhão encontrado para os grupos/talhões informados.", 400);
  }

  const talhoes = await prisma.talhao.findMany({
    where: { id: { in: todos }, propriedadeId },
    select: { id: true, areaHa: true },
  });
  if (talhoes.length !== todos.length) {
    throw new AppError("Um ou mais talhões informados não existem nesta propriedade.", 400);
  }
  return talhoes;
}

async function criarAtividade(
  prisma: PrismaClient,
  propriedadeId: string,
  responsavelId: string,
  dados: z.infer<typeof atividadeSchema>,
) {
  if (dados.clientId) {
    const existente = await prisma.atividade.findUnique({ where: { clientId: dados.clientId } });
    if (existente) return { atividade: existente, criada: false };
  }

  const talhoes = await resolverTalhoes(prisma, propriedadeId, dados.talhaoIds, dados.grupoIds);
  const parcelas = ratearPorArea(talhoes, dados.custoMaoDeObra);

  const atividade = await prisma.$transaction(async (tx) => {
    const criada = await tx.atividade.create({
      data: {
        clientId: dados.clientId,
        tipoAtividadeId: dados.tipoAtividadeId,
        executorId: dados.executorId ?? undefined,
        custoMaoDeObra: dados.custoMaoDeObra ?? undefined,
        safraId: dados.safraId ?? undefined,
        data: dados.data,
        observacoes: dados.observacoes,
        origem: dados.origem,
        responsavelId,
        propriedadeId,
        talhoes: {
          create: parcelas.map((p) => ({
            talhaoId: p.talhaoId,
            areaHa: p.areaHa,
            custoRateado: p.custoRateado,
          })),
        },
      },
    });

    // Produtos: baixa do estoque com custo real vindo dos lotes.
    let custoInsumosTotal = 0;

    for (const item of dados.insumos) {
      const insumo = await tx.insumo.findFirst({ where: { id: item.insumoId, propriedadeId } });
      if (!insumo) throw new NaoEncontradoError(`Insumo ${item.insumoId} não encontrado`);

      // levado - devolvido (pulverizacao) ou quantidade direta
      const usado =
        item.quantidadeLevada != null
          ? validarQuantidadesPulverizacao(item.quantidadeLevada, item.quantidadeRetornada ?? 0)
          : (item.quantidade ?? 0);

      if (usado <= 0) continue;

      const consumo = await consumirDoEstoque(tx, {
        insumoId: item.insumoId,
        propriedadeId,
        quantidade: usado,
        loteIdPreferido: item.loteId,
      });

      custoInsumosTotal += consumo.custoTotal;

      await tx.atividadeInsumo.create({
        data: {
          atividadeId: criada.id,
          insumoId: item.insumoId,
          quantidade: usado,
          quantidadeLevada: item.quantidadeLevada,
          quantidadeRetornada: item.quantidadeRetornada,
          unidade: item.unidade,
          custoUnitario: consumo.custoUnitarioMedio || null,
          custoTotal: consumo.custoTotal || null,
        },
      });

      // Uma movimentacao por lote consumido, para o custo ficar rastreavel
      // ate a compra de origem.
      if (consumo.consumos.length > 0) {
        for (const c of consumo.consumos) {
          await tx.movimentacaoEstoque.create({
            data: {
              insumoId: item.insumoId,
              propriedadeId,
              tipo: "SAIDA",
              origem: "USO_ATIVIDADE",
              quantidade: c.quantidade,
              data: dados.data,
              atividadeId: criada.id,
              loteId: c.loteId,
              custoUnitario: c.precoUnitario,
              custoTotal: c.custo,
              observacoes: "Baixa automática por apontamento de operação",
            },
          });
        }
      } else {
        // sem lote disponivel: registra a saida sem custo, para o saldo
        // continuar correto quando a compra for lancada depois
        await tx.movimentacaoEstoque.create({
          data: {
            insumoId: item.insumoId,
            propriedadeId,
            tipo: "SAIDA",
            origem: "USO_ATIVIDADE",
            quantidade: usado,
            data: dados.data,
            atividadeId: criada.id,
            observacoes: "Baixa sem lote de compra correspondente (custo não apurado)",
          },
        });
      }
    }

    // O custo dos produtos entra no rateio junto com a mao de obra.
    if (custoInsumosTotal > 0) {
      const parcelasComInsumo = ratearPorArea(talhoes, (dados.custoMaoDeObra ?? 0) + custoInsumosTotal);
      for (const p of parcelasComInsumo) {
        await tx.atividadeTalhao.updateMany({
          where: { atividadeId: criada.id, talhaoId: p.talhaoId },
          data: { custoRateado: p.custoRateado },
        });
      }
    }

    return criada;
  });

  return { atividade, criada: true };
}

export default async function atividadesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("operacoes", "VER"));

  fastify.get("/atividades", async (request) => {
    const query = request.query as {
      talhaoId?: string;
      responsavelId?: string;
      executorId?: string;
      dataInicio?: string;
      dataFim?: string;
    };

    return fastify.prisma.atividade.findMany({
      where: {
        propriedadeId: request.user.propriedadeId,
        responsavelId: query.responsavelId ?? undefined,
        executorId: query.executorId ?? undefined,
        talhoes: query.talhaoId ? { some: { talhaoId: query.talhaoId } } : undefined,
        data: {
          gte: query.dataInicio ? new Date(query.dataInicio) : undefined,
          lte: query.dataFim ? new Date(query.dataFim) : undefined,
        },
      },
      include: INCLUDE_COMPLETO,
      orderBy: { data: "desc" },
      take: 500,
    });
  });

  fastify.get<{ Params: { id: string } }>("/atividades/:id", async (request) => {
    const atividade = await fastify.prisma.atividade.findFirst({
      where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      include: INCLUDE_COMPLETO,
    });
    if (!atividade) throw new NaoEncontradoError();
    return atividade;
  });

  fastify.post("/atividades", async (request, reply) => {
    const dados = atividadeSchema.parse(request.body);
    const { atividade, criada } = await criarAtividade(
      fastify.prisma,
      request.user.propriedadeId,
      request.user.sub,
      dados,
    );
    return reply.status(criada ? 201 : 200).send(atividade);
  });

  // Reenvio em lote da fila offline do app de campo.
  // Idempotente por clientId: reenviar o mesmo item nao duplica.
  fastify.post("/atividades/sync-lote", async (request, reply) => {
    const { itens } = loteSchema.parse(request.body);

    const resultados = [];
    for (const item of itens) {
      try {
        const { atividade, criada } = await criarAtividade(
          fastify.prisma,
          request.user.propriedadeId,
          request.user.sub,
          item,
        );
        resultados.push({
          clientId: item.clientId,
          id: atividade.id,
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
    "/atividades/:id",
    { preHandler: fastify.requirePermissao("operacoes", "EDITAR") },
    async (request, reply) => {
      const dados = z
        .object({
          tipoAtividadeId: z.string().uuid().optional(),
          executorId: z.string().uuid().optional().nullable(),
          custoMaoDeObra: z.number().min(0).optional().nullable(),
          safraId: z.string().uuid().optional().nullable(),
          data: z.coerce.date().optional(),
          observacoes: z.string().optional(),
          talhaoIds: z.array(z.string().uuid()).optional(),
          grupoIds: z.array(z.string().uuid()).optional(),
        })
        .parse(request.body);

      const existente = await fastify.prisma.atividade.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
        include: { talhoes: true },
      });
      if (!existente) throw new NaoEncontradoError();

      // Alterar talhoes ou custo obriga a refazer o rateio inteiro.
      const mudouComposicao = dados.talhaoIds !== undefined || dados.grupoIds !== undefined;
      const mudouCusto = dados.custoMaoDeObra !== undefined;

      let recriarTalhoes;
      if (mudouComposicao || mudouCusto) {
        const talhoes = mudouComposicao
          ? await resolverTalhoes(
              fastify.prisma,
              request.user.propriedadeId,
              dados.talhaoIds ?? [],
              dados.grupoIds ?? [],
            )
          : existente.talhoes.map((t) => ({ id: t.talhaoId, areaHa: t.areaHa }));

        const custo = mudouCusto ? dados.custoMaoDeObra : existente.custoMaoDeObra;
        const parcelas = ratearPorArea(talhoes, custo);
        recriarTalhoes = {
          deleteMany: {},
          create: parcelas.map((p) => ({
            talhaoId: p.talhaoId,
            areaHa: p.areaHa,
            custoRateado: p.custoRateado,
          })),
        };
      }

      const { talhaoIds: _t, grupoIds: _g, ...camposDiretos } = dados;
      const atividade = await fastify.prisma.atividade.update({
        where: { id: existente.id },
        data: { ...camposDiretos, ...(recriarTalhoes ? { talhoes: recriarTalhoes } : {}) },
        include: INCLUDE_COMPLETO,
      });
      return reply.send(atividade);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/atividades/:id",
    { preHandler: fastify.requirePermissao("operacoes", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.atividade.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.atividade.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
