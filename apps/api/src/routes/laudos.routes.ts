import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, NaoEncontradoError } from "../lib/errors.js";
import { lerLaudo, LaudoInvalidoError, type Planilha } from "../services/analiseLaudo.js";
import { confirmarAmostras, sugerirTalhao } from "../services/importacaoLaudo.js";

/**
 * Importacao de laudos de laboratorio.
 *
 * O ARQUIVO NAO SOBE PARA O SERVIDOR. O navegador abre a planilha, manda a
 * matriz de celulas em JSON, e o servidor le e guarda o resultado. Isso evita
 * armazenamento de arquivo na maquina de 1 GB e evita subir documento com nome
 * e endereco do produtor - o que interessa e o numero, nao o arquivo.
 */

const celulaSchema = z.union([z.string(), z.number(), z.null()]);
const planilhaSchema = z.array(z.array(celulaSchema)).min(1).max(500);

const enviarSchema = z.object({
  nomeArquivo: z.string().min(1),
  planilha: planilhaSchema.optional(),
  /** Para PDF: o texto extraido, sem valores. O usuario digita conferindo. */
  textoExtraido: z.string().optional(),
});

const confirmarSchema = z.object({
  amostras: z
    .array(
      z.object({
        amostraId: z.string().uuid(),
        talhaoId: z.string().uuid().nullish(),
        loteCompostoId: z.string().uuid().nullish(),
        valores: z.record(z.string(), z.number()),
        dataColeta: z.string().nullish(),
        profundidade: z.string().nullish(),
      }),
    )
    .min(1),
});

export default async function laudosRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("analises", "VER"));

  /** Fila de conferencia, com a sugestao de talhao ja calculada. */
  fastify.get("/laudos", async (request) => {
    const { situacao } = z
      .object({ situacao: z.enum(["PENDENTE", "IMPORTADO", "IGNORADO"]).optional() })
      .parse(request.query);

    const [laudos, talhoes] = await Promise.all([
      fastify.prisma.laudoImportado.findMany({
        where: { propriedadeId: request.user.propriedadeId, situacao },
        include: { amostras: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      fastify.prisma.talhao.findMany({
        where: { propriedadeId: request.user.propriedadeId },
        select: { id: true, nome: true, codigo: true },
      }),
    ]);

    return laudos.map((l) => ({
      ...l,
      amostras: l.amostras.map((a) => ({
        ...a,
        // Sugestao calculada na hora, nao gravada: se o produtor renomear um
        // talhao, a sugestao acompanha em vez de ficar presa ao nome antigo.
        sugestao: a.talhaoId ? null : sugerirTalhao(a.identificacao, talhoes),
      })),
    }));
  });

  fastify.post(
    "/laudos",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request, reply) => {
      const dados = enviarSchema.parse(request.body);

      if (!dados.planilha && !dados.textoExtraido) {
        throw new AppError("Envie a planilha do laudo ou o texto do PDF.", 422);
      }

      // PDF: nao extrai numero. O texto do laudo junta valores ("23,7512,21"
      // sao dois numeros) e quebra numero entre linhas. Chutar aqui gravaria
      // 23,75 onde era 2.375 - e adubacao em cima de valor errado e prejuizo.
      if (!dados.planilha) {
        const laudo = await fastify.prisma.laudoImportado.create({
          data: {
            nomeArquivo: dados.nomeArquivo,
            tipo: "QUIMICA",
            digitacaoManual: true,
            textoExtraido: dados.textoExtraido,
            propriedadeId: request.user.propriedadeId,
            amostras: {
              create: [{ valores: {}, naoReconhecidas: [] }],
            },
          },
          include: { amostras: true },
        });
        return reply.status(201).send(laudo);
      }

      let lido;
      try {
        lido = lerLaudo(dados.planilha as Planilha);
      } catch (err) {
        if (err instanceof LaudoInvalidoError) throw new AppError(err.message, 422);
        throw err;
      }

      const laudo = await fastify.prisma.laudoImportado.create({
        data: {
          nomeArquivo: dados.nomeArquivo,
          tipo: lido.tipo,
          cliente: lido.cliente,
          material: lido.material,
          dataColeta: lido.dataColeta,
          propriedadeId: request.user.propriedadeId,
          amostras: {
            create: lido.amostras.map((a) => ({
              codigoLaboratorio: a.codigoLaboratorio,
              identificacao: a.identificacao,
              profundidade: a.profundidade,
              valores: a.valores,
              naoReconhecidas: a.naoReconhecidas,
            })),
          },
        },
        include: { amostras: true },
      });

      return reply.status(201).send(laudo);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/laudos/:id/confirmar",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request) => {
      const { amostras } = confirmarSchema.parse(request.body);
      return confirmarAmostras(
        fastify.prisma,
        request.user.propriedadeId,
        request.user.sub,
        request.params.id,
        amostras,
      );
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/laudos/:id/ignorar",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request) => {
      const laudo = await fastify.prisma.laudoImportado.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!laudo) throw new NaoEncontradoError();
      return fastify.prisma.laudoImportado.update({
        where: { id: laudo.id },
        data: { situacao: "IGNORADO" },
      });
    },
  );

  /** Volta para a fila. Nao apaga as analises ja gravadas - so reabre. */
  fastify.patch<{ Params: { id: string } }>(
    "/laudos/:id/reabrir",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request) => {
      const laudo = await fastify.prisma.laudoImportado.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!laudo) throw new NaoEncontradoError();
      return fastify.prisma.laudoImportado.update({
        where: { id: laudo.id },
        data: { situacao: "PENDENTE", importadoEm: null, importadoPorId: null },
      });
    },
  );

  // --- lotes de composto -----------------------------------------------------

  fastify.get("/lotes-composto", async (request) =>
    fastify.prisma.loteComposto.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      include: { insumo: { select: { id: true, nome: true } }, analises: true },
      orderBy: { createdAt: "desc" },
    }),
  );

  fastify.post(
    "/lotes-composto",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request, reply) => {
      const dados = z
        .object({
          nome: z.string().min(1),
          dataProducao: z.string().nullish(),
          origem: z.string().nullish(),
          observacoes: z.string().nullish(),
        })
        .parse(request.body);

      const lote = await fastify.prisma.loteComposto.create({
        data: {
          nome: dados.nome,
          dataProducao: dados.dataProducao ? new Date(dados.dataProducao) : null,
          origem: dados.origem ?? null,
          observacoes: dados.observacoes ?? null,
          propriedadeId: request.user.propriedadeId,
        },
      });
      return reply.status(201).send(lote);
    },
  );
}
