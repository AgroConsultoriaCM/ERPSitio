import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";

const culturaSchema = z.object({
  nome: z.string().min(1),
  variedade: z.string().optional(),
});

export default async function culturasRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/culturas", async (request) => {
    return fastify.prisma.cultura.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      orderBy: { nome: "asc" },
    });
  });

  fastify.post(
    "/culturas",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = culturaSchema.parse(request.body);
      const cultura = await fastify.prisma.cultura.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(cultura);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/culturas/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = culturaSchema.partial().parse(request.body);
      const existente = await fastify.prisma.cultura.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const cultura = await fastify.prisma.cultura.update({
        where: { id: existente.id },
        data: dados,
      });
      return reply.send(cultura);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/culturas/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.cultura.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.cultura.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
