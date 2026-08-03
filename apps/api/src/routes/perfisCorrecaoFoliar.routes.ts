import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, NaoEncontradoError } from "../lib/errors.js";

const perfilSchema = z.object({
  nome: z.string().min(1),
  /// Nome da ESPECIE ("Limão", "Abacate"), nao de uma Cultura especifica -
  /// mesma convencao do PerfilCorrecaoSolo (ver perfisCorrecao.routes.ts).
  culturaNome: z.string().min(1),
  nitrogenioIdealMin: z.number().optional().nullable(),
  nitrogenioIdealMax: z.number().optional().nullable(),
  fosforoIdealMin: z.number().optional().nullable(),
  fosforoIdealMax: z.number().optional().nullable(),
  potassioIdealMin: z.number().optional().nullable(),
  potassioIdealMax: z.number().optional().nullable(),
  calcioIdealMin: z.number().optional().nullable(),
  calcioIdealMax: z.number().optional().nullable(),
  magnesioIdealMin: z.number().optional().nullable(),
  magnesioIdealMax: z.number().optional().nullable(),
  enxofreIdealMin: z.number().optional().nullable(),
  enxofreIdealMax: z.number().optional().nullable(),
  observacoes: z.string().optional(),
});

export default async function perfisCorrecaoFoliarRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/perfis-correcao-foliar", async (request) => {
    const { culturaNome } = request.query as { culturaNome?: string };
    return fastify.prisma.perfilCorrecaoFoliar.findMany({
      where: { propriedadeId: request.user.propriedadeId, culturaNome: culturaNome ?? undefined },
      orderBy: { nome: "asc" },
    });
  });

  fastify.post(
    "/perfis-correcao-foliar",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = perfilSchema.parse(request.body);
      const existeCultura = await fastify.prisma.cultura.findFirst({
        where: { nome: dados.culturaNome, propriedadeId: request.user.propriedadeId },
      });
      if (!existeCultura) {
        throw new AppError(`Nenhuma cultura cadastrada com o nome "${dados.culturaNome}".`, 422);
      }
      const perfil = await fastify.prisma.perfilCorrecaoFoliar.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(perfil);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/perfis-correcao-foliar/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = perfilSchema.partial().parse(request.body);
      const existente = await fastify.prisma.perfilCorrecaoFoliar.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const perfil = await fastify.prisma.perfilCorrecaoFoliar.update({
        where: { id: existente.id },
        data: dados,
      });
      return reply.send(perfil);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/perfis-correcao-foliar/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.perfilCorrecaoFoliar.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.perfilCorrecaoFoliar.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
