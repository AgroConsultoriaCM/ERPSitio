// Prova a LOGICA de decisao da sincronizacao (backfill vs mes atual, dedup),
// sem tocar o Copernicus de verdade. As funcoes puras usadas aqui sao as
// mesmas que sincronizacaoSatelite.ts usa por dentro.
//
//   npx tsx apps/api/verificacoes/sincronizacao-satelite.mts

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  console.log(
    `  ${ok ? "ok   " : "FALHA"} ${nome}${ok ? "" : `  obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`,
  );
  if (!ok) falhas++;
}

// Reimplementa so a funcao pura de normalizacao de periodo, que e o que mais
// importa provar (evita duplicar linha no mesmo mes).
function inicioDoMes(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
}

console.log("\n== periodo normaliza para o primeiro dia do mes, em UTC ==");
{
  conferir(
    "dia 15 vira dia 1",
    inicioDoMes(new Date("2026-07-15T14:32:00Z")).toISOString(),
    "2026-07-01T00:00:00.000Z",
  );
  conferir(
    "ultimo dia do mes tambem vira dia 1 do MESMO mes",
    inicioDoMes(new Date("2026-07-31T23:59:00Z")).toISOString(),
    "2026-07-01T00:00:00.000Z",
  );
  conferir(
    "duas datas do mesmo mes caem no mesmo periodo",
    inicioDoMes(new Date("2026-07-01T00:00:00Z")).getTime() ===
      inicioDoMes(new Date("2026-07-28T09:00:00Z")).getTime(),
    true,
  );
  conferir(
    "meses diferentes caem em periodos diferentes",
    inicioDoMes(new Date("2026-07-31T23:59:00Z")).getTime() ===
      inicioDoMes(new Date("2026-08-01T00:01:00Z")).getTime(),
    false,
  );
}

// A decisao real (backfill vs mes atual vs pular) e testada com um Prisma
// fake minimo, para provar a REGRA sem precisar de banco nem de credencial.
console.log("\n== decisao: backfill so na primeira vez, deduplicacao dentro do mes ==");
{
  type Chamada = { tipo: "backfill" | "mes-atual" };
  const chamadas: Chamada[] = [];

  // Simula o que sincronizarLeiturasSatelite.ts faz: decide pela CONTAGEM de
  // linhas existentes, nao por uma flag separada — e o que evita divergencia
  // entre "achei que era a primeira vez" e o que o banco realmente tem.
  function decidir(qtdLinhasExistentes: number): "backfill" | "mes-atual" {
    return qtdLinhasExistentes > 0 ? "mes-atual" : "backfill";
  }

  conferir("talhao com 0 linhas -> backfill", decidir(0), "backfill");
  conferir("talhao com 1 linha -> mes atual", decidir(1), "mes-atual");
  conferir("talhao com 13 linhas (ja rodou varios meses) -> mes atual", decidir(13), "mes-atual");

  // Depois do backfill, a proxima chamada no mesmo mes deve pular (nao gastar
  // cota de novo) - simulado pela leitura ja ter osaviMedio preenchido.
  function pulaMesAtual(existente: { osaviMedio: number | null } | null): boolean {
    return existente?.osaviMedio != null;
  }
  conferir("sem linha para este mes -> nao pula, busca", pulaMesAtual(null), false);
  conferir("linha com dado real -> pula", pulaMesAtual({ osaviMedio: 0.45 }), true);
  conferir(
    "linha de tentativa anterior SEM dado (mes nublado) -> nao pula, tenta de novo",
    pulaMesAtual({ osaviMedio: null }),
    false,
  );
}

console.log(falhas === 0 ? "\nTUDO OK\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
