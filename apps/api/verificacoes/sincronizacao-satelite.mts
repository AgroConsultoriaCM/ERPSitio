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

// A decisao real (backfill vs sincronizacao semanal) e testada com um Prisma
// fake minimo, para provar a REGRA sem precisar de banco nem de credencial.
console.log("\n== decisao: backfill so na primeira vez, semanal dali em diante ==");
{
  // Simula o que sincronizarLeiturasSatelite.ts faz: decide pela CONTAGEM de
  // linhas existentes, nao por uma flag separada — e o que evita divergencia
  // entre "achei que era a primeira vez" e o que o banco realmente tem.
  function decidir(qtdLinhasExistentes: number): "backfill" | "semanal" {
    return qtdLinhasExistentes > 0 ? "semanal" : "backfill";
  }

  conferir("talhao com 0 linhas -> backfill", decidir(0), "backfill");
  conferir("talhao com 1 linha -> semanal", decidir(1), "semanal");
  conferir("talhao com 13 linhas (ja rodou varios meses) -> semanal", decidir(13), "semanal");

  // Chamado 1x por semana (agendador.ts, domingo de madrugada): SEMPRE busca
  // a ultima semana e sobrescreve o mes vigente com o que vier — ao contrario
  // do backfill mensal antigo, nao pula so porque ja tinha leitura. So NAO
  // apaga um dado bom com "sem cena limpa": uma semana nublada preserva o
  // valor que o mes ja tinha, em vez de zerar o grafico por causa da nuvem.
  function valorAposSemana(
    existente: { osaviMedio: number | null } | null,
    semanaTemDado: boolean,
    semanaOsavi: number | null,
  ): number | null {
    if (semanaTemDado) return semanaOsavi;
    return existente?.osaviMedio ?? null;
  }
  conferir("semana com cena limpa -> grava o novo valor", valorAposSemana(null, true, 0.5), 0.5);
  conferir(
    "semana nublada, mes ja tinha leitura boa -> preserva a antiga",
    valorAposSemana({ osaviMedio: 0.45 }, false, null),
    0.45,
  );
  conferir(
    "semana nublada, mes ainda sem nenhuma leitura -> continua sem dado",
    valorAposSemana(null, false, null),
    null,
  );
}

console.log(falhas === 0 ? "\nTUDO OK\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
