import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, NaoEncontradoError } from "../lib/errors.js";
import { buscarClima } from "../services/clima.js";

const irrigacaoSchema = z.object({
  clientId: z.string().min(1).optional(),
  setorId: z.string().uuid(),
  data: z.coerce.date(),
  duracaoHoras: z.number().min(0).optional().nullable(),
  laminaMm: z.number().min(0).optional().nullable(),
  observacoes: z.string().optional(),
  origem: z.enum(["WEB", "APP"]).default("WEB"),
});

const diasEntre = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86_400_000);

export default async function irrigacaoRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("irrigacao", "VER"));

  fastify.get("/irrigacoes", async (request) => {
    const { setorId } = request.query as { setorId?: string };
    return fastify.prisma.irrigacao.findMany({
      where: { propriedadeId: request.user.propriedadeId, setorId: setorId ?? undefined },
      include: {
        setor: { select: { id: true, nome: true, codigo: true, areaHa: true } },
        responsavel: { select: { id: true, nome: true } },
      },
      orderBy: { data: "desc" },
      take: 300,
    });
  });

  // Situacao de cada setor: quando irrigou pela ultima vez e ha quantos dias
  fastify.get("/irrigacoes/situacao", async (request) => {
    const setores = await fastify.prisma.setorIrrigacao.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      orderBy: { codigo: "asc" },
    });

    const hoje = new Date();
    const situacao = await Promise.all(
      setores.map(async (s) => {
        const ultima = await fastify.prisma.irrigacao.findFirst({
          where: { setorId: s.id },
          orderBy: { data: "desc" },
        });
        return {
          setorId: s.id,
          nome: s.nome,
          codigo: s.codigo,
          areaHa: s.areaHa,
          ultimaIrrigacao: ultima?.data.toISOString() ?? null,
          diasDesdeUltima: ultima ? diasEntre(hoje, ultima.data) : null,
          duracaoHoras: ultima?.duracaoHoras ?? null,
          laminaMm: ultima?.laminaMm ?? null,
        };
      }),
    );
    return situacao;
  });

  // Previsao + historico de chuva na coordenada da propriedade
  fastify.get("/clima", async (request) => {
    const propriedade = await fastify.prisma.propriedade.findUniqueOrThrow({
      where: { id: request.user.propriedadeId },
    });
    if (propriedade.latitude == null || propriedade.longitude == null) {
      throw new AppError(
        "A propriedade ainda não tem coordenadas. Desenhe o contorno em Propriedade para o sistema saber onde buscar a previsão.",
        400,
      );
    }
    return buscarClima(propriedade.latitude, propriedade.longitude);
  });

  fastify.post("/irrigacoes", async (request, reply) => {
    const dados = irrigacaoSchema.parse(request.body);

    if (dados.clientId) {
      const existente = await fastify.prisma.irrigacao.findUnique({
        where: { clientId: dados.clientId },
      });
      if (existente) return reply.status(200).send(existente);
    }

    const setor = await fastify.prisma.setorIrrigacao.findFirst({
      where: { id: dados.setorId, propriedadeId: request.user.propriedadeId },
    });
    if (!setor) throw new NaoEncontradoError("Setor de irrigação não encontrado");

    const irrigacao = await fastify.prisma.irrigacao.create({
      data: {
        ...dados,
        responsavelId: request.user.sub,
        propriedadeId: request.user.propriedadeId,
      },
    });
    return reply.status(201).send(irrigacao);
  });

  fastify.patch<{ Params: { id: string } }>(
    "/irrigacoes/:id",
    { preHandler: fastify.requirePermissao("irrigacao", "EDITAR") },
    async (request, reply) => {
      const dados = irrigacaoSchema.partial().parse(request.body);
      const existente = await fastify.prisma.irrigacao.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      const irrigacao = await fastify.prisma.irrigacao.update({
        where: { id: existente.id },
        data: dados,
      });
      return reply.send(irrigacao);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/irrigacoes/:id",
    { preHandler: fastify.requirePermissao("irrigacao", "EDITAR") },
    async (request, reply) => {
      const existente = await fastify.prisma.irrigacao.findFirst({
        where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
      });
      if (!existente) throw new NaoEncontradoError();
      await fastify.prisma.irrigacao.delete({ where: { id: existente.id } });
      return reply.status(204).send();
    },
  );
}
