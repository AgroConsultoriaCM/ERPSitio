import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, NaoEncontradoError } from "../lib/errors.js";

const caldaSchema = z.object({
  nome: z.string().min(1),
  observacoes: z.string().optional(),
  itens: z
    .array(
      z.object({
        insumoId: z.string().uuid(),
        dosePor100L: z.number().positive(),
      }),
    )
    .min(1),
});

export default async function caldasRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/caldas", async (request) => {
    return fastify.prisma.calda.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      include: { itens: { include: { insumo: { select: { id: true, nome: true, unidadeMedida: true } } } } },
      orderBy: { nome: "asc" },
    });
  });

  fastify.post(
    "/caldas",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = caldaSchema.parse(request.body);
      const propriedadeId = request.user.propriedadeId;
      const insumos = await fastify.prisma.insumo.findMany({
        where: { id: { in: dados.itens.map((i) => i.insumoId) }, propriedadeId },
        select: { id: true },
      });
      if (insumos.length !== new Set(dados.itens.map((i) => i.insumoId)).size) {
        throw new AppError("Algum produto da calda não pertence a esta propriedade.", 422);
      }
      const calda = await fastify.prisma.calda.create({
        data: {
          nome: dados.nome,
          observacoes: dados.observacoes,
          propriedadeId,
          itens: { create: dados.itens },
        },
        include: { itens: { include: { insumo: { select: { id: true, nome: true, unidadeMedida: true } } } } },
      });
      return reply.status(201).send(calda);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/caldas/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = caldaSchema.parse(request.body);
      const propriedadeId = request.user.propriedadeId;
      const existente = await fastify.prisma.calda.findFirst({ where: { id: request.params.id, propriedadeId } });
      if (!existente) throw new NaoEncontradoError();
      const insumos = await fastify.prisma.insumo.findMany({
        where: { id: { in: dados.itens.map((i) => i.insumoId) }, propriedadeId },
        select: { id: true },
      });
      if (insumos.length !== new Set(dados.itens.map((i) => i.insumoId)).size) {
        throw new AppError("Algum produto da calda não pertence a esta propriedade.", 422);
      }
      // Substitui os itens inteiros - mais simples e seguro que tentar
      // diferenciar quais linhas mudaram numa receita curta como esta.
      const calda = await fastify.prisma.$transaction(async (tx) => {
        await tx.caldaItem.deleteMany({ where: { caldaId: existente.id } });
        return tx.calda.update({
          where: { id: existente.id },
          data: {
            nome: dados.nome,
            observacoes: dados.observacoes,
            itens: { create: dados.itens },
          },
          include: { itens: { include: { insumo: { select: { id: true, nome: true, unidadeMedida: true } } } } },
        });
      });
      return reply.send(calda);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/caldas/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.calda.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.calda.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
