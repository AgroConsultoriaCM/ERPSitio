import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";
import { NaoAutorizadoError, ProibidoError } from "../lib/errors.js";
import { temPermissao, type AcaoPermissao, type ModuloId } from "../services/permissoes.js";
import type { RolePapel } from "@erpsitio/db";

export interface JwtPayload {
  sub: string;
  propriedadeId: string;
  role: RolePapel;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: RolePapel[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermissao: (
      modulo: ModuloId,
      acao: AcaoPermissao,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (fastify) => {
  fastify.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  });

  fastify.decorate("authenticate", async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new NaoAutorizadoError("Token inválido ou expirado");
    }
  });

  // Checagem por papel fixo - mantida para o que e estrutural (ex: só ADMIN
  // administra usuarios), enquanto o resto usa a matriz configuravel.
  fastify.decorate("requireRole", (...roles: RolePapel[]) => {
    return async (request: FastifyRequest) => {
      if (!request.user || !roles.includes(request.user.role)) {
        throw new ProibidoError();
      }
    };
  });

  // Checagem contra a matriz de permissoes configurada pelo admin.
  fastify.decorate("requirePermissao", (modulo: ModuloId, acao: AcaoPermissao) => {
    return async (request: FastifyRequest) => {
      if (!request.user) throw new NaoAutorizadoError();
      const permitido = await temPermissao(
        fastify.prisma,
        request.user.propriedadeId,
        request.user.role,
        modulo,
        acao,
      );
      if (!permitido) {
        throw new ProibidoError(
          `Seu perfil de acesso não permite ${
            acao === "EDITAR" ? "alterar" : "consultar"
          } esta área do sistema.`,
        );
      }
    };
  });
});
