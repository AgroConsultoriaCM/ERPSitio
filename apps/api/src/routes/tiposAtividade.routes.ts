import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";

const tipoAtividadeSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
});

export default async function tiposAtividadeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/tipos-atividade", async (request) => {
    return fastify.prisma.tipoAtividade.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      orderBy: { nome: "asc" },
    });
  });

  fastify.post(
    "/tipos-atividade",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = tipoAtividadeSchema.parse(request.body);
      const tipo = await fastify.prisma.tipoAtividade.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(tipo);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/tipos-atividade/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = tipoAtividadeSchema.partial().parse(request.body);
      const existente = await fastify.prisma.tipoAtividade.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const tipo = await fastify.prisma.tipoAtividade.update({ where: { id: existente.id }, data: dados });
      return reply.send(tipo);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/tipos-atividade/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.tipoAtividade.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.tipoAtividade.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
