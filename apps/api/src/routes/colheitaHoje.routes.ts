import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hojeBrasilia } from "../lib/data.js";

const respostaSchema = z.object({ resposta: z.boolean() });

export default async function colheitaHojeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("colheitas", "VER"));

  fastify.get("/colheita-hoje", async (request) => {
    const propriedadeId = request.user.propriedadeId;
    return fastify.prisma.respostaColheitaHoje.findUnique({
      where: { propriedadeId_data: { propriedadeId, data: hojeBrasilia() } },
    });
  });

  fastify.post(
    "/colheita-hoje",
    { preHandler: fastify.requirePermissao("colheitas", "EDITAR") },
    async (request, reply) => {
      const dados = respostaSchema.parse(request.body);
      const propriedadeId = request.user.propriedadeId;
      const data = hojeBrasilia();
      const resposta = await fastify.prisma.respostaColheitaHoje.upsert({
        where: { propriedadeId_data: { propriedadeId, data } },
        update: { resposta: dados.resposta, respondidoPorId: request.user.sub, respondidoEm: new Date() },
        create: {
          propriedadeId,
          data,
          resposta: dados.resposta,
          respondidoPorId: request.user.sub,
        },
      });
      return reply.send(resposta);
    },
  );
}
