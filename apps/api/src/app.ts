import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { ZodError } from "zod";
import { env } from "./env.js";
import { AppError } from "./lib/errors.js";
import { montarVerificacaoOrigem } from "./lib/cors.js";

import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";

import authRoutes from "./routes/auth.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import propriedadesRoutes from "./routes/propriedades.routes.js";
import culturasRoutes from "./routes/culturas.routes.js";
import talhoesRoutes from "./routes/talhoes.routes.js";
import safrasRoutes from "./routes/safras.routes.js";
import tiposAtividadeRoutes from "./routes/tiposAtividade.routes.js";
import atividadesRoutes from "./routes/atividades.routes.js";
import insumosRoutes from "./routes/insumos.routes.js";
import estoqueRoutes from "./routes/estoque.routes.js";
import colheitasRoutes from "./routes/colheitas.routes.js";
import perfisCorrecaoRoutes from "./routes/perfisCorrecao.routes.js";
import analisesSoloRoutes from "./routes/analisesSolo.routes.js";
import analisesFoliarRoutes from "./routes/analisesFoliar.routes.js";
import setoresIrrigacaoRoutes from "./routes/setoresIrrigacao.routes.js";
import gruposRoutes from "./routes/grupos.routes.js";
import executoresRoutes from "./routes/executores.routes.js";
import lotesRoutes from "./routes/lotes.routes.js";
import permissoesRoutes from "./routes/permissoes.routes.js";
import pragasRoutes from "./routes/pragas.routes.js";
import irrigacaoRoutes from "./routes/irrigacao.routes.js";
import notasRoutes from "./routes/notas.routes.js";
import agrofitRoutes from "./routes/agrofit.routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: montarVerificacaoOrigem(env.CORS_ORIGIN, (origem) =>
      app.log.warn({ origem }, "requisição recusada: origem fora do CORS_ORIGIN"),
    ),
  });
  await app.register(sensible);
  await app.register(prismaPlugin);
  await app.register(authPlugin);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: "Dados inválidos",
        issues: error.issues,
      });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ message: error.message });
    }
    app.log.error(error);
    return reply.status(error.statusCode ?? 500).send({
      message: error.statusCode ? error.message : "Erro interno do servidor",
    });
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(usuariosRoutes);
      await api.register(propriedadesRoutes);
      await api.register(culturasRoutes);
      await api.register(talhoesRoutes);
      await api.register(safrasRoutes);
      await api.register(tiposAtividadeRoutes);
      await api.register(atividadesRoutes);
      await api.register(insumosRoutes);
      await api.register(estoqueRoutes);
      await api.register(colheitasRoutes);
      await api.register(perfisCorrecaoRoutes);
      await api.register(analisesSoloRoutes);
      await api.register(analisesFoliarRoutes);
      await api.register(setoresIrrigacaoRoutes);
      await api.register(gruposRoutes);
      await api.register(executoresRoutes);
      await api.register(lotesRoutes);
      await api.register(permissoesRoutes);
      await api.register(pragasRoutes);
      await api.register(irrigacaoRoutes);
      await api.register(notasRoutes);
      await api.register(agrofitRoutes);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
