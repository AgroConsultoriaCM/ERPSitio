import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, NaoEncontradoError } from "../lib/errors.js";
import {
  lerLaudo,
  lerTabelaOcr,
  LaudoInvalidoError,
  unidadeDoValor,
  chaveEhDerivada,
  type Planilha,
  type TipoLaudo,
} from "../services/analiseLaudo.js";
import { confirmarAmostras, sugerirTalhao } from "../services/importacaoLaudo.js";
import { ocrConfigurado, extrairTextoDoPdf } from "../services/ocr.js";

/**
 * Unidade e campos derivados de cada amostra — sempre recalculados a partir
 * do tipo do laudo e das chaves que a amostra tem, nunca gravados no banco.
 * Assim continuam corretos mesmo apos o usuario editar os valores na tela de
 * conferencia, e nao existe risco de desalinhar amostra com indice errado.
 */
function anotarAmostra<T extends { valores: unknown }>(tipo: TipoLaudo, amostra: T) {
  const valores = amostra.valores as Record<string, unknown>;
  const unidades: Record<string, string> = {};
  const camposDerivados: string[] = [];
  for (const chave of Object.keys(valores)) {
    const u = unidadeDoValor(tipo, chave);
    if (u) unidades[chave] = u;
    if (chaveEhDerivada(tipo, chave)) camposDerivados.push(chave);
  }
  return { ...amostra, unidades, camposDerivados };
}

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
  /** PDF em base64, para o OCR ler. Passa pela API mas nunca e salvo em disco nem no banco. */
  pdfBase64: z.string().max(15_000_000).optional(),
});

const confirmarSchema = z.object({
  amostras: z
    .array(
      z.object({
        amostraId: z.string().uuid(),
        /** Uma coleta pode valer para mais de um talhão. */
        talhaoIds: z.array(z.string().uuid()).default([]),
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
        ...anotarAmostra(l.tipo, a),
        // Sugestao calculada na hora, nao gravada: se o produtor renomear um
        // talhao, a sugestao acompanha em vez de ficar presa ao nome antigo.
        sugestao: a.talhaoIds.length === 0 ? sugerirTalhao(a.identificacao, talhoes) : null,
      })),
    }));
  });

  fastify.post(
    "/laudos",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request, reply) => {
      const dados = enviarSchema.parse(request.body);

      if (!dados.planilha && !dados.pdfBase64) {
        throw new AppError("Envie a planilha do laudo ou o arquivo PDF.", 422);
      }

      // PDF: nao extrai numero, so texto (via OCR quando configurado). O
      // texto do laudo junta valores ("23,7512,21" sao dois numeros) e quebra
      // numero entre linhas de jeito imprevisivel conforme o layout do
      // laboratorio. Chutar aqui gravaria 23,75 onde era 2.375 - e adubacao
      // em cima de valor errado e prejuizo. O OCR so orienta a digitacao.
      if (!dados.planilha) {
        let textoExtraido: string | null = null;
        if (dados.pdfBase64 && ocrConfigurado()) {
          try {
            textoExtraido = await extrairTextoDoPdf(dados.pdfBase64);
          } catch (err) {
            // OCR fora do ar ou PDF ilegivel nao pode travar o upload - o
            // laudo entra na fila do mesmo jeito, so sem o texto de apoio.
            textoExtraido = `(OCR não conseguiu ler este PDF: ${err instanceof Error ? err.message : "erro desconhecido"})`;
          }
        }

        // Quando o OCR leu com sucesso, tenta separar codigo/identificacao/
        // profundidade linha a linha - poupa digitar isso a mao amostra por
        // amostra. O bloco de nutrientes continua 100% manual (ver
        // lerTabelaOcr, no servico, para o motivo).
        const tabela = textoExtraido ? lerTabelaOcr(textoExtraido) : null;

        const laudo = await fastify.prisma.laudoImportado.create({
          data: {
            nomeArquivo: dados.nomeArquivo,
            tipo: tabela?.tipo ?? "QUIMICA",
            digitacaoManual: true,
            textoExtraido:
              textoExtraido ?? "PDF anexado: digite os valores conferindo o laudo original.",
            propriedadeId: request.user.propriedadeId,
            amostras: {
              create: tabela
                ? tabela.amostras.map((a) => ({
                    codigoLaboratorio: a.codigoLaboratorio,
                    identificacao: a.identificacao,
                    profundidade: a.profundidade,
                    linhaOriginal: a.linhaOriginal,
                    valores: {},
                    naoReconhecidas: [],
                  }))
                : [{ valores: {}, naoReconhecidas: [] }],
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
              avisosUnidade: a.avisosUnidade,
            })),
          },
        },
        include: { amostras: true },
      });

      return reply.status(201).send({
        ...laudo,
        amostras: laudo.amostras.map((a) => anotarAmostra(laudo.tipo, a)),
      });
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

  /**
   * Troca o tipo de um laudo digitado manualmente (PDF sem planilha). Ao
   * subir o PDF o sistema nao sabe se e quimica, fisica, foliar... e chuta
   * quimica por ser o mais comum; aqui o usuario corrige antes de digitar,
   * para os campos certos aparecerem na tela.
   */
  fastify.patch<{ Params: { id: string } }>(
    "/laudos/:id/tipo",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request) => {
      const { tipo } = z
        .object({ tipo: z.enum(["QUIMICA", "FISICA", "MICRO", "FOLIAR", "ORGANICO"]) })
        .parse(request.body);
      const laudo = await fastify.prisma.laudoImportado.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!laudo) throw new NaoEncontradoError();
      if (!laudo.digitacaoManual) {
        throw new AppError("Só é possível trocar o tipo de laudos digitados manualmente.", 422);
      }
      if (laudo.situacao === "IMPORTADO") {
        throw new AppError("Este laudo já foi importado.", 409);
      }
      return fastify.prisma.laudoImportado.update({ where: { id: laudo.id }, data: { tipo } });
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
