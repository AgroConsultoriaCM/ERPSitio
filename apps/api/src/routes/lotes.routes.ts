import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, NaoEncontradoError } from "../lib/errors.js";

const loteSchema = z.object({
  insumoId: z.string().uuid(),
  origem: z.enum(["COMPRA", "INVENTARIO_INICIAL", "AJUSTE"]).default("COMPRA"),
  data: z.coerce.date(),
  quantidade: z.number().positive(),
  precoUnitario: z.number().min(0),
  fornecedor: z.string().optional(),
  numeroNota: z.string().optional(),
  observacoes: z.string().optional(),
});

export default async function lotesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("estoque", "VER"));

  fastify.get("/lotes", async (request) => {
    const { insumoId, comSaldo } = request.query as { insumoId?: string; comSaldo?: string };
    return fastify.prisma.loteInsumo.findMany({
      where: {
        propriedadeId: request.user.propriedadeId,
        insumoId: insumoId ?? undefined,
        quantidadeRestante: comSaldo === "true" ? { gt: 0 } : undefined,
      },
      include: { insumo: { select: { id: true, nome: true, unidadeMedida: true } } },
      orderBy: { data: "desc" },
    });
  });

  // Entrada no estoque: compra, inventario inicial ou ajuste. Cria o lote e a
  // movimentacao de entrada correspondente, na mesma transacao.
  fastify.post(
    "/lotes",
    { preHandler: fastify.requirePermissao("estoque", "EDITAR") },
    async (request, reply) => {
      const dados = loteSchema.parse(request.body);

      const insumo = await fastify.prisma.insumo.findFirst({
        where: { id: dados.insumoId, propriedadeId: request.user.propriedadeId },
      });
      if (!insumo) throw new NaoEncontradoError("Insumo não encontrado");

      const lote = await fastify.prisma.$transaction(async (tx) => {
        const criado = await tx.loteInsumo.create({
          data: {
            ...dados,
            quantidadeRestante: dados.quantidade,
            propriedadeId: request.user.propriedadeId,
          },
        });

        await tx.movimentacaoEstoque.create({
          data: {
            insumoId: dados.insumoId,
            propriedadeId: request.user.propriedadeId,
            tipo: "ENTRADA",
            origem: dados.origem === "COMPRA" ? "COMPRA" : "AJUSTE",
            quantidade: dados.quantidade,
            data: dados.data,
            loteId: criado.id,
            custoUnitario: dados.precoUnitario,
            custoTotal: Math.round(dados.quantidade * dados.precoUnitario * 100) / 100,
            observacoes:
              dados.origem === "INVENTARIO_INICIAL"
                ? "Inventário inicial"
                : dados.fornecedor
                  ? `Compra - ${dados.fornecedor}`
                  : undefined,
          },
        });

        return criado;
      });

      return reply.status(201).send(lote);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/lotes/:id",
    { preHandler: fastify.requirePermissao("estoque", "EDITAR") },
    async (request, reply) => {
      const dados = z
        .object({
          precoUnitario: z.number().min(0).optional(),
          fornecedor: z.string().optional(),
          numeroNota: z.string().optional(),
          observacoes: z.string().optional(),
          data: z.coerce.date().optional(),
        })
        .parse(request.body);

      const existente = await fastify.prisma.loteInsumo.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();

      const lote = await fastify.prisma.loteInsumo.update({
        where: { id: existente.id },
        data: dados,
      });
      return reply.send(lote);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/lotes/:id",
    { preHandler: fastify.requirePermissao("estoque", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.loteInsumo.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();

      // Lote parcialmente consumido nao pode sumir: o custo ja lancado em
      // operacoes ficaria orfao.
      if (existente.quantidadeRestante < existente.quantidade) {
        throw new AppError(
          "Este lote já teve produto usado em operações e não pode ser excluído. Ajuste a quantidade por um lançamento de ajuste.",
          400,
        );
      }

      await fastify.prisma.$transaction(async (tx) => {
        await tx.movimentacaoEstoque.deleteMany({ where: { loteId: existente.id } });
        await tx.loteInsumo.delete({ where: { id: existente.id } });
      });
      return reply.status(204).send();
    },
  );
}
