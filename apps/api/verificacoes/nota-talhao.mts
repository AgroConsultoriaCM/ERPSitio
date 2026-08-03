// Prova o calculo da nota do talhao a partir do satelite.
//
//   npx tsx apps/api/verificacoes/nota-talhao.mts
//
// A nota vai orientar decisao de manejo. Precisa acertar principalmente quando
// NAO ha dado - cena nublada nao pode virar "talhao critico".
import {
  apenasValidas,
  avaliarTendencia,
  avaliarUniformidade,
  avaliarVigor,
  calcularNota,
  combinar,
  type LeituraSatelite,
} from "../src/services/notaTalhao.js";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = obtido === esperado;
  console.log(
    `  ${ok ? "ok   " : "FALHA"} ${nome}${ok ? "" : `  obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`,
  );
  if (!ok) falhas++;
}

const leitura = (
  data: string,
  osavi: number | null,
  ndvi = 0.65,
  desvio = 0.11,
): LeituraSatelite => ({
  data,
  ndviMedio: osavi == null ? null : ndvi,
  osaviMedio: osavi,
  desvio: osavi == null ? null : desvio,
  pixels: osavi == null ? 0 : 3600,
});

console.log("\n== VIGOR: compara com a mediana do mesmo mes ==");
{
  const base = [leitura("2023-07-01", 0.45), leitura("2024-07-01", 0.44), leitura("2025-07-01", 0.46)];
  conferir("igual a historia = bom", avaliarVigor(leitura("2026-07-18", 0.45), base).faixa, "bom");
  conferir("acima da historia = bom", avaliarVigor(leitura("2026-07-18", 0.52), base).faixa, "bom");
  // 0,45 -> 0,40 e -11%
  conferir("11% abaixo = atencao", avaliarVigor(leitura("2026-07-18", 0.4), base).faixa, "atencao");
  // 0,45 -> 0,33 e -26%
  conferir("26% abaixo = critico", avaliarVigor(leitura("2026-07-18", 0.33), base).faixa, "critico");
}

console.log("\n== VIGOR: sem historico nao inventa nota ==");
{
  conferir("sem base = sem_dados", avaliarVigor(leitura("2026-07-18", 0.45), []).faixa, "sem_dados");
  conferir(
    "base so com cenas nubladas = sem_dados",
    avaliarVigor(leitura("2026-07-18", 0.45), [leitura("2025-07-01", null)]).faixa,
    "sem_dados",
  );
  conferir("sem leitura atual = sem_dados", avaliarVigor(null, [leitura("2025-07-01", 0.45)]).faixa, "sem_dados");
}

console.log("\n== UNIFORMIDADE: coeficiente de variacao ==");
{
  // medido no sitio: desvio 0,111 sobre media 0,663 = 16,7%
  conferir("CV 17% = bom", avaliarUniformidade(leitura("x", 0.45, 0.663, 0.111)).faixa, "bom");
  // 0,150 / 0,600 = 25%
  conferir("CV 25% = atencao", avaliarUniformidade(leitura("x", 0.45, 0.6, 0.15)).faixa, "atencao");
  // 0,210 / 0,600 = 35%
  conferir("CV 35% = critico", avaliarUniformidade(leitura("x", 0.45, 0.6, 0.21)).faixa, "critico");
  conferir("cena nublada = sem_dados", avaliarUniformidade(leitura("x", null)).faixa, "sem_dados");
}

console.log("\n== TENDENCIA: precisa de tres cenas limpas ==");
{
  const subindo = [leitura("1", 0.4), leitura("2", 0.43), leitura("3", 0.46), leitura("4", 0.49)];
  const caindo = [leitura("1", 0.5), leitura("2", 0.46), leitura("3", 0.42), leitura("4", 0.38)];
  const estavel = [leitura("1", 0.45), leitura("2", 0.451), leitura("3", 0.449), leitura("4", 0.45)];

  conferir("subindo = bom", avaliarTendencia(subindo).faixa, "bom");
  conferir("estavel = bom", avaliarTendencia(estavel).faixa, "bom");
  conferir("caindo forte = critico", avaliarTendencia(caindo).faixa, "critico");
  conferir("duas cenas nao formam tendencia", avaliarTendencia(subindo.slice(0, 2)).faixa, "sem_dados");
  conferir(
    "cenas nubladas nao contam para o minimo",
    avaliarTendencia([leitura("1", 0.4), leitura("2", null), leitura("3", null)]).faixa,
    "sem_dados",
  );
}

console.log("\n== A NOTA E O PIOR DOS TRES, nao a media ==");
{
  conferir("tudo bom = bom", combinar([
    { faixa: "bom", valor: 1, explicacao: "" },
    { faixa: "bom", valor: 1, explicacao: "" },
  ]), "bom");
  conferir("um critico derruba", combinar([
    { faixa: "bom", valor: 1, explicacao: "" },
    { faixa: "bom", valor: 1, explicacao: "" },
    { faixa: "critico", valor: 1, explicacao: "" },
  ]), "critico");
  conferir("sem_dados nao conta como bom", combinar([
    { faixa: "sem_dados", valor: null, explicacao: "" },
    { faixa: "atencao", valor: 1, explicacao: "" },
  ]), "atencao");
  conferir("tudo sem dado = sem_dados", combinar([
    { faixa: "sem_dados", valor: null, explicacao: "" },
  ]), "sem_dados");
}

console.log("\n== CENARIO REAL: os numeros medidos no sitio ==");
{
  const recentes = [
    leitura("2026-05-04", 0.412, 0.595, 0.126),
    leitura("2026-05-19", 0.414, 0.63, 0.172),
    leitura("2026-06-03", 0.392, 0.587, 0.155),
    leitura("2026-06-18", 0.449, 0.683, 0.124),
    leitura("2026-07-03", 0.435, 0.651, 0.125),
    leitura("2026-07-18", 0.45, 0.663, 0.111),
  ];
  const base = [leitura("2023-07-01", 0.44), leitura("2024-07-01", 0.43), leitura("2025-07-01", 0.45)];
  const nota = calcularNota(recentes, base);
  console.log(`    vigor:        ${nota.vigor.faixa} — ${nota.vigor.explicacao}`);
  console.log(`    uniformidade: ${nota.uniformidade.faixa} — ${nota.uniformidade.explicacao}`);
  console.log(`    tendencia:    ${nota.tendencia.faixa} — ${nota.tendencia.explicacao}`);
  console.log(`    NOTA:         ${nota.faixa}`);
  conferir("talhao saudavel do sitio = bom", nota.faixa, "bom");
  conferir("usou as 6 leituras limpas", nota.leiturasUsadas, 6);
}

console.log("\n== CENARIO RUIM: cai de vigor e perde uniformidade ==");
{
  const recentes = [
    leitura("2026-05-04", 0.45, 0.66, 0.12),
    leitura("2026-05-19", 0.42, 0.63, 0.15),
    leitura("2026-06-03", 0.39, 0.6, 0.18),
    leitura("2026-06-18", 0.35, 0.56, 0.21),
  ];
  const base = [leitura("2025-06-01", 0.46)];
  const nota = calcularNota(recentes, base);
  console.log(`    vigor:        ${nota.vigor.explicacao}`);
  console.log(`    uniformidade: ${nota.uniformidade.explicacao}`);
  console.log(`    tendencia:    ${nota.tendencia.explicacao}`);
  conferir("nota critica", nota.faixa, "critico");
}

console.log("\n== MES INTEIRO NUBLADO nao vira talhao critico ==");
{
  const nota = calcularNota([leitura("2026-07-01", null), leitura("2026-07-16", null)], []);
  conferir("sem cena limpa = sem_dados", nota.faixa, "sem_dados");
  conferir("nenhuma leitura usada", nota.leiturasUsadas, 0);
}

console.log("\n== OSCILACAO ISOLADA: nuvem/sombra que passou pelo filtro de cena ==");
{
  // Um mes cai para quase metade e volta ao padrao no seguinte - vigor de
  // planta de verdade nao faz isso. Caso real que motivou o filtro: OSAVI
  // caindo bem abaixo em novembro e janeiro, cercado de leituras normais.
  const serie = [
    leitura("2025-09-01", 0.46),
    leitura("2025-10-01", 0.47),
    leitura("2025-11-01", 0.24), // isolada - some
    leitura("2025-12-01", 0.45),
    leitura("2026-01-01", 0.22), // isolada - some
    leitura("2026-02-01", 0.46),
  ];
  const limpa = apenasValidas(serie);
  conferir("descarta as duas leituras isoladas", limpa.length, 4);
  conferir(
    "sobram so as leituras que concordam entre si",
    limpa.map((l) => l.data).join(","),
    "2025-09-01,2025-10-01,2025-12-01,2026-02-01",
  );
}
{
  // Queda REAL e sustentada (duas leituras baixas seguidas, nao uma so) nunca
  // pode ser descartada - e exatamente o que o relatorio existe para mostrar.
  const serie = [
    leitura("2025-09-01", 0.46),
    leitura("2025-10-01", 0.45),
    leitura("2025-11-01", 0.25),
    leitura("2025-12-01", 0.24),
    leitura("2026-01-01", 0.23),
  ];
  const limpa = apenasValidas(serie);
  conferir("queda sustentada NAO e descartada", limpa.length, 5);
}
{
  // Ponta da serie (primeira ou ultima leitura) nunca tem os dois vizinhos -
  // fica de fora do filtro, nao da para julgar isolamento sem os dois lados.
  const serie = [leitura("2025-09-01", 0.1), leitura("2025-10-01", 0.45), leitura("2025-11-01", 0.46)];
  const limpa = apenasValidas(serie);
  conferir("ponta da serie fica, mesmo destoando", limpa.length, 3);
}

console.log(falhas === 0 ? "\nTUDO OK\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
