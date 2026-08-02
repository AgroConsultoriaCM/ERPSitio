import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError, AppError } from "../lib/errors.js";
import { imagemNdvi, sateliteConfigurado, type PoligonoGeoJSON } from "../services/satelite.js";
import { leiturasArmazenadas } from "../services/leituraSatelite.js";
import { sincronizarLeiturasSatelite } from "../services/sincronizacaoSatelite.js";
import { calcularNota } from "../services/notaTalhao.js";

/**
 * Satelite por talhao.
 *
 * A curva de vigor e a nota NAO chamam o Copernicus mais - leem a tabela
 * LeituraSatelite, alimentada por POST /satelite/sincronizar. Consulta ao
 * banco e instantanea; a chamada externa so acontece quando alguem pede
 * sincronizacao (pensado para rodar 1x por mes, nao a cada abertura de tela).
 *
 * A imagem NDVI (/ndvi.png) continua ao vivo de proposito: e visual, aberta
 * deliberadamente por uma pessoa, nao um lote de sete chamadas automaticas -
 * e ja tem 30 min de cache.
 */

async function buscarTalhao(fastify: FastifyInstance, talhaoId: string, propriedadeId: string) {
  const talhao = await fastify.prisma.talhao.findFirst({
    where: { id: talhaoId, propriedadeId },
    select: { id: true, nome: true, codigo: true, poligono: true },
  });
  if (!talhao) throw new NaoEncontradoError();
  return talhao;
}

function exigirPoligono(talhao: { poligono: unknown }): PoligonoGeoJSON {
  const poligono = talhao.poligono as PoligonoGeoJSON | null;
  if (!poligono || poligono.type !== "Polygon" || !poligono.coordinates?.[0]?.length) {
    throw new AppError(
      "Este talhão ainda não tem contorno desenhado. Desenhe o polígono na aba Mapa para usar o satélite.",
      422,
    );
  }
  return poligono;
}

export default async function sateliteRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("analises", "VER"));

  fastify.get("/satelite/situacao", async () => ({
    configurado: sateliteConfigurado(),
  }));

  /**
   * Dispara a sincronizacao: busca a leitura recente de cada talhao e grava
   * no banco. E a UNICA rota deste arquivo que fala com o Copernicus.
   */
  fastify.post(
    "/satelite/sincronizar",
    { preHandler: fastify.requirePermissao("analises", "EDITAR") },
    async (request) => {
      const resultados = await sincronizarLeiturasSatelite(fastify.prisma, request.user.propriedadeId);
      return { resultados };
    },
  );

  /** Imagem NDVI recortada no contorno, pronta para exibir. Ao vivo. */
  fastify.get<{ Params: { id: string } }>("/talhoes/:id/ndvi.png", async (request, reply) => {
    const { dias, largura } = z
      .object({
        dias: z.coerce.number().int().min(10).max(365).optional(),
        largura: z.coerce.number().int().min(128).max(1024).optional(),
      })
      .parse(request.query);

    const talhao = await buscarTalhao(fastify, request.params.id, request.user.propriedadeId);
    const poligono = exigirPoligono(talhao);
    const png = await imagemNdvi(poligono, { dias, largura });

    return reply
      .header("Content-Type", "image/png")
      .header("Cache-Control", "private, max-age=1800")
      .send(png);
  });

  /** Serie de vigor + nota, lidas do banco. Nenhuma chamada externa aqui. */
  fastify.get<{ Params: { id: string } }>("/talhoes/:id/satelite", async (request) => {
    const { meses, anosBase } = z
      .object({
        meses: z.coerce.number().int().min(3).max(24).optional(),
        anosBase: z.coerce.number().int().min(1).max(9).optional(),
      })
      .parse(request.query);

    const talhao = await buscarTalhao(fastify, request.params.id, request.user.propriedadeId);
    exigirPoligono(talhao); // só para a mensagem de erro certa; a leitura em si não precisa do GeoJSON

    const hoje = new Date();
    const mesesRecentes = meses ?? 6;
    const anos = anosBase ?? 4;

    const desde = new Date(hoje);
    desde.setFullYear(desde.getFullYear() - anos);
    const todas = await leiturasArmazenadas(fastify.prisma, talhao.id, desde);

    const limiteRecentes = new Date(hoje);
    limiteRecentes.setMonth(limiteRecentes.getMonth() - mesesRecentes);
    const recentes = todas.filter((l) => new Date(l.data) >= limiteRecentes);

    // Mesmo mes, em anos ANTERIORES: e o que responde "este talhao esta pior
    // que o normal PARA ESTA EPOCA", em vez de comparar julho com janeiro.
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const historicoMesmoMes = todas.filter(
      (l) => new Date(l.data).getMonth() === mesAtual && new Date(l.data).getFullYear() < anoAtual,
    );

    return {
      talhao: { id: talhao.id, nome: talhao.nome, codigo: talhao.codigo },
      nota: calcularNota(recentes, historicoMesmoMes),
      recentes,
      historicoMesmoMes,
      ultimaSincronizacao: todas.length > 0 ? todas[todas.length - 1].data : null,
      fonte: "Contains modified Copernicus Sentinel data " + hoje.getFullYear(),
    };
  });
}
