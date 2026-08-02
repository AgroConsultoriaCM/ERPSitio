import type { PrismaClient } from "@erpsitio/db";
import { AppError } from "../lib/errors.js";
import { sateliteConfigurado, serieSatelite, type PoligonoGeoJSON } from "./satelite.js";

/**
 * Sincronizacao do satelite: quem alimenta a tabela LeituraSatelite.
 *
 * Duas situacoes, tratadas de jeitos diferentes de proposito:
 *
 *   - talhao SEM NENHUMA leitura ainda -> BACKFILL. Uma unica chamada ao
 *     Copernicus cobrindo alguns anos, porque a Statistical API devolve varios
 *     "baldes" mensais na MESMA resposta - nao e uma chamada por mes. Isso da
 *     ao Manejo Nutricional uma linha de base historica logo na primeira vez,
 *     em vez de precisar esperar 6-12 sincronizacoes mensais para o grafico
 *     comecar a fazer sentido.
 *   - talhao que ja tem leitura -> so busca o MES ATUAL, e so se ainda nao
 *     tiver uma leitura de verdade gravada para ele. Rodar a sincronizacao
 *     duas vezes no mesmo mes na segunda vez nao toca o Copernicus.
 *
 * Custo: o backfill de 3 anos e cerca de 0,02-0,05 PU por talhao (a mesma
 * ordem de grandeza que uma unica leitura, porque o piso de 0,005 PU domina
 * a conta para um talhao deste tamanho); a manutencao mensal e uma chamada
 * minima por talhao. Nos dois casos, fracao irrelevante da cota de 10.000
 * PU/mes.
 */

const ANOS_BACKFILL = 3;
const DIAS_JANELA_MES_ATUAL = 30;

function inicioDoMes(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
}

export type StatusSincronizacao =
  | "backfill"
  | "gravado"
  | "ja_tinha"
  | "sem_cena_limpa"
  | "sem_poligono"
  | "erro";

export interface ResultadoTalhao {
  talhaoId: string;
  nome: string;
  status: StatusSincronizacao;
  leiturasGravadas?: number;
  osaviMedio?: number | null;
  mensagem?: string;
}

interface TalhaoComPoligono {
  id: string;
  nome: string;
  poligono: PoligonoGeoJSON;
}

async function gravarLeitura(
  prisma: PrismaClient,
  talhaoId: string,
  propriedadeId: string,
  periodo: Date,
  leitura: { ndviMedio: number | null; osaviMedio: number | null; desvio: number | null; pixels: number },
) {
  await prisma.leituraSatelite.upsert({
    where: { talhaoId_periodo: { talhaoId, periodo } },
    create: { talhaoId, propriedadeId, periodo, ...leitura },
    update: leitura,
  });
}

async function backfill(
  prisma: PrismaClient,
  talhao: TalhaoComPoligono,
  propriedadeId: string,
): Promise<ResultadoTalhao> {
  const hoje = new Date();
  const de = new Date(hoje);
  de.setFullYear(de.getFullYear() - ANOS_BACKFILL);

  const leituras = await serieSatelite(talhao.poligono, { de, ate: hoje, intervalo: "P30D" });

  let gravadas = 0;
  for (const l of leituras) {
    const periodo = inicioDoMes(new Date(l.data));
    const semDado = l.pixels === 0 || l.osaviMedio == null;
    await gravarLeitura(prisma, talhao.id, propriedadeId, periodo, {
      ndviMedio: semDado ? null : l.ndviMedio,
      osaviMedio: semDado ? null : l.osaviMedio,
      desvio: semDado ? null : l.desvio,
      pixels: l.pixels,
    });
    if (!semDado) gravadas++;
  }

  return { talhaoId: talhao.id, nome: talhao.nome, status: "backfill", leiturasGravadas: gravadas };
}

async function sincronizarMesAtual(
  prisma: PrismaClient,
  talhao: TalhaoComPoligono,
  propriedadeId: string,
): Promise<ResultadoTalhao> {
  const hoje = new Date();
  const periodo = inicioDoMes(hoje);

  const existente = await prisma.leituraSatelite.findUnique({
    where: { talhaoId_periodo: { talhaoId: talhao.id, periodo } },
  });
  // Ja tem leitura de verdade neste mes: nao gasta cota de novo.
  if (existente?.osaviMedio != null) {
    return {
      talhaoId: talhao.id,
      nome: talhao.nome,
      status: "ja_tinha",
      osaviMedio: existente.osaviMedio,
    };
  }

  const janela = await serieSatelite(talhao.poligono, {
    de: new Date(hoje.getTime() - DIAS_JANELA_MES_ATUAL * 864e5),
    ate: hoje,
    intervalo: `P${DIAS_JANELA_MES_ATUAL}D`,
  });
  const leitura = janela[0] as
    | { ndviMedio: number | null; osaviMedio: number | null; desvio: number | null; pixels: number }
    | undefined;
  const semDado = !leitura || leitura.pixels === 0 || leitura.osaviMedio == null;

  await gravarLeitura(prisma, talhao.id, propriedadeId, periodo, {
    ndviMedio: semDado ? null : (leitura?.ndviMedio ?? null),
    osaviMedio: semDado ? null : (leitura?.osaviMedio ?? null),
    desvio: semDado ? null : (leitura?.desvio ?? null),
    pixels: leitura?.pixels ?? 0,
  });

  return {
    talhaoId: talhao.id,
    nome: talhao.nome,
    status: semDado ? "sem_cena_limpa" : "gravado",
    osaviMedio: semDado ? null : leitura?.osaviMedio,
  };
}

/**
 * Sincroniza todos os talhoes de uma propriedade.
 *
 * Sequencial de proposito, nao Promise.all: a Micro tem 1 GB de RAM, e sete
 * respostas grandes do Copernicus ao mesmo tempo apertariam. Um talhao com
 * erro (fora do ar, contorno invalido) nao derruba os demais.
 */
export async function sincronizarLeiturasSatelite(
  prisma: PrismaClient,
  propriedadeId: string,
): Promise<ResultadoTalhao[]> {
  if (!sateliteConfigurado()) {
    throw new AppError("Satélite não configurado no servidor.", 503);
  }

  const talhoes = await prisma.talhao.findMany({
    where: { propriedadeId },
    select: { id: true, nome: true, poligono: true },
  });

  const resultados: ResultadoTalhao[] = [];

  for (const t of talhoes) {
    const poligono = t.poligono as PoligonoGeoJSON | null;
    if (!poligono?.coordinates?.[0]?.length) {
      resultados.push({ talhaoId: t.id, nome: t.nome, status: "sem_poligono" });
      continue;
    }

    try {
      const jaTemLeitura = (await prisma.leituraSatelite.count({ where: { talhaoId: t.id } })) > 0;
      const talhaoComPoligono = { id: t.id, nome: t.nome, poligono };
      const resultado = jaTemLeitura
        ? await sincronizarMesAtual(prisma, talhaoComPoligono, propriedadeId)
        : await backfill(prisma, talhaoComPoligono, propriedadeId);
      resultados.push(resultado);
    } catch (err) {
      resultados.push({
        talhaoId: t.id,
        nome: t.nome,
        status: "erro",
        mensagem: err instanceof Error ? err.message : "falha desconhecida",
      });
    }
  }

  return resultados;
}
