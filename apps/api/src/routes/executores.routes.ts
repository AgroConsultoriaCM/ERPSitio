import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";

const executorSchema = z.object({
  nome: z.string().min(1),
  tipo: z.enum(["EQUIPE_PROPRIA", "EMPREITEIRO", "PRESTADOR_SERVICO"]),
  // So importa para EMPREITEIRO de colheita - decide a formula do custo em
  // Colheita (ver colheitas.routes.ts). Mudar isto NUNCA recalcula colheita
  // ja lancada; so vale para a proxima vez que o custo dela for calculado.
  modalidadePagamentoColheita: z.enum(["POR_CAIXA", "POR_CAIXA_PESO"]).default("POR_CAIXA"),
  contato: z.string().optional(),
  observacoes: z.string().optional(),
  ativo: z.boolean().optional(),
});

export default async function executoresRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/executores", async (request) => {
    const { incluirInativos } = request.query as { incluirInativos?: string };
    return fastify.prisma.executor.findMany({
      where: {
        propriedadeId: request.user.propriedadeId,
        ativo: incluirInativos === "true" ? undefined : true,
      },
      orderBy: [{ tipo: "asc" }, { nome: "asc" }],
    });
  });

  fastify.post(
    "/executores",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = executorSchema.parse(request.body);
      const executor = await fastify.prisma.executor.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(executor);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/executores/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = executorSchema.partial().parse(request.body);
      const existente = await fastify.prisma.executor.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const executor = await fastify.prisma.executor.update({
        where: { id: existente.id },
        data: dados,
      });
      return reply.send(executor);
    },
  );

  // Desativa em vez de apagar: o executor pode estar referenciado em
  // operacoes e colheitas ja lancadas.
  fastify.delete<{ Params: { id: string } }>(
    "/executores/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.executor.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.executor.update({
        where: { id: existente.id },
        data: { ativo: false },
      });
      return reply.status(204).send();
    },
  );
}
