import type { FastifyInstance } from "fastify";
import { montarManejoNutricional } from "../services/manejoNutricional.js";

/**
 * Relatorio de manejo nutricional da propriedade inteira.
 *
 * Uma rota so, porque as tres fontes precisam ser cruzadas do lado do servidor:
 * o satelite exige credencial que nao pode ir ao navegador, e as adubacoes
 * dependem de saber quais insumos tem funcao de nutricao - regra de negocio,
 * nao de tela.
 */
export default async function manejoNutricionalRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("analises", "VER"));

  fastify.get("/manejo-nutricional", async (request) =>
    montarManejoNutricional(fastify.prisma, request.user.propriedadeId),
  );
}
