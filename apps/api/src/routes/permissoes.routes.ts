import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  MODULOS,
  limparCachePermissoes,
  permissoesDoPapel,
  permissoesPadrao,
} from "../services/permissoes.js";
import type { RolePapel } from "@erpsitio/db";

const PAPEIS: RolePapel[] = ["ADMIN", "GERENTE", "ENCARREGADO"];

const salvarSchema = z.object({
  permissoes: z
    .array(
      z.object({
        papel: z.enum(["GERENTE", "ENCARREGADO"]), // ADMIN nao e editavel
        modulo: z.string().min(1),
        podeVer: z.boolean(),
        podeEditar: z.boolean(),
      }),
    )
    .min(1),
});

export default async function permissoesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // Catalogo de modulos + matriz atual, para montar a tela
  fastify.get(
    "/permissoes",
    { preHandler: fastify.requireRole("ADMIN") },
    async (request) => {
      const matriz = await Promise.all(
        PAPEIS.map(async (papel) => ({
          papel,
          // ADMIN é sempre total e não editável
          fixo: papel === "ADMIN",
          permissoes: await permissoesDoPapel(fastify.prisma, request.user.propriedadeId, papel),
        })),
      );
      return { modulos: MODULOS, matriz };
    },
  );

  // Permissoes do usuario logado - o front usa para esconder menus e telas
  fastify.get("/permissoes/me", async (request) => {
    const permissoes = await permissoesDoPapel(
      fastify.prisma,
      request.user.propriedadeId,
      request.user.role,
    );
    return { papel: request.user.role, permissoes };
  });

  fastify.put(
    "/permissoes",
    { preHandler: fastify.requireRole("ADMIN") },
    async (request, reply) => {
      const { permissoes } = salvarSchema.parse(request.body);
      const propriedadeId = request.user.propriedadeId;

      const modulosValidos = new Set(MODULOS.map((m) => m.id));
      const validas = permissoes.filter((p) => modulosValidos.has(p.modulo as never));

      await fastify.prisma.$transaction(
        validas.map((p) =>
          fastify.prisma.permissaoPapel.upsert({
            where: {
              propriedadeId_papel_modulo: {
                propriedadeId,
                papel: p.papel,
                modulo: p.modulo,
              },
            },
            create: {
              propriedadeId,
              papel: p.papel,
              modulo: p.modulo,
              // editar implica ver, para nao gravar combinacao impossivel
              podeVer: p.podeVer || p.podeEditar,
              podeEditar: p.podeEditar,
            },
            update: {
              podeVer: p.podeVer || p.podeEditar,
              podeEditar: p.podeEditar,
            },
          }),
        ),
      );

      limparCachePermissoes(propriedadeId);
      return reply.send({ ok: true, atualizadas: validas.length });
    },
  );

  // Volta tudo para o comportamento padrão do sistema
  fastify.post(
    "/permissoes/restaurar-padrao",
    { preHandler: fastify.requireRole("ADMIN") },
    async (request, reply) => {
      await fastify.prisma.permissaoPapel.deleteMany({
        where: { propriedadeId: request.user.propriedadeId },
      });
      limparCachePermissoes(request.user.propriedadeId);
      return reply.send({
        ok: true,
        matriz: PAPEIS.map((papel) => ({ papel, permissoes: permissoesPadrao(papel) })),
      });
    },
  );
}
