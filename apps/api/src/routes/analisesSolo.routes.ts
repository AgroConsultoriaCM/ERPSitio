import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";

const analiseSoloSchema = z.object({
  talhaoId: z.string().uuid(),
  dataColeta: z.coerce.date(),
  profundidadeCm: z.number().optional().nullable(),
  laboratorio: z.string().optional(),
  ph: z.number().optional().nullable(),
  materiaOrganica: z.number().optional().nullable(),
  fosforo: z.number().optional().nullable(),
  potassio: z.number().optional().nullable(),
  calcio: z.number().optional().nullable(),
  magnesio: z.number().optional().nullable(),
  aluminio: z.number().optional().nullable(),
  hAl: z.number().optional().nullable(),
  somaBases: z.number().optional().nullable(),
  ctc: z.number().optional().nullable(),
  saturacaoBases: z.number().optional().nullable(),
  micronutrientes: z
    .record(z.number())
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  observacoes: z.string().optional(),
});

export default async function analisesSoloRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("analises", "VER"));

  fastify.get("/analises-solo", async (request) => {
    const { talhaoId } = request.query as { talhaoId?: string };
    return fastify.prisma.analiseSolo.findMany({
      where: { propriedadeId: request.user.propriedadeId, talhaoId: talhaoId ?? undefined },
      orderBy: { dataColeta: "desc" },
    });
  });

  fastify.post(
    "/analises-solo",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request, reply) => {
      const dados = analiseSoloSchema.parse(request.body);
      const talhao = await fastify.prisma.talhao.findFirst({
        where: { id: dados.talhaoId, propriedadeId: request.user.propriedadeId },
      });
      if (!talhao) throw new NaoEncontradoError("Talhão não encontrado");
      const analise = await fastify.prisma.analiseSolo.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(analise);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/analises-solo/:id",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request, reply) => {
      const dados = analiseSoloSchema.partial().parse(request.body);
      const existente = await fastify.prisma.analiseSolo.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const analise = await fastify.prisma.analiseSolo.update({ where: { id: existente.id }, data: dados });
      return reply.send(analise);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/analises-solo/:id",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.analiseSolo.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.analiseSolo.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
