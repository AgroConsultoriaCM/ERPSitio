import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, NaoEncontradoError } from "../lib/errors.js";

const movimentacaoSchema = z
  .object({
    insumoId: z.string().uuid(),
    tipo: z.enum(["ENTRADA", "SAIDA", "AJUSTE"]),
    origem: z.enum(["COMPRA", "USO_ATIVIDADE", "AJUSTE", "OUTRO"]).default("OUTRO"),
    quantidade: z.number(),
    data: z.coerce.date(),
    observacoes: z.string().optional(),
  })
  .refine((d) => d.tipo === "AJUSTE" || d.quantidade > 0, {
    message: "Quantidade deve ser positiva para entrada/saída (use AJUSTE para valores negativos)",
    path: ["quantidade"],
  });

export default async function estoqueRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("estoque", "VER"));

  fastify.get("/estoque/movimentacoes", async (request) => {
    const { insumoId } = request.query as { insumoId?: string };
    return fastify.prisma.movimentacaoEstoque.findMany({
      where: {
        propriedadeId: request.user.propriedadeId,
        insumoId: insumoId ?? undefined,
      },
      include: { insumo: true },
      orderBy: { data: "desc" },
      take: 200,
    });
  });

  fastify.post(
    "/estoque/movimentacoes",
    { preHandler: fastify.requirePermissao("estoque", "EDITAR") },
    async (request, reply) => {
      const dados = movimentacaoSchema.parse(request.body);
      const insumo = await fastify.prisma.insumo.findFirst({
        where: { id: dados.insumoId, propriedadeId: request.user.propriedadeId },
      });
      if (!insumo) throw new NaoEncontradoError("Insumo não encontrado");

      const movimentacao = await fastify.prisma.movimentacaoEstoque.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(movimentacao);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/estoque/movimentacoes/:id",
    { preHandler: fastify.requirePermissao("estoque", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.movimentacaoEstoque.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      if (existente.origem === "USO_ATIVIDADE") {
        throw new AppError(
          "Esta movimentação foi gerada automaticamente por uma atividade e não pode ser excluída diretamente.",
          400,
        );
      }
      await fastify.prisma.movimentacaoEstoque.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
