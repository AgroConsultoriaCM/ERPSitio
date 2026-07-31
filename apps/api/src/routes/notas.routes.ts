// Notas fiscais de entrada.
//
// O fluxo tem dois tempos de proposito:
//
//   1. a nota CHEGA e fica pendurada, sem tocar no estoque;
//   2. o gestor decide o que fazer com ela.
//
// A separacao existe porque a mesma caixa de e-mail recebe notas de mais de
// uma pessoa juridica da familia, notas canceladas, e compras que nao viram
// insumo. Entrada automatica e silenciosa viraria estoque errado que ninguem
// percebe - e estoque errado contamina o custo de toda pulverizacao.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { lerXmlNfe, conferirTotal, XmlInvalidoError } from "../services/nfe.js";
import { lerEmbalagem, sugerirNome } from "../services/embalagem.js";
import { AppError, NaoEncontradoError } from "../lib/errors.js";

const receberSchema = z.object({
  xml: z.string().min(1, "Envie o conteúdo do arquivo XML"),
  /** Nome do arquivo, so para o gestor se localizar na lista. */
  nomeArquivo: z.string().optional(),
});

const listarSchema = z.object({
  situacao: z.enum(["PENDENTE", "IMPORTADA", "IGNORADA"]).optional(),
});

/** Deixa so os digitos: CNPJ vem com pontuacao em uns lugares e sem em outros. */
function soDigitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

export default async function notasRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("notas", "VER"));

  /**
   * Recebe um XML e guarda a nota como PENDENTE.
   *
   * Nao mexe em estoque. Nota repetida nao e erro: devolve a que ja existe,
   * porque reenvio de e-mail e comum e nao deveria assustar ninguem.
   */
  fastify.post(
    "/notas",
    { preHandler: fastify.requirePermissao("notas", "EDITAR") },
    async (request, reply) => {
      const { xml, nomeArquivo } = receberSchema.parse(request.body);
      const propriedadeId = request.user.propriedadeId;

      let nota;
      try {
        nota = lerXmlNfe(xml);
      } catch (erro) {
        if (erro instanceof XmlInvalidoError) throw new AppError(erro.message, 400);
        throw erro;
      }

      const jaExiste = await fastify.prisma.notaFiscalEntrada.findUnique({
        where: { chaveAcesso: nota.chaveAcesso },
      });
      if (jaExiste) {
        return reply.status(200).send({ ...jaExiste, jaExistia: true });
      }

      const criada = await fastify.prisma.notaFiscalEntrada.create({
        data: {
          chaveAcesso: nota.chaveAcesso,
          numero: nota.numero,
          serie: nota.serie,
          dataEmissao: nota.dataEmissao,
          cnpjEmitente: nota.cnpjEmitente,
          nomeEmitente: nota.nomeEmitente,
          documentoDestinatario: nota.documentoDestinatario || null,
          nomeDestinatario: nota.nomeDestinatario || null,
          valorTotal: nota.valorTotal,
          xmlOriginal: xml,
          observacoes: nomeArquivo ?? null,
          propriedadeId,
        },
      });

      return reply.status(201).send({ ...criada, jaExistia: false });
    },
  );

  /**
   * Lista as notas com o que a tela precisa mostrar de cara, sem o XML
   * (que e grande e so interessa ao abrir uma nota especifica).
   */
  fastify.get("/notas", async (request) => {
    const { situacao } = listarSchema.parse(request.query);
    const propriedadeId = request.user.propriedadeId;

    const [propriedade, notas] = await Promise.all([
      fastify.prisma.propriedade.findUnique({
        where: { id: propriedadeId },
        select: { documento: true },
      }),
      fastify.prisma.notaFiscalEntrada.findMany({
        where: { propriedadeId, ...(situacao ? { situacao } : {}) },
        orderBy: { dataEmissao: "desc" },
        select: {
          id: true,
          chaveAcesso: true,
          numero: true,
          serie: true,
          dataEmissao: true,
          nomeEmitente: true,
          cnpjEmitente: true,
          nomeDestinatario: true,
          documentoDestinatario: true,
          valorTotal: true,
          situacao: true,
          origem: true,
          importadaEm: true,
          createdAt: true,
          _count: { select: { lotes: true } },
        },
      }),
    ]);

    const nosso = soDigitos(propriedade?.documento);

    return notas.map((n) => ({
      ...n,
      /**
       * Verde: emitida para a propriedade, e o que deve virar estoque.
       * Amarelo: chegou na mesma caixa, mas e de outra pessoa juridica.
       * Cinza: nao da para afirmar - a propriedade ainda nao tem documento
       * cadastrado, entao nao ha com o que comparar.
       */
      destinatarioEhNosso:
        nosso && n.documentoDestinatario ? soDigitos(n.documentoDestinatario) === nosso : null,
      quantidadeLotes: n._count.lotes,
      _count: undefined,
    }));
  });

  /** Uma nota com os itens ja lidos do XML, prontos para conferencia. */
  fastify.get("/notas/:id", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const propriedadeId = request.user.propriedadeId;

    const registro = await fastify.prisma.notaFiscalEntrada.findFirst({
      where: { id, propriedadeId },
      include: {
        lotes: { select: { id: true, insumoId: true, quantidade: true, precoUnitario: true } },
      },
    });
    if (!registro) throw new NaoEncontradoError("Nota não encontrada");

    const lida = lerXmlNfe(registro.xmlOriginal);
    const total = conferirTotal(lida);

    // O que o sistema ja sabe sobre os produtos deste fornecedor.
    const mapeamentos = await fastify.prisma.mapeamentoProdutoNota.findMany({
      where: { propriedadeId, cnpjEmitente: registro.cnpjEmitente },
      include: { insumo: { select: { id: true, nome: true, unidadeMedida: true } } },
    });
    const porCodigo = new Map(mapeamentos.map((m) => [m.codigoProduto, m]));

    const propriedade = await fastify.prisma.propriedade.findUnique({
      where: { id: propriedadeId },
      select: { documento: true },
    });
    const nosso = soDigitos(propriedade?.documento);

    return {
      ...registro,
      // O XML inteiro nao serve para a tela; quem quiser pode baixar depois.
      xmlOriginal: undefined,
      destinatarioEhNosso:
        nosso && registro.documentoDestinatario
          ? soDigitos(registro.documentoDestinatario) === nosso
          : null,
      totalConfere: total.confere,
      somaItens: total.somaItens,
      itens: lida.itens.map((item) => {
        const conhecido = porCodigo.get(item.codigo);
        // Lido da propria descricao: "( BD 20 LT )" vira 20 litros. O gestor
        // confere - por isso vai junto o trecho que gerou a leitura.
        const embalagem = lerEmbalagem(item.descricao);

        const fator = conhecido?.fatorConversao ?? embalagem?.quantidade ?? null;
        const unidade =
          conhecido?.insumo.unidadeMedida ??
          (embalagem ? (embalagem.base === "L" ? "L" : "kg") : null);

        return {
          ...item,
          /** Preenchido quando este produto ja foi lancado antes. */
          jaConhecido: Boolean(conhecido),
          insumoId: conhecido?.insumoId ?? null,
          insumoNome: conhecido?.insumo.nome ?? null,
          insumoUnidade: unidade,
          fatorConversao: fator,
          /** De onde saiu a leitura automatica, para conferencia de relance. */
          fatorSugerido: embalagem?.quantidade ?? null,
          trechoEmbalagem: embalagem?.trecho ?? null,
          nomeSugerido: conhecido?.insumo.nome ?? sugerirNome(item.descricao),
          /** Quanto entra de fato no estoque, na unidade do produto. */
          quantidadeConvertida: fator ? item.quantidade * fator : null,
          custoConvertido:
            fator && fator > 0 ? Math.round((item.custoUnitarioReal / fator) * 100) / 100 : null,
        };
      }),
    };
  });

  /**
   * Confirma a entrada: transforma os itens escolhidos em lotes de estoque.
   *
   * E aqui que a nota finalmente mexe no estoque, e so aqui. Tudo numa
   * transacao: ou entra a nota inteira, ou nao entra nada. Meia importacao
   * deixaria estoque parcial que ninguem consegue auditar depois.
   */
  fastify.post(
    "/notas/:id/importar",
    { preHandler: fastify.requirePermissao("notas", "EDITAR") },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const { itens } = z
        .object({
          itens: z
            .array(
              z.object({
                numeroItem: z.number().int().positive(),
                /**
                 * Opcional de proposito: quando vem vazio, o produto nasce da
                 * propria nota. Obrigar a apontar um cadastro anterior sig-
                 * nificaria cadastrar tudo a mao antes da primeira importacao.
                 */
                insumoId: z.string().uuid().optional(),
                /** Nome do produto novo. Sem ele, usa o sugerido da descricao. */
                nomeNovoProduto: z.string().min(1).optional(),
                /** Litro ou quilo - nunca embalagem, para a sobra do galao voltar. */
                unidadeNovoProduto: z.string().min(1).optional(),
                funcoesNovoProduto: z
                  .array(
                    z.enum([
                      "INSETICIDA",
                      "FUNGICIDA",
                      "HERBICIDA",
                      "ACARICIDA",
                      "NEMATICIDA",
                      "NUTRICAO_FOLIAR",
                      "FERTILIZANTE_SOLO",
                      "ADJUVANTE",
                      "OUTRO",
                    ]),
                  )
                  .optional(),
                /** 1 balde de 20 L -> 20. Zero ou negativo nao faz sentido. */
                fatorConversao: z.number().positive().default(1),
                /** Guardar para reconhecer sozinho na proxima nota deste fornecedor. */
                lembrarProduto: z.boolean().default(true),
              }),
            )
            .min(1, "Escolha ao menos um item para lançar no estoque"),
        })
        .parse(request.body);

      const propriedadeId = request.user.propriedadeId;

      const registro = await fastify.prisma.notaFiscalEntrada.findFirst({
        where: { id, propriedadeId },
      });
      if (!registro) throw new NaoEncontradoError("Nota não encontrada");
      if (registro.situacao === "IMPORTADA") {
        throw new AppError("Esta nota já foi lançada no estoque.", 409);
      }

      const lida = lerXmlNfe(registro.xmlOriginal);
      const porNumero = new Map(lida.itens.map((i) => [i.numero, i]));

      // Confere tudo ANTES de abrir a transacao: erro de referencia deve
      // aparecer como mensagem, nao como transacao abortada pela metade.
      const insumosPedidos = [
        ...new Set(itens.map((i) => i.insumoId).filter((v): v is string => Boolean(v))),
      ];
      if (insumosPedidos.length) {
        const insumos = await fastify.prisma.insumo.findMany({
          where: { id: { in: insumosPedidos }, propriedadeId },
          select: { id: true },
        });
        if (insumos.length !== insumosPedidos.length) {
          throw new AppError("Algum produto escolhido não existe nesta propriedade.", 400);
        }
      }
      for (const escolha of itens) {
        if (!porNumero.has(escolha.numeroItem)) {
          throw new AppError(`A nota não tem o item ${escolha.numeroItem}.`, 400);
        }
      }

      const resultado = await fastify.prisma.$transaction(async (tx) => {
        const lotesCriados = [];

        for (const escolha of itens) {
          const item = porNumero.get(escolha.numeroItem)!;

          // Produto que ainda nao existe nasce aqui, da propria nota. Exigir
          // um cadastro anterior significaria cadastrar tudo a mao antes da
          // primeira importacao - trabalho que a nota ja fez.
          let insumoId = escolha.insumoId;
          if (!insumoId) {
            const embalagem = lerEmbalagem(item.descricao);
            const unidade =
              escolha.unidadeNovoProduto ??
              (embalagem ? (embalagem.base === "L" ? "L" : "kg") : item.unidade.toLowerCase());
            const funcoes = escolha.funcoesNovoProduto ?? [];

            const criado = await tx.insumo.create({
              data: {
                nome: escolha.nomeNovoProduto ?? sugerirNome(item.descricao),
                unidadeMedida: unidade,
                funcoes,
                // Sem funcao declarada nao da para afirmar que e defensivo.
                categoria: funcoes.length ? "DEFENSIVO" : "OUTRO",
                propriedadeId,
              },
            });
            insumoId = criado.id;
          }

          // A nota diz "3 BD"; o estoque controla em litros. Sem converter,
          // o custo por talhao erraria pelo tamanho da embalagem.
          const quantidade = item.quantidade * escolha.fatorConversao;
          const precoUnitario =
            escolha.fatorConversao > 0
              ? Math.round((item.custoUnitarioReal / escolha.fatorConversao) * 100) / 100
              : 0;

          const lote = await tx.loteInsumo.create({
            data: {
              insumoId,
              origem: "COMPRA",
              data: registro.dataEmissao,
              quantidade,
              quantidadeRestante: quantidade,
              precoUnitario,
              fornecedor: registro.nomeEmitente,
              numeroNota: `${registro.numero}/${registro.serie}`,
              observacoes: item.descricao,
              notaFiscalId: registro.id,
              propriedadeId,
            },
          });

          await tx.movimentacaoEstoque.create({
            data: {
              insumoId,
              propriedadeId,
              tipo: "ENTRADA",
              origem: "COMPRA",
              quantidade,
              data: registro.dataEmissao,
              loteId: lote.id,
              custoUnitario: precoUnitario,
              custoTotal: Math.round(quantidade * precoUnitario * 100) / 100,
              observacoes: `NF ${registro.numero} - ${registro.nomeEmitente}`,
            },
          });

          if (escolha.lembrarProduto) {
            await tx.mapeamentoProdutoNota.upsert({
              where: {
                propriedadeId_cnpjEmitente_codigoProduto: {
                  propriedadeId,
                  cnpjEmitente: registro.cnpjEmitente,
                  codigoProduto: item.codigo,
                },
              },
              create: {
                propriedadeId,
                cnpjEmitente: registro.cnpjEmitente,
                codigoProduto: item.codigo,
                descricaoNota: item.descricao,
                unidadeNota: item.unidade,
                insumoId,
                fatorConversao: escolha.fatorConversao,
              },
              update: {
                descricaoNota: item.descricao,
                unidadeNota: item.unidade,
                insumoId,
                fatorConversao: escolha.fatorConversao,
              },
            });
          }

          lotesCriados.push(lote);
        }

        const nota = await tx.notaFiscalEntrada.update({
          where: { id: registro.id },
          data: {
            situacao: "IMPORTADA",
            importadaEm: new Date(),
            importadaPorId: request.user.sub,
          },
        });

        return { nota, lotes: lotesCriados };
      });

      return reply.status(201).send({
        nota: resultado.nota,
        lotesCriados: resultado.lotes.length,
        lotes: resultado.lotes,
      });
    },
  );

  /** Marca a nota como fora do nosso interesse, sem apagar nada. */
  fastify.patch(
    "/notas/:id/ignorar",
    { preHandler: fastify.requirePermissao("notas", "EDITAR") },
    async (request) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const { motivo } = z.object({ motivo: z.string().optional() }).parse(request.body ?? {});
      const propriedadeId = request.user.propriedadeId;

      const existente = await fastify.prisma.notaFiscalEntrada.findFirst({
        where: { id, propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError("Nota não encontrada");
      if (existente.situacao === "IMPORTADA") {
        throw new AppError(
          "Esta nota já virou estoque. Para desfazer, remova os lotes que ela gerou.",
          409,
        );
      }

      return fastify.prisma.notaFiscalEntrada.update({
        where: { id },
        data: { situacao: "IGNORADA", observacoes: motivo ?? existente.observacoes },
      });
    },
  );

  /** Volta uma nota ignorada para a fila. */
  fastify.patch(
    "/notas/:id/reabrir",
    { preHandler: fastify.requirePermissao("notas", "EDITAR") },
    async (request) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const propriedadeId = request.user.propriedadeId;

      const existente = await fastify.prisma.notaFiscalEntrada.findFirst({
        where: { id, propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError("Nota não encontrada");
      if (existente.situacao === "IMPORTADA") {
        throw new AppError("Esta nota já virou estoque.", 409);
      }

      return fastify.prisma.notaFiscalEntrada.update({
        where: { id },
        data: { situacao: "PENDENTE" },
      });
    },
  );
}
