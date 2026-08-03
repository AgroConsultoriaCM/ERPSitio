import type { FastifyInstance } from "fastify";
import { z } from "zod";

// Uma linha por propriedade - "o" conjunto de parametros da janela de
// pulverizacao, nao uma lista de perfis. Antes eram constantes fixas em
// src/lib/clima.ts; agora o Igor edita pelo cadastro.
const parametroSchema = z.object({
  chuvaMmZero: z.number().positive(),
  chuvaProbPctZero: z.number().positive(),
  ventoIdealMinKmh: z.number().nonnegative(),
  ventoIdealMaxKmh: z.number().positive(),
  ventoZeroBaixoKmh: z.number().nonnegative(),
  ventoZeroAltoKmh: z.number().positive(),
  umidadeIdealMinPct: z.number().positive(),
  umidadeZeroPct: z.number().nonnegative(),
  kcCultura: z.number().positive(),
});

export default async function parametrosPulverizacaoRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("cadastros", "VER"));

  fastify.get("/parametros-pulverizacao", async (request) => {
    const propriedadeId = request.user.propriedadeId;
    const existente = await fastify.prisma.parametroPulverizacao.findUnique({ where: { propriedadeId } });
    if (existente) return existente;
    // Primeiro acesso: cria com os defaults do schema (os mesmos valores que
    // eram constantes fixas antes) para o cadastro já abrir preenchido.
    return fastify.prisma.parametroPulverizacao.create({ data: { propriedadeId } });
  });

  fastify.patch(
    "/parametros-pulverizacao",
    { preHandler: fastify.requirePermissao("cadastros", "EDITAR") },
    async (request, reply) => {
      const dados = parametroSchema.partial().parse(request.body);
      const propriedadeId = request.user.propriedadeId;
      const parametro = await fastify.prisma.parametroPulverizacao.upsert({
        where: { propriedadeId },
        update: dados,
        create: { propriedadeId, ...dados },
      });
      return reply.send(parametro);
    },
  );
}
