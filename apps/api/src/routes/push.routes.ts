import type { FastifyInstance } from "fastify";
import { z } from "zod";

// Formato padrao de PushSubscription.toJSON() do navegador.
const inscricaoSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export default async function pushRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/push/inscricao", async (request, reply) => {
    const dados = inscricaoSchema.parse(request.body);
    const inscricao = await fastify.prisma.pushInscricao.upsert({
      where: { endpoint: dados.endpoint },
      update: { usuarioId: request.user.sub, p256dh: dados.keys.p256dh, authKey: dados.keys.auth },
      create: {
        usuarioId: request.user.sub,
        endpoint: dados.endpoint,
        p256dh: dados.keys.p256dh,
        authKey: dados.keys.auth,
      },
    });
    return reply.status(201).send(inscricao);
  });
}
