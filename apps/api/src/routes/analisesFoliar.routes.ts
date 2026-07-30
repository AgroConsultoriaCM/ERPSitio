import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";

const analiseFoliarSchema = z.object({
  talhaoId: z.string().uuid(),
  dataColeta: z.coerce.date(),
  estadioFenologico: z.string().optional(),
  nitrogenio: z.number().optional().nullable(),
  fosforo: z.number().optional().nullable(),
  potassio: z.number().optional().nullable(),
  calcio: z.number().optional().nullable(),
  magnesio: z.number().optional().nullable(),
  enxofre: z.number().optional().nullable(),
  micronutrientes: z
    .record(z.number())
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  observacoes: z.string().optional(),
});

export default async function analisesFoliarRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("analises", "VER"));

  fastify.get("/analises-foliar", async (request) => {
    const { talhaoId } = request.query as { talhaoId?: string };
    return fastify.prisma.analiseFoliar.findMany({
      where: { propriedadeId: request.user.propriedadeId, talhaoId: talhaoId ?? undefined },
      orderBy: { dataColeta: "desc" },
    });
  });

  fastify.post(
    "/analises-foliar",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request, reply) => {
      const dados = analiseFoliarSchema.parse(request.body);
      const talhao = await fastify.prisma.talhao.findFirst({
        where: { id: dados.talhaoId, propriedadeId: request.user.propriedadeId },
      });
      if (!talhao) throw new NaoEncontradoError("Talhão não encontrado");
      const analise = await fastify.prisma.analiseFoliar.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(analise);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/analises-foliar/:id",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request, reply) => {
      const dados = analiseFoliarSchema.partial().parse(request.body);
      const existente = await fastify.prisma.analiseFoliar.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const analise = await fastify.prisma.analiseFoliar.update({
        where: { id: existente.id },
        data: dados,
      });
      return reply.send(analise);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/analises-foliar/:id",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.analiseFoliar.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.analiseFoliar.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
