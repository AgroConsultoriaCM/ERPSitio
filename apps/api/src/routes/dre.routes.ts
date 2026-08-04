import type { FastifyInstance } from "fastify";
import { calcularDre } from "../services/dre.js";

export default async function dreRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("dre", "VER"));

  fastify.get("/dre", async (request, reply) => {
    const query = request.query as { dataInicio?: string; dataFim?: string; talhaoId?: string };
    if (!query.dataInicio || !query.dataFim) {
      return reply.status(400).send({ message: "Informe dataInicio e dataFim." });
    }
    const dre = await calcularDre(fastify.prisma, {
      propriedadeId: request.user.propriedadeId,
      dataInicio: new Date(query.dataInicio),
      dataFim: new Date(query.dataFim),
      talhaoId: query.talhaoId || undefined,
    });
    return reply.send(dre);
  });
}
