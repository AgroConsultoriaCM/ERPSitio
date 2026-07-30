import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@erpsitio/db";
import { NaoEncontradoError } from "../lib/errors.js";
import {
  proximoCodigo,
  validarPoligonoInterno,
  type PoligonoGeoJSON,
} from "../services/geoAreas.js";

// codigo e areaHa sao derivados pelo servidor, como no talhao.
const criarSetorSchema = z.object({
  nome: z.string().min(1),
  poligono: z.any(),
  corMapa: z.string().optional(),
  observacoes: z.string().optional(),
});

const atualizarSetorSchema = criarSetorSchema.partial();

const comoJson = (poligono: PoligonoGeoJSON) => poligono as unknown as Prisma.InputJsonObject;

export default async function setoresIrrigacaoRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/setores-irrigacao", async (request) => {
    return fastify.prisma.setorIrrigacao.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      orderBy: { codigo: "asc" },
    });
  });

  fastify.get<{ Params: { id: string } }>("/setores-irrigacao/:id", async (request) => {
    const setor = await fastify.prisma.setorIrrigacao.findFirst({
      where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
    });
    if (!setor) throw new NaoEncontradoError();
    return setor;
  });

  fastify.post(
    "/setores-irrigacao",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = criarSetorSchema.parse(request.body);

      const propriedade = await fastify.prisma.propriedade.findUniqueOrThrow({
        where: { id: request.user.propriedadeId },
      });
      const { poligono, areaHa } = validarPoligonoInterno(
        dados.poligono,
        propriedade.poligono,
        "setor",
      );

      const existentes = await fastify.prisma.setorIrrigacao.findMany({
        where: { propriedadeId: request.user.propriedadeId },
        select: { codigo: true },
      });

      const setor = await fastify.prisma.setorIrrigacao.create({
        data: {
          ...dados,
          poligono: comoJson(poligono),
          areaHa,
          codigo: proximoCodigo(existentes.map((s) => s.codigo), "S"),
          propriedadeId: request.user.propriedadeId,
        },
      });
      return reply.status(201).send(setor);
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/setores-irrigacao/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = atualizarSetorSchema.parse(request.body);
      const existente = await fastify.prisma.setorIrrigacao.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();

      let poligonoValidado;
      let areaHa;
      if (dados.poligono !== undefined) {
        const propriedade = await fastify.prisma.propriedade.findUniqueOrThrow({
          where: { id: request.user.propriedadeId },
        });
        ({ poligono: poligonoValidado, areaHa } = validarPoligonoInterno(
          dados.poligono,
          propriedade.poligono,
          "setor",
        ));
      }

      const setor = await fastify.prisma.setorIrrigacao.update({
        where: { id: existente.id },
        data: {
          ...dados,
          poligono: poligonoValidado ? comoJson(poligonoValidado) : undefined,
          areaHa,
        },
      });
      return reply.send(setor);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/setores-irrigacao/:id",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.setorIrrigacao.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.setorIrrigacao.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
