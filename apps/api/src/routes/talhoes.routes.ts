import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@erpsitio/db";
import { NaoEncontradoError } from "../lib/errors.js";
import { gerarDiagnosticoSolo } from "../services/recomendacaoSolo.js";
import {
  proximoCodigo,
  validarPoligonoInterno,
  type PoligonoGeoJSON,
} from "../services/geoAreas.js";

// O tipo Json do Prisma exige index signature, que uma interface nomeada nao
// tem. O poligono ja foi validado em validarPoligonoTalhao, entao o cast e
// seguro aqui.
const comoJson = (poligono: PoligonoGeoJSON) => poligono as unknown as Prisma.InputJsonObject;

// codigo e areaHa nao entram no schema: sao derivados pelo servidor
// (codigo sequencial, area calculada a partir do poligono).
const criarTalhaoSchema = z.object({
  nome: z.string().min(1),
  poligono: z.any(),
  culturaId: z.string().uuid().optional().nullable(),
  dataPlantio: z.coerce.date().optional(),
  espacamentoEntrePlantas: z.number().positive().optional().nullable(),
  espacamentoEntreLinhas: z.number().positive().optional().nullable(),
  status: z.enum(["EM_FORMACAO", "ATIVO", "INATIVO"]).optional(),
  corMapa: z.string().optional(),
});

const atualizarTalhaoSchema = criarTalhaoSchema.partial();

export default async function talhoesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/talhoes", async (request) => {
    return fastify.prisma.talhao.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      include: { cultura: true },
      orderBy: { nome: "asc" },
    });
  });

  fastify.get<{ Params: { id: string } }>("/talhoes/:id", async (request) => {
    const talhao = await fastify.prisma.talhao.findFirst({
      where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      include: { cultura: true, safras: true },
    });
    if (!talhao) throw new NaoEncontradoError();
    return talhao;
  });

  fastify.get<{ Params: { id: string } }>("/talhoes/:id/diagnostico", async (request) => {
    const talhao = await fastify.prisma.talhao.findFirst({
      where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
    });
    if (!talhao) throw new NaoEncontradoError();

    const ultimaAnalise = await fastify.prisma.analiseSolo.findFirst({
      where: { talhaoId: talhao.id },
      orderBy: { dataColeta: "desc" },
    });

    if (!ultimaAnalise) {
      return {
        possuiAnalise: false,
        mensagem: "Nenhuma análise de solo cadastrada para este talhão ainda.",
      };
    }

    const perfil = talhao.culturaId
      ? await fastify.prisma.perfilCorrecaoSolo.findFirst({
          where: { culturaId: talhao.culturaId, propriedadeId: request.user.propriedadeId },
          orderBy: { createdAt: "desc" },
        })
      : null;

    const diagnostico = gerarDiagnosticoSolo(ultimaAnalise, perfil);
    return { possuiAnalise: true, ...diagnostico };
  });

  fastify.post(
    "/talhoes",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = criarTalhaoSchema.parse(request.body);

      const propriedade = await fastify.prisma.propriedade.findUniqueOrThrow({
        where: { id: request.user.propriedadeId },
      });
      const { poligono, areaHa } = validarPoligonoInterno(
        dados.poligono,
        propriedade.poligono,
        "talhão",
      );

      const existentes = await fastify.prisma.talhao.findMany({
        where: { propriedadeId: request.user.propriedadeId },
        select: { codigo: true },
      });

      const talhao = await fastify.prisma.talhao.create({
        data: {
          ...dados,
          poligono: comoJson(poligono),
          areaHa,
          codigo: proximoCodigo(existentes.map((t) => t.codigo), "T"),
          propriedadeId: request.user.propriedadeId,
        },
      });
      return reply.status(201).send(talhao);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/talhoes/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = atualizarTalhaoSchema.parse(request.body);
      const existente = await fastify.prisma.talhao.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();

      // Redesenhar o contorno revalida a contencao e recalcula a area, para
      // area e poligono nunca saírem de sincronia.
      let poligonoValidado;
      let areaHa;
      if (dados.poligono !== undefined) {
        const propriedade = await fastify.prisma.propriedade.findUniqueOrThrow({
          where: { id: request.user.propriedadeId },
        });
        ({ poligono: poligonoValidado, areaHa } = validarPoligonoInterno(
          dados.poligono,
          propriedade.poligono,
          "talhão",
        ));
      }

      const talhao = await fastify.prisma.talhao.update({
        where: { id: existente.id },
        data: {
          ...dados,
          poligono: poligonoValidado ? comoJson(poligonoValidado) : undefined,
          areaHa,
        },
      });
      return reply.send(talhao);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/talhoes/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.talhao.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.talhao.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
