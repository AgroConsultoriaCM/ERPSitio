import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";

const perfilSchema = z.object({
  nome: z.string().min(1),
  culturaId: z.string().uuid(),
  phIdealMin: z.number().optional().nullable(),
  phIdealMax: z.number().optional().nullable(),
  materiaOrganicaIdeal: z.number().optional().nullable(),
  fosforoIdeal: z.number().optional().nullable(),
  potassioIdeal: z.number().optional().nullable(),
  calcioIdeal: z.number().optional().nullable(),
  magnesioIdeal: z.number().optional().nullable(),
  saturacaoBasesIdeal: z.number().optional().nullable(),
  ctcReferencia: z.number().optional().nullable(),
  micronutrientesIdeais: z
    .record(z.number())
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  observacoes: z.string().optional(),
});

export default async function perfisCorrecaoRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/perfis-correcao", async (request) => {
    const { culturaId } = request.query as { culturaId?: string };
    return fastify.prisma.perfilCorrecaoSolo.findMany({
      where: { propriedadeId: request.user.propriedadeId, culturaId: culturaId ?? undefined },
      include: { cultura: true },
      orderBy: { nome: "asc" },
    });
  });

  fastify.post(
    "/perfis-correcao",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = perfilSchema.parse(request.body);
      const cultura = await fastify.prisma.cultura.findFirst({
        where: { id: dados.culturaId, propriedadeId: request.user.propriedadeId },
      });
      if (!cultura) throw new NaoEncontradoError("Cultura não encontrada");
      const perfil = await fastify.prisma.perfilCorrecaoSolo.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(perfil);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/perfis-correcao/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = perfilSchema.partial().parse(request.body);
      const existente = await fastify.prisma.perfilCorrecaoSolo.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const perfil = await fastify.prisma.perfilCorrecaoSolo.update({
        where: { id: existente.id },
        data: dados,
      });
      return reply.send(perfil);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/perfis-correcao/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.perfilCorrecaoSolo.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.perfilCorrecaoSolo.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
