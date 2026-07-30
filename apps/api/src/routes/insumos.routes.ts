import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";

const insumoSchema = z.object({
  nome: z.string().min(1),
  categoria: z.enum(["DEFENSIVO", "FERTILIZANTE", "EMBALAGEM", "OUTRO"]),
  // funcao agronomica: base do controle de pragas (ultima aplicacao por tipo)
  funcao: z
    .enum([
      "INSETICIDA",
      "FUNGICIDA",
      "HERBICIDA",
      "ACARICIDA",
      "NEMATICIDA",
      "NUTRICAO_FOLIAR",
      "FERTILIZANTE_SOLO",
      "ADJUVANTE",
      "OUTRO",
    ])
    .optional()
    .nullable(),
  unidadeMedida: z.string().min(1),
  estoqueMinimo: z.number().optional().nullable(),
});

export default async function insumosRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/insumos", async (request) => {
    const insumos = await fastify.prisma.insumo.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      orderBy: { nome: "asc" },
    });

    const saldos = await fastify.prisma.movimentacaoEstoque.groupBy({
      by: ["insumoId", "tipo"],
      where: { propriedadeId: request.user.propriedadeId },
      _sum: { quantidade: true },
    });

    const saldoPorInsumo = new Map<string, number>();
    for (const linha of saldos) {
      const atual = saldoPorInsumo.get(linha.insumoId) ?? 0;
      const valor = linha._sum.quantidade ?? 0;
      saldoPorInsumo.set(linha.insumoId, atual + (linha.tipo === "SAIDA" ? -valor : valor));
    }

    return insumos.map((insumo) => ({
      ...insumo,
      saldoAtual: saldoPorInsumo.get(insumo.id) ?? 0,
    }));
  });

  fastify.post(
    "/insumos",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = insumoSchema.parse(request.body);
      const insumo = await fastify.prisma.insumo.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(insumo);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/insumos/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = insumoSchema.partial().parse(request.body);
      const existente = await fastify.prisma.insumo.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const insumo = await fastify.prisma.insumo.update({ where: { id: existente.id }, data: dados });
      return reply.send(insumo);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/insumos/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.insumo.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.insumo.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
