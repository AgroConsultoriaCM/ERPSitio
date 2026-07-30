import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@erpsitio/db";
import { AppError } from "../lib/errors.js";
import { areasQueFicariamFora, normalizarPoligono } from "../services/geoAreas.js";

const atualizarPropriedadeSchema = z.object({
  nome: z.string().min(1).optional(),
  localizacao: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  poligono: z.any().optional(),
});

export default async function propriedadesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("propriedade", "VER"));

  fastify.get("/propriedades/me", async (request) => {
    return fastify.prisma.propriedade.findUniqueOrThrow({
      where: { id: request.user.propriedadeId },
    });
  });

  fastify.patch(
    "/propriedades/me",
    { preHandler: fastify.requirePermissao("propriedade", "EDITAR") },
    async (request, reply) => {
      const dados = atualizarPropriedadeSchema.parse(request.body);

      // Reduzir o contorno da propriedade nao pode deixar nenhum talhao ou
      // setor ja cadastrado para fora - isso invalidaria dados existentes.
      if (dados.poligono !== undefined && dados.poligono !== null) {
        const novoPoligono = normalizarPoligono(dados.poligono);
        if (!novoPoligono) {
          throw new AppError(
            "O contorno da propriedade precisa ter no mínimo 3 vértices.",
            400,
          );
        }

        const [talhoes, setores] = await Promise.all([
          fastify.prisma.talhao.findMany({
            where: { propriedadeId: request.user.propriedadeId },
            select: { nome: true, codigo: true, poligono: true },
          }),
          fastify.prisma.setorIrrigacao.findMany({
            where: { propriedadeId: request.user.propriedadeId },
            select: { nome: true, codigo: true, poligono: true },
          }),
        ]);

        const talhoesFora = areasQueFicariamFora(novoPoligono, talhoes);
        const setoresFora = areasQueFicariamFora(novoPoligono, setores);

        if (talhoesFora.length > 0 || setoresFora.length > 0) {
          const partes: string[] = [];
          if (talhoesFora.length > 0) partes.push(`talhões: ${talhoesFora.join(", ")}`);
          if (setoresFora.length > 0) partes.push(`setores: ${setoresFora.join(", ")}`);
          throw new AppError(
            `O novo contorno deixaria estas áreas fora da propriedade (${partes.join(
              "; ",
            )}). Ajuste o contorno para continuar englobando todas, ou edite essas áreas antes.`,
            400,
          );
        }
      }

      const propriedade = await fastify.prisma.propriedade.update({
        where: { id: request.user.propriedadeId },
        data: dados as Prisma.PropriedadeUpdateInput,
      });
      return reply.send(propriedade);
    },
  );
}
