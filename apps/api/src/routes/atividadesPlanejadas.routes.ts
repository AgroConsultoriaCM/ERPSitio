import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";
import { enviarPushParaPapel } from "../services/push.js";

// So o planejamento ("o que fazer, quando, onde") - o lancamento real
// (custo, estoque, mao de obra) continua em Atividade/Colheita como sempre.
const planejadaSchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().optional().nullable(),
  data: z.coerce.date(),
  tipoAtividadeId: z.string().uuid().optional().nullable(),
  talhaoId: z.string().uuid().optional().nullable(),
  executorId: z.string().uuid().optional().nullable(),
});

const INCLUDE = {
  tipoAtividade: { select: { id: true, nome: true } },
  talhao: { select: { id: true, nome: true, codigo: true } },
  executor: { select: { id: true, nome: true } },
} as const;

export default async function atividadesPlanejadasRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("calendario", "VER"));

  fastify.get("/atividades-planejadas", async (request) => {
    const query = request.query as { dataInicio?: string; dataFim?: string; talhaoId?: string };
    return fastify.prisma.atividadePlanejada.findMany({
      where: {
        propriedadeId: request.user.propriedadeId,
        talhaoId: query.talhaoId ?? undefined,
        data: {
          gte: query.dataInicio ? new Date(query.dataInicio) : undefined,
          lte: query.dataFim ? new Date(query.dataFim) : undefined,
        },
      },
      include: INCLUDE,
      orderBy: [{ concluida: "asc" }, { data: "asc" }],
    });
  });

  fastify.post(
    "/atividades-planejadas",
    { preHandler: fastify.requirePermissao("calendario", "EDITAR") },
    async (request, reply) => {
      const dados = planejadaSchema.parse(request.body);
      const propriedadeId = request.user.propriedadeId;
      const criada = await fastify.prisma.atividadePlanejada.create({
        data: {
          titulo: dados.titulo,
          descricao: dados.descricao ?? undefined,
          data: dados.data,
          tipoAtividadeId: dados.tipoAtividadeId ?? undefined,
          talhaoId: dados.talhaoId ?? undefined,
          executorId: dados.executorId ?? undefined,
          propriedadeId,
          criadoPorId: request.user.sub,
        },
        include: INCLUDE,
      });
      // Aviso e melhoria, nao pode derrubar o lancamento da tarefa se falhar.
      enviarPushParaPapel(fastify.prisma, propriedadeId, "ENCARREGADO", {
        title: "Nova tarefa",
        body: dados.titulo,
        url: "/campo/calendario",
      }).catch((err) => console.error("[atividades-planejadas] falha ao avisar:", err));
      return reply.status(201).send(criada);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/atividades-planejadas/:id",
    { preHandler: fastify.requirePermissao("calendario", "EDITAR") },
    async (request, reply) => {
      const dados = planejadaSchema.partial().parse(request.body);
      const existente = await fastify.prisma.atividadePlanejada.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const atualizada = await fastify.prisma.atividadePlanejada.update({
        where: { id: existente.id },
        data: {
          titulo: dados.titulo,
          descricao: dados.descricao === undefined ? undefined : dados.descricao,
          data: dados.data,
          tipoAtividadeId: dados.tipoAtividadeId === undefined ? undefined : dados.tipoAtividadeId,
          talhaoId: dados.talhaoId === undefined ? undefined : dados.talhaoId,
          executorId: dados.executorId === undefined ? undefined : dados.executorId,
        },
        include: INCLUDE,
      });
      return reply.send(atualizada);
    },
  );

  // Concluir/reabrir e a acao mais comum do encarregado - rota propria em vez
  // de exigir o corpo inteiro do PATCH para so marcar um checkbox.
  fastify.patch<{ Params: { id: string }; Body: { concluida: boolean } }>(
    "/atividades-planejadas/:id/concluir",
    { preHandler: fastify.requirePermissao("calendario", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.atividadePlanejada.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const concluida = Boolean(request.body?.concluida);
      const atualizada = await fastify.prisma.atividadePlanejada.update({
        where: { id: existente.id },
        data: { concluida, concluidaEm: concluida ? new Date() : null },
        include: INCLUDE,
      });
      return reply.send(atualizada);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/atividades-planejadas/:id",
    { preHandler: fastify.requirePermissao("calendario", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.atividadePlanejada.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.atividadePlanejada.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
