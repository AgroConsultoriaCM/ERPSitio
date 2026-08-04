import type { FastifyInstance } from "fastify";
import { z } from "zod";

// So o horario padrao mora aqui (1 linha por propriedade, como
// ParametroPulverizacao). A selecao de setores de cada noite vira Irrigacao
// mesmo, um POST /irrigacoes por setor - ver comentario no schema.prisma.
const configSchema = z.object({
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/),
});

export default async function regaNoturnaRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("irrigacao", "VER"));

  fastify.get("/rega-noturna/config", async (request) => {
    const propriedadeId = request.user.propriedadeId;
    const existente = await fastify.prisma.regaNoturnaConfig.findUnique({ where: { propriedadeId } });
    if (existente) return existente;
    return fastify.prisma.regaNoturnaConfig.create({ data: { propriedadeId } });
  });

  fastify.patch(
    "/rega-noturna/config",
    { preHandler: fastify.requirePermissao("irrigacao", "EDITAR") },
    async (request, reply) => {
      const dados = configSchema.partial().parse(request.body);
      const propriedadeId = request.user.propriedadeId;
      const config = await fastify.prisma.regaNoturnaConfig.upsert({
        where: { propriedadeId },
        update: dados,
        create: { propriedadeId, ...dados },
      });
      return reply.send(config);
    },
  );
}
