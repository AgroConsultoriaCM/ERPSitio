import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashSenha } from "../lib/hash.js";
import { NaoEncontradoError } from "../lib/errors.js";

const criarUsuarioSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(8),
  role: z.enum(["ADMIN", "GERENTE", "ENCARREGADO"]),
});

const atualizarUsuarioSchema = z.object({
  nome: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "GERENTE", "ENCARREGADO"]).optional(),
  ativo: z.boolean().optional(),
  novaSenha: z.string().min(8).optional(),
});

const SELECT_PUBLICO = {
  id: true,
  nome: true,
  email: true,
  role: true,
  ativo: true,
  createdAt: true,
} as const;

export default async function usuariosRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermissao("usuarios", "EDITAR"));

  fastify.get("/usuarios", async (request) => {
    return fastify.prisma.usuario.findMany({
      where: { propriedadeId: request.user.propriedadeId },
      select: SELECT_PUBLICO,
      orderBy: { nome: "asc" },
    });
  });

  fastify.post("/usuarios", async (request, reply) => {
    const dados = criarUsuarioSchema.parse(request.body);
    const usuario = await fastify.prisma.usuario.create({
      data: {
        nome: dados.nome,
        email: dados.email,
        role: dados.role,
        senhaHash: await hashSenha(dados.senha),
        propriedadeId: request.user.propriedadeId,
      },
      select: SELECT_PUBLICO,
    });
    return reply.status(201).send(usuario);
  });

  fastify.patch<{ Params: { id: string } }>("/usuarios/:id", async (request, reply) => {
    const dados = atualizarUsuarioSchema.parse(request.body);
    const existente = await fastify.prisma.usuario.findFirst({
      where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
    });
    if (!existente) throw new NaoEncontradoError();

    const usuario = await fastify.prisma.usuario.update({
      where: { id: existente.id },
      data: {
        nome: dados.nome,
        role: dados.role,
        ativo: dados.ativo,
        senhaHash: dados.novaSenha ? await hashSenha(dados.novaSenha) : undefined,
      },
      select: SELECT_PUBLICO,
    });
    return reply.send(usuario);
  });

  fastify.delete<{ Params: { id: string } }>("/usuarios/:id", async (request, reply) => {
    const existente = await fastify.prisma.usuario.findFirst({
      where: { id: request.params.id, propriedadeId: request.user.propriedadeId },
    });
    if (!existente) throw new NaoEncontradoError();
    await fastify.prisma.usuario.update({
      where: { id: existente.id },
      data: { ativo: false },
    });
    return reply.status(204).send();
  });
}
