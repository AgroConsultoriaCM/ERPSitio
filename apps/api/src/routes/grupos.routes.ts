import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, NaoEncontradoError } from "../lib/errors.js";

const grupoSchema = z.object({
  nome: z.string().min(1),
  corMapa: z.string().optional(),
  observacoes: z.string().optional(),
  talhaoIds: z.array(z.string().uuid()).min(1),
});

export default async function gruposRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/grupos", async (request) => {
    const grupos = await fastify.prisma.grupoTalhao.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      include: { itens: { include: { talhao: true } } },
      orderBy: { nome: "asc" },
    });

    return grupos.map((g) => ({
      id: g.id,
      nome: g.nome,
      corMapa: g.corMapa,
      observacoes: g.observacoes,
      talhoes: g.itens.map((i) => ({
        id: i.talhao.id,
        nome: i.talhao.nome,
        codigo: i.talhao.codigo,
        areaHa: i.talhao.areaHa,
      })),
      areaTotalHa: g.itens.reduce((soma, i) => soma + (i.talhao.areaHa ?? 0), 0),
    }));
  });

  // Confere que todos os talhoes informados sao da propriedade do usuario
  async function validarTalhoes(propriedadeId: string, talhaoIds: string[]) {
    const encontrados = await fastify.prisma.talhao.findMany({
      where: { id: { in: talhaoIds }, propriedadeId },
      select: { id: true },
    });
    if (encontrados.length !== talhaoIds.length) {
      throw new AppError("Um ou mais talhões informados não existem nesta propriedade.", 400);
    }
  }

  fastify.post(
    "/grupos",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const { talhaoIds, ...dados } = grupoSchema.parse(request.body);
      await validarTalhoes(request.user.propriedadeId, talhaoIds);

      const grupo = await fastify.prisma.grupoTalhao.create({
        data: {
          ...dados,
          propriedadeId: request.user.propriedadeId,
          itens: { create: talhaoIds.map((talhaoId) => ({ talhaoId })) },
        },
        include: { itens: true },
      });
      return reply.status(201).send(grupo);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/grupos/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const { talhaoIds, ...dados } = grupoSchema.partial().parse(request.body);
      const existente = await fastify.prisma.grupoTalhao.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();

      if (talhaoIds) {
        await validarTalhoes(request.user.propriedadeId, talhaoIds);
      }

      const grupo = await fastify.prisma.grupoTalhao.update({
        where: { id: existente.id },
        data: {
          ...dados,
          // troca a composicao inteira quando a lista vem no payload
          ...(talhaoIds
            ? { itens: { deleteMany: {}, create: talhaoIds.map((talhaoId) => ({ talhaoId })) } }
            : {}),
        },
        include: { itens: true },
      });
      return reply.send(grupo);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/grupos/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.grupoTalhao.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.grupoTalhao.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
