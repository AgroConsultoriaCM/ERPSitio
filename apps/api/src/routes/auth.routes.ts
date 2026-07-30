import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { compararSenha, hashSenha } from "../lib/hash.js";
import { gerarRefreshTokenOpaco, hashRefreshToken } from "../lib/tokens.js";
import { AppError, NaoAutorizadoError } from "../lib/errors.js";
import { permissoesDoPapel } from "../services/permissoes.js";
import { env } from "../env.js";

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(8),
});

async function emitirTokens(fastify: FastifyInstance, usuario: { id: string; propriedadeId: string; role: "ADMIN" | "GERENTE" | "ENCARREGADO" }) {
  const accessToken = await fastify.jwt.sign({
    sub: usuario.id,
    propriedadeId: usuario.propriedadeId,
    role: usuario.role,
  });

  const refreshTokenPlano = gerarRefreshTokenOpaco();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

  await fastify.prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshTokenPlano),
      usuarioId: usuario.id,
      expiresAt,
    },
  });

  return { accessToken, refreshToken: refreshTokenPlano };
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/login", async (request, reply) => {
    const { email, senha } = loginSchema.parse(request.body);

    const usuario = await fastify.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.ativo) {
      throw new NaoAutorizadoError("E-mail ou senha inválidos");
    }

    const senhaValida = await compararSenha(senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new NaoAutorizadoError("E-mail ou senha inválidos");
    }

    const tokens = await emitirTokens(fastify, usuario);

    return reply.send({
      ...tokens,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        propriedadeId: usuario.propriedadeId,
      },
    });
  });

  fastify.post("/auth/refresh", async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const tokenHash = hashRefreshToken(refreshToken);

    const registro = await fastify.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { usuario: true },
    });

    if (!registro || registro.revokedAt || registro.expiresAt < new Date()) {
      throw new NaoAutorizadoError("Refresh token inválido ou expirado");
    }

    await fastify.prisma.refreshToken.update({
      where: { id: registro.id },
      data: { revokedAt: new Date() },
    });

    if (!registro.usuario.ativo) {
      throw new NaoAutorizadoError("Usuário inativo");
    }

    const tokens = await emitirTokens(fastify, registro.usuario);
    return reply.send(tokens);
  });

  fastify.post("/auth/logout", async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const tokenHash = hashRefreshToken(refreshToken);
    await fastify.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return reply.send({ ok: true });
  });

  fastify.get(
    "/auth/me",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const usuario = await fastify.prisma.usuario.findUnique({
        where: { id: request.user.sub },
        select: { id: true, nome: true, email: true, role: true, propriedadeId: true, ativo: true },
      });
      if (!usuario) throw new NaoAutorizadoError();

      // permissoes vao junto para o front montar menu e telas numa so ida
      const permissoes = await permissoesDoPapel(
        fastify.prisma,
        usuario.propriedadeId,
        usuario.role,
      );
      return reply.send({ ...usuario, permissoes });
    },
  );

  fastify.post(
    "/auth/trocar-senha",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { senhaAtual, novaSenha } = trocarSenhaSchema.parse(request.body);
      const usuario = await fastify.prisma.usuario.findUniqueOrThrow({
        where: { id: request.user.sub },
      });
      const ok = await compararSenha(senhaAtual, usuario.senhaHash);
      if (!ok) throw new AppError("Senha atual incorreta", 400);
      await fastify.prisma.usuario.update({
        where: { id: usuario.id },
        data: { senhaHash: await hashSenha(novaSenha) },
      });
      return reply.send({ ok: true });
    },
  );
}
