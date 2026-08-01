import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().default(30),
  CORS_ORIGIN: z.string().default("*"),

  // Credenciais da API Agrofit (AgroAPI da Embrapa). Opcionais: sem elas o
  // sistema segue funcionando e a consulta de registro apenas fica indisponivel,
  // em vez de derrubar a API inteira na subida.
  AGROFIT_CONSUMER_KEY: z.string().optional(),
  AGROFIT_CONSUMER_SECRET: z.string().optional(),
});

export const env = envSchema.parse({
  // Plataformas gerenciadas (Railway, Render, Fly) injetam PORT e esperam que
  // o processo escute nela. Em Docker Compose usamos API_PORT.
  API_PORT: process.env.PORT ?? process.env.API_PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN_DAYS: process.env.JWT_REFRESH_EXPIRES_IN_DAYS,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  AGROFIT_CONSUMER_KEY: process.env.AGROFIT_CONSUMER_KEY,
  AGROFIT_CONSUMER_SECRET: process.env.AGROFIT_CONSUMER_SECRET,
});
