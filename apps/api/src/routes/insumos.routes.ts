import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError } from "../lib/errors.js";

const FUNCOES = [
  "INSETICIDA",
  "FUNGICIDA",
  "HERBICIDA",
  "ACARICIDA",
  "NEMATICIDA",
  "NUTRICAO_FOLIAR",
  "FERTILIZANTE_SOLO",
  "ADJUVANTE",
  "OUTRO",
] as const;

const insumoSchema = z.object({
  nome: z.string().min(1),
  categoria: z.enum(["DEFENSIVO", "FERTILIZANTE", "EMBALAGEM", "OUTRO"]),
  // Eixo separado da categoria/funcoes: decide o fluxo financeiro ao
  // confirmar uma nota (ver comentario do enum TipoInsumo no schema).
  tipo: z.enum(["INSUMO", "BEM"]).default("INSUMO"),
  // Base do controle de pragas. Lista porque um mesmo defensivo age como
  // fungicida e acaricida - e a aplicacao conta para as duas funcoes.
  funcoes: z.array(z.enum(FUNCOES)).default([]),
  // Litro ou quilo, nunca embalagem: e o que permite devolver ao estoque a
  // sobra do galao depois da pulverizacao.
  unidadeMedida: z.string().min(1),
  estoqueMinimo: z.number().optional().nullable(),
  // Dose de bula, na unidade do proprio produto: produto em litros guarda
  // mL por 100 L e L por hectare; em quilos, gramas e quilos.
  dosePor100L: z.number().positive().optional().nullable(),
  dosePorHectare: z.number().positive().optional().nullable(),
  observacoesDose: z.string().optional().nullable(),
  fabricante: z.string().optional().nullable(),
});

export default async function insumosRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/insumos", async (request) => {
    const insumos = await fastify.prisma.insumo.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      orderBy: { nome: "asc" },
    });

    const saldos = await fastify.prisma.movimentacaoEstoque.groupBy({
      by: ["insumoId", "tipo"],
      where: { propriedadeId: request.user.propriedadeId },
      _sum: { quantidade: true },
    });

    const saldoPorInsumo = new Map<string, number>();
    for (const linha of saldos) {
      const atual = saldoPorInsumo.get(linha.insumoId) ?? 0;
      const valor = linha._sum.quantidade ?? 0;
      saldoPorInsumo.set(linha.insumoId, atual + (linha.tipo === "SAIDA" ? -valor : valor));
    }

    // Historico de compra: alimenta o preco medio e a lista dos ultimos
    // precos pagos. So COMPRA - inventario inicial e ajuste nao sao preco de
    // mercado e distorceriam a media.
    const compras = await fastify.prisma.loteInsumo.findMany({
      where: { propriedadeId: request.user.propriedadeId, origem: "COMPRA" },
      orderBy: { data: "desc" },
      select: {
        insumoId: true,
        data: true,
        quantidade: true,
        precoUnitario: true,
        fornecedor: true,
        numeroNota: true,
      },
    });

    const historico = new Map<
      string,
      { valor: number; quantidade: number; ultimas: typeof compras }
    >();
    for (const c of compras) {
      const h = historico.get(c.insumoId) ?? { valor: 0, quantidade: 0, ultimas: [] };
      h.valor += c.quantidade * c.precoUnitario;
      h.quantidade += c.quantidade;
      if (h.ultimas.length < 5) h.ultimas.push(c);
      historico.set(c.insumoId, h);
    }

    return insumos.map((insumo) => {
      const h = historico.get(insumo.id);
      return {
        ...insumo,
        saldoAtual: saldoPorInsumo.get(insumo.id) ?? 0,
        // Media ponderada pela quantidade: comprar 60 L a R$ 28 e 2 L a R$ 50
        // nao da R$ 39 - da R$ 28,71. A media simples mentiria.
        precoMedio:
          h && h.quantidade > 0 ? Math.round((h.valor / h.quantidade) * 100) / 100 : null,
        totalComprado: h?.quantidade ?? 0,
        ultimasCompras:
          h?.ultimas.map((c) => ({
            data: c.data,
            precoUnitario: c.precoUnitario,
            quantidade: c.quantidade,
            fornecedor: c.fornecedor,
            numeroNota: c.numeroNota,
          })) ?? [],
      };
    });
  });

  fastify.post(
    "/insumos",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = insumoSchema.parse(request.body);
      const insumo = await fastify.prisma.insumo.create({
        data: { ...dados, propriedadeId: request.user.propriedadeId },
      });
      return reply.status(201).send(insumo);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/insumos/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = insumoSchema.partial().parse(request.body);
      const existente = await fastify.prisma.insumo.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const insumo = await fastify.prisma.insumo.update({ where: { id: existente.id }, data: dados });
      return reply.send(insumo);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/insumos/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.insumo.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.insumo.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
