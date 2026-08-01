import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  agrofitConfigurado,
  listarCulturas,
  listarIngredientesAtivos,
  listarPragas,
  paginaDeProdutosFormulados,
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

// A API da Embrapa so aceita `page` — nenhum filtro funciona (ver o comentario
// em services/agrofit.ts). Por isso aqui nao ha parametro de busca: seria
// prometer ao frontend algo que a fonte nao entrega.
const paginaSchema = z.object({
  pagina: z.coerce.number().int().positive().max(200).optional(),
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
    const { pagina } = paginaSchema.parse(request.query);
    return paginaDeProdutosFormulados(pagina ?? 1);
  });

  fastify.get("/agrofit/culturas", async () => listarCulturas());

  fastify.get("/agrofit/ingredientes-ativos", async () => listarIngredientesAtivos());

  fastify.get("/agrofit/pragas", async (request) => {
    const { pagina } = paginaSchema.parse(request.query);
    return listarPragas(pagina ?? 1);
  });
}
