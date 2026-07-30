import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";

const safraSchema = z.object({
  nome: z.string().min(1),
  talhaoId: z.string().uuid(),
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date().optional().nullable(),
  observacoes: z.string().optional(),
});

async function validarTalhaoDaPropriedade(fastify: FastifyInstance, talhaoId: string, propriedadeId: string) {
  const talhao = await fastify.prisma.talhao.findFirst({ where: { id: talhaoId, propriedadeId } });
  if (!talhao) throw new NaoEncontradoError("Talhão não encontrado");
}

export default async function safrasRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/safras", async (request) => {
    const { talhaoId } = request.query as { talhaoId?: string };
    return fastify.prisma.safra.findMany({
      where: {
        talhao: { propriedadeId: request.user.propriedadeId },
        talhaoId: talhaoId ?? undefined,
      },
      orderBy: { dataInicio: "desc" },
    });
  });

  fastify.post(
    "/safras",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = safraSchema.parse(request.body);
      await validarTalhaoDaPropriedade(fastify, dados.talhaoId, request.user.propriedadeId);
      const safra = await fastify.prisma.safra.create({ data: dados });
      return reply.status(201).send(safra);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/safras/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = safraSchema.partial().parse(request.body);
      const existente = await fastify.prisma.safra.findFirst({
        where: { id: request.params.id, talhao: { propriedadeId: request.user.propriedadeId } },
      });
      if (!existente) throw new NaoEncontradoError();
      const safra = await fastify.prisma.safra.update({ where: { id: existente.id }, data: dados });
      return reply.send(safra);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/safras/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.safra.findFirst({
        where: { id: request.params.id, talhao: { propriedadeId: request.user.propriedadeId } },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.safra.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
