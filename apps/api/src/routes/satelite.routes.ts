import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NaoEncontradoError, AppError } from "../lib/errors.js";
import {
  imagemNdvi,
  sateliteConfigurado,
  serieSatelite,
  type PoligonoGeoJSON,
} from "../services/satelite.js";
import { calcularNota, type LeituraSatelite } from "../services/notaTalhao.js";

/**
 * Satelite por talhao.
 *
 * Passa pelo servidor por tres motivos: a credencial do Copernicus nao pode
 * chegar ao navegador, a cota mensal e da propriedade inteira (controlar de um
 * lugar so e o que permite cachear), e o contorno do talhao ja esta aqui - o
 * frontend nao precisa saber de GeoJSON nem de evalscript.
 */

async function poligonoDoTalhao(
  fastify: FastifyInstance,
  talhaoId: string,
  propriedadeId: string,
) {
  const talhao = await fastify.prisma.talhao.findFirst({
    where: { id: talhaoId, propriedadeId },
    select: { id: true, nome: true, codigo: true, poligono: true },
  });
  if (!talhao) throw new NaoEncontradoError();

  const poligono = talhao.poligono as PoligonoGeoJSON | null;
  if (!poligono || poligono.type !== "Polygon" || !poligono.coordinates?.[0]?.length) {
    throw new AppError(
      "Este talhão ainda não tem contorno desenhado. Desenhe o polígono na aba Mapa para usar o satélite.",
      422,
    );
  }
  return { talhao, poligono };
}

export default async function sateliteRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("analises", "VER"));

  fastify.get("/satelite/situacao", async () => ({
    configurado: sateliteConfigurado(),
  }));

  /** Imagem NDVI recortada no contorno, pronta para exibir. */
  fastify.get<{ Params: { id: string } }>("/talhoes/:id/ndvi.png", async (request, reply) => {
    const { dias, largura } = z
      .object({
        dias: z.coerce.number().int().min(10).max(365).optional(),
        largura: z.coerce.number().int().min(128).max(1024).optional(),
      })
      .parse(request.query);

    const { poligono } = await poligonoDoTalhao(
      fastify,
      request.params.id,
      request.user.propriedadeId,
    );
    const png = await imagemNdvi(poligono, { dias, largura });

    // Cena do Sentinel-2 muda a cada ~5 dias; meia hora de cache poupa
    // requisicao sem atrasar nada que importe.
    return reply
      .header("Content-Type", "image/png")
      .header("Cache-Control", "private, max-age=1800")
      .send(png);
  });

  /**
   * Serie recente + historico do mesmo mes + a nota.
   *
   * Duas chamadas ao Copernicus por talhao: uma para os ultimos meses, outra
   * para o mesmo mes dos anos anteriores. O arquivo do Sentinel-2 alcanca
   * 2017, entao a linha de base ja nasce com varios anos.
   */
  fastify.get<{ Params: { id: string } }>("/talhoes/:id/satelite", async (request) => {
    const { meses, anosBase } = z
      .object({
        meses: z.coerce.number().int().min(3).max(24).optional(),
        anosBase: z.coerce.number().int().min(1).max(9).optional(),
      })
      .parse(request.query);

    const { talhao, poligono } = await poligonoDoTalhao(
      fastify,
      request.params.id,
      request.user.propriedadeId,
    );

    const hoje = new Date();
    const mesesRecentes = meses ?? 6;
    const anos = anosBase ?? 4;

    const recentes = await serieSatelite(poligono, {
      de: new Date(hoje.getTime() - mesesRecentes * 30 * 864e5),
      ate: hoje,
      intervalo: "P15D",
    });

    // Mesma janela do ano, nos anos anteriores. E o que responde "este talhao
    // esta pior que o normal PARA ESTA EPOCA", em vez de comparar julho com
    // janeiro e concluir bobagem.
    const inicioBase = new Date(hoje);
    inicioBase.setFullYear(inicioBase.getFullYear() - anos);
    const historicoBruto = await serieSatelite(poligono, {
      de: inicioBase,
      ate: new Date(hoje.getTime() - 30 * 864e5),
      intervalo: "P30D",
    });

    const mesAtual = hoje.getMonth();
    const historicoMesmoMes: LeituraSatelite[] = historicoBruto.filter(
      (l) => new Date(l.data).getMonth() === mesAtual,
    );

    return {
      talhao: { id: talhao.id, nome: talhao.nome, codigo: talhao.codigo },
      nota: calcularNota(recentes, historicoMesmoMes),
      recentes,
      historicoMesmoMes,
      fonte: "Contains modified Copernicus Sentinel data " + hoje.getFullYear(),
    };
  });
}
