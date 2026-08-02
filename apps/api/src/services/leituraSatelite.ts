import type { PrismaClient } from "@erpsitio/db";
import type { LeituraSatelite as LeituraCalculo } from "./notaTalhao.js";

/**
 * Le as leituras de satelite ja gravadas no banco, no formato que os calculos
 * de notaTalhao.ts esperam. Consulta simples ao Postgres - sem chamada
 * externa nenhuma. Quem alimenta esta tabela e sincronizacaoSatelite.ts.
 */
export async function leiturasArmazenadas(
  prisma: PrismaClient,
  talhaoId: string,
  desde: Date,
): Promise<LeituraCalculo[]> {
  const linhas = await prisma.leituraSatelite.findMany({
    where: { talhaoId, periodo: { gte: desde } },
    orderBy: { periodo: "asc" },
  });
  return linhas.map((l) => ({
    data: l.periodo.toISOString(),
    ndviMedio: l.ndviMedio,
    osaviMedio: l.osaviMedio,
    desvio: l.desvio,
    pixels: l.pixels,
  }));
}
