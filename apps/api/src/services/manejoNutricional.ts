import type { PrismaClient } from "@erpsitio/db";
import { serieSatelite, sateliteConfigurado, type PoligonoGeoJSON } from "./satelite.js";
import { apenasValidas, type LeituraSatelite } from "./notaTalhao.js";

/**
 * Manejo nutricional: junta, por talhao, tres coisas que hoje vivem separadas.
 *
 *   1. um ano de OSAVI     - como o vigor se comportou
 *   2. ultimas analises    - o que o laboratorio disse do solo e da folha
 *   3. adubacoes do periodo - o que foi de fato aplicado, solo e foliar
 *
 * O QUE ESTE RELATORIO FAZ E NAO FAZ:
 *
 * Ele poe as tres coisas na mesma linha do tempo e aponta lacunas objetivas
 * (analise vencida, talhao sem adubacao, vigor caindo). NAO afirma que uma
 * adubacao causou uma subida de vigor - entre as duas ha chuva, colheita, poda
 * e florada, e atribuir causa a partir de duas curvas seria irresponsavel.
 * A correlacao e apresentada para o agronomo julgar, nao concluida por conta.
 */

const UM_ANO_MS = 365 * 864e5;

/** Depois disso a analise de solo perde valor de decisao para citros. */
const MESES_VALIDADE_SOLO = 18;
const MESES_VALIDADE_FOLIAR = 12;

export interface AdubacaoResumo {
  data: string;
  tipoAtividade: string;
  produtos: { nome: string; quantidade: number; unidade: string; foliar: boolean }[];
  temFoliar: boolean;
  temSolo: boolean;
}

export interface AlertaNutricional {
  gravidade: "atencao" | "critico";
  mensagem: string;
}

export interface TalhaoNutricional {
  talhaoId: string;
  nome: string;
  codigo: string | null;
  areaHa: number | null;
  cultura: string | null;
  serieOsavi: LeituraSatelite[];
  osaviMedioAno: number | null;
  variacaoAnual: number | null;
  analiseSolo: Record<string, unknown> | null;
  analiseFoliar: Record<string, unknown> | null;
  adubacoes: AdubacaoResumo[];
  alertas: AlertaNutricional[];
}

const arred = (v: number, casas = 3) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

function mesesDesde(data: Date): number {
  return Math.floor((Date.now() - data.getTime()) / (30 * 864e5));
}

/**
 * Variacao do vigor no ano: compara a media do primeiro terco das leituras
 * com a do ultimo terco.
 *
 * Comparar so a primeira leitura com a ultima seria fragil - uma cena com
 * nuvem residual na ponta inverteria o sinal do ano inteiro.
 */
export function variacaoNoPeriodo(leituras: LeituraSatelite[]): number | null {
  const validas = apenasValidas(leituras);
  if (validas.length < 6) return null;

  const terco = Math.floor(validas.length / 3);
  const media = (lista: LeituraSatelite[]) =>
    lista.reduce((s, l) => s + (l.osaviMedio as number), 0) / lista.length;

  const inicio = media(validas.slice(0, terco));
  const fim = media(validas.slice(-terco));
  if (inicio === 0) return null;
  return arred(((fim - inicio) / inicio) * 100, 1);
}

export function montarAlertas(dados: {
  analiseSolo: { dataColeta: Date } | null;
  analiseFoliar: { dataColeta: Date } | null;
  adubacoes: AdubacaoResumo[];
  variacaoAnual: number | null;
}): AlertaNutricional[] {
  const alertas: AlertaNutricional[] = [];

  if (!dados.analiseSolo) {
    alertas.push({ gravidade: "critico", mensagem: "nunca teve análise de solo" });
  } else {
    const meses = mesesDesde(dados.analiseSolo.dataColeta);
    if (meses >= MESES_VALIDADE_SOLO) {
      alertas.push({
        gravidade: meses >= MESES_VALIDADE_SOLO * 1.5 ? "critico" : "atencao",
        mensagem: `análise de solo com ${meses} meses`,
      });
    }
  }

  if (!dados.analiseFoliar) {
    alertas.push({ gravidade: "atencao", mensagem: "nunca teve análise foliar" });
  } else {
    const meses = mesesDesde(dados.analiseFoliar.dataColeta);
    if (meses >= MESES_VALIDADE_FOLIAR) {
      alertas.push({ gravidade: "atencao", mensagem: `análise foliar com ${meses} meses` });
    }
  }

  const temSolo = dados.adubacoes.some((a) => a.temSolo);
  const temFoliar = dados.adubacoes.some((a) => a.temFoliar);
  if (dados.adubacoes.length === 0) {
    alertas.push({ gravidade: "critico", mensagem: "nenhuma adubação lançada em 12 meses" });
  } else {
    if (!temSolo) alertas.push({ gravidade: "atencao", mensagem: "sem adubação de solo no período" });
    if (!temFoliar) alertas.push({ gravidade: "atencao", mensagem: "sem nutrição foliar no período" });
  }

  // Vigor caindo com nutricao em dia continua sendo motivo de olhar - pode ser
  // praga, compactacao ou agua, e o relatorio nao tem como distinguir.
  if (dados.variacaoAnual != null && dados.variacaoAnual <= -10) {
    alertas.push({
      gravidade: dados.variacaoAnual <= -20 ? "critico" : "atencao",
      mensagem: `vigor ${Math.abs(dados.variacaoAnual).toFixed(0)}% menor que no início do período`,
    });
  }

  return alertas;
}

export async function montarManejoNutricional(
  prisma: PrismaClient,
  propriedadeId: string,
): Promise<{ talhoes: TalhaoNutricional[]; satelite: boolean; fonte: string }> {
  const desde = new Date(Date.now() - UM_ANO_MS);

  const talhoes = await prisma.talhao.findMany({
    where: { propriedadeId },
    select: {
      id: true,
      nome: true,
      codigo: true,
      areaHa: true,
      poligono: true,
      cultura: { select: { nome: true } },
    },
    orderBy: [{ codigo: "asc" }, { nome: "asc" }],
  });

  // As adubacoes vem numa consulta so, para nao bater no banco por talhao.
  const atividades = await prisma.atividade.findMany({
    where: {
      propriedadeId,
      data: { gte: desde },
      insumos: {
        some: {
          insumo: { funcoes: { hasSome: ["FERTILIZANTE_SOLO", "NUTRICAO_FOLIAR"] } },
        },
      },
    },
    select: {
      data: true,
      tipoAtividade: { select: { nome: true } },
      talhoes: { select: { talhaoId: true } },
      insumos: {
        select: {
          quantidade: true,
          unidade: true,
          insumo: { select: { nome: true, funcoes: true } },
        },
      },
    },
    orderBy: { data: "desc" },
  });

  const [solos, foliares] = await Promise.all([
    prisma.analiseSolo.findMany({
      where: { propriedadeId },
      orderBy: { dataColeta: "desc" },
    }),
    prisma.analiseFoliar.findMany({
      where: { propriedadeId },
      orderBy: { dataColeta: "desc" },
    }),
  ]);

  const temSatelite = sateliteConfigurado();
  const agora = new Date();

  const resultado: TalhaoNutricional[] = [];

  for (const t of talhoes) {
    // Uma chamada por talhao cobre o ano inteiro. Sequencial de proposito: a
    // Micro tem 1 GB e sete respostas grandes ao mesmo tempo apertariam.
    let serieOsavi: LeituraSatelite[] = [];
    const poligono = t.poligono as PoligonoGeoJSON | null;
    if (temSatelite && poligono?.coordinates?.[0]?.length) {
      try {
        serieOsavi = await serieSatelite(poligono, {
          de: desde,
          ate: agora,
          intervalo: "P30D",
        });
      } catch {
        // Satelite fora do ar nao pode derrubar o relatorio inteiro: o resto
        // (analises e adubacoes) continua util sem ele.
        serieOsavi = [];
      }
    }

    const validas = apenasValidas(serieOsavi);
    const osaviMedioAno =
      validas.length > 0
        ? arred(validas.reduce((s, l) => s + (l.osaviMedio as number), 0) / validas.length)
        : null;

    const adubacoes: AdubacaoResumo[] = atividades
      .filter((a) => a.talhoes.some((x) => x.talhaoId === t.id))
      .map((a) => {
        const produtos = a.insumos
          .filter((i) =>
            i.insumo.funcoes.some((f) => f === "FERTILIZANTE_SOLO" || f === "NUTRICAO_FOLIAR"),
          )
          .map((i) => ({
            nome: i.insumo.nome,
            quantidade: i.quantidade,
            unidade: i.unidade,
            foliar: i.insumo.funcoes.includes("NUTRICAO_FOLIAR"),
          }));
        return {
          data: a.data.toISOString(),
          tipoAtividade: a.tipoAtividade?.nome ?? "Operação",
          produtos,
          temFoliar: produtos.some((p) => p.foliar),
          temSolo: produtos.some((p) => !p.foliar),
        };
      });

    const analiseSolo = solos.find((s) => s.talhaoId === t.id) ?? null;
    const analiseFoliar = foliares.find((f) => f.talhaoId === t.id) ?? null;
    const variacaoAnual = variacaoNoPeriodo(serieOsavi);

    resultado.push({
      talhaoId: t.id,
      nome: t.nome,
      codigo: t.codigo,
      areaHa: t.areaHa,
      cultura: t.cultura?.nome ?? null,
      serieOsavi,
      osaviMedioAno,
      variacaoAnual,
      analiseSolo: analiseSolo as unknown as Record<string, unknown> | null,
      analiseFoliar: analiseFoliar as unknown as Record<string, unknown> | null,
      adubacoes,
      alertas: montarAlertas({ analiseSolo, analiseFoliar, adubacoes, variacaoAnual }),
    });
  }

  return {
    talhoes: resultado,
    satelite: temSatelite,
    fonte: `Contains modified Copernicus Sentinel data ${agora.getFullYear()}`,
  };
}
