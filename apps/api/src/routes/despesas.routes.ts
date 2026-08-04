import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";

const CATEGORIAS = [
  "ADMINISTRATIVO",
  "CONTABILIDADE",
  "IMPOSTOS_TAXAS",
  "MANUTENCAO",
  "DEPRECIACAO",
  "FRETE",
  "OUTROS",
] as const;

// talhaoId ausente = despesa geral do sitio (rateada por area no DRE por
// talhao). Nao ha lancamento com dois talhoes: quem for de um so, informa o
// talhao; quem for de mais de um mas nao de todos, ainda cai como "geral" -
// simplificacao aceita porque este e o caso raro.
const despesaSchema = z.object({
  talhaoId: z.string().uuid().optional().nullable(),
  categoria: z.enum(CATEGORIAS),
  descricao: z.string().min(1),
  valor: z.number().positive(),
  data: z.coerce.date(),
  observacoes: z.string().optional().nullable(),
});

const INCLUDE = {
  talhao: { select: { id: true, nome: true, codigo: true } },
} as const;

export default async function despesasRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("dre", "VER"));

  fastify.get("/despesas", async (request) => {
    const query = request.query as { dataInicio?: string; dataFim?: string; talhaoId?: string };
    return fastify.prisma.despesa.findMany({
      where: {
        propriedadeId: request.user.propriedadeId,
        talhaoId: query.talhaoId ?? undefined,
        data: {
          gte: query.dataInicio ? new Date(query.dataInicio) : undefined,
          lte: query.dataFim ? new Date(query.dataFim) : undefined,
        },
      },
      include: INCLUDE,
      orderBy: { data: "desc" },
    });
  });

  fastify.post(
    "/despesas",
    { preHandler: fastify.requirePermissao("dre", "EDITAR") },
    async (request, reply) => {
      const dados = despesaSchema.parse(request.body);
      const propriedadeId = request.user.propriedadeId;
      if (dados.talhaoId) {
        const talhao = await fastify.prisma.talhao.findFirst({ where: { id: dados.talhaoId, propriedadeId } });
        if (!talhao) throw new NaoEncontradoError("Talhão não encontrado");
      }
      const criada = await fastify.prisma.despesa.create({
        data: {
          talhaoId: dados.talhaoId ?? undefined,
          categoria: dados.categoria,
          descricao: dados.descricao,
          valor: dados.valor,
          data: dados.data,
          observacoes: dados.observacoes ?? undefined,
          propriedadeId,
          criadoPorId: request.user.sub,
        },
        include: INCLUDE,
      });
      return reply.status(201).send(criada);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/despesas/:id",
    { preHandler: fastify.requirePermissao("dre", "EDITAR") },
    async (request, reply) => {
      const dados = despesaSchema.partial().parse(request.body);
      const existente = await fastify.prisma.despesa.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const atualizada = await fastify.prisma.despesa.update({
        where: { id: existente.id },
        data: {
          talhaoId: dados.talhaoId === undefined ? undefined : dados.talhaoId,
          categoria: dados.categoria,
          descricao: dados.descricao,
          valor: dados.valor,
          data: dados.data,
          observacoes: dados.observacoes === undefined ? undefined : dados.observacoes,
        },
        include: INCLUDE,
      });
      return reply.send(atualizada);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/despesas/:id",
    { preHandler: fastify.requirePermissao("dre", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.despesa.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.despesa.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
