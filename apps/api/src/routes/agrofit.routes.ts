import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  agrofitConfigurado,
  buscarProdutosFormulados,
  listarCulturas,
  listarPragas,
  testarConexao,
} from "../services/agrofit.js";

/**
 * Ponte entre o sistema e o cadastro oficial do MAPA.
 *
 * Tudo passa por aqui, e nao direto do navegador, por dois motivos: a
 * credencial da Embrapa fica no servidor, e o limite de 100 mil requisicoes
 * por mes e da propriedade inteira — controlar de um lugar so e o que permite
 * cachear e nao estourar.
 */

const filtrosSchema = z.object({
  cultura: z.string().optional(),
  praga: z.string().optional(),
  ingredienteAtivo: z.string().optional(),
  marcaComercial: z.string().optional(),
  pagina: z.coerce.number().int().positive().optional(),
  tamanho: z.coerce.number().int().positive().max(100).optional(),
});

export default async function agrofitRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  // Quem cuida de praga e quem consulta registro de produto.
  fastify.addHook("preHandler", fastify.requirePermissao("pragas", "VER"));

  /** Diz se a integracao esta de pe, sem expor nada da credencial. */
  fastify.get("/agrofit/situacao", async () => {
    if (!agrofitConfigurado()) {
      return {
        configurado: false,
        mensagem:
          "Credenciais do Agrofit não configuradas no servidor (AGROFIT_CONSUMER_KEY e AGROFIT_CONSUMER_SECRET).",
      };
    }
    try {
      await testarConexao();
      return { configurado: true, autenticado: true };
    } catch (err) {
      return {
        configurado: true,
        autenticado: false,
        mensagem: err instanceof Error ? err.message : "Falha ao autenticar",
      };
    }
  });

  fastify.get("/agrofit/produtos", async (request) => {
    const filtros = filtrosSchema.parse(request.query);
    return buscarProdutosFormulados(filtros);
  });

  fastify.get("/agrofit/culturas", async () => listarCulturas());

  fastify.get("/agrofit/pragas", async (request) => {
    const { nome, pagina } = z
      .object({ nome: z.string().optional(), pagina: z.coerce.number().int().positive().optional() })
      .parse(request.query);
    return listarPragas({ nome, pagina });
  });
}
