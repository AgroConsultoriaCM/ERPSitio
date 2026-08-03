import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";

const bombaSchema = z.object({
  nome: z.string().min(1),
  capacidadeLitros: z.number().positive(),
});

export default async function perfisBombaRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/perfis-bomba", async (request) => {
    return fastify.prisma.perfilBomba.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      orderBy: { nome: "asc" },
    });
  });

  fastify.post(
    "/perfis-bomba",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = bombaSchema.parse(request.body);
      const bomba = await fastify.prisma.perfilBomba.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(bomba);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/perfis-bomba/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = bombaSchema.partial().parse(request.body);
      const existente = await fastify.prisma.perfilBomba.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const bomba = await fastify.prisma.perfilBomba.update({ where: { id: existente.id }, data: dados });
      return reply.send(bomba);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/perfis-bomba/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.perfilBomba.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.perfilBomba.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
