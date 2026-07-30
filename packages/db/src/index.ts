export { PrismaClient, Prisma } from "../generated/client/index.js";
export * from "../generated/client/index.js";

import { PrismaClient } from "../generated/client/index.js";

let prisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}
