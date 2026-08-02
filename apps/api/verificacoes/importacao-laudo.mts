// Prova a sugestao de talhao a partir da identificacao que vem no laudo.
//
//   npx tsx apps/api/verificacoes/importacao-laudo.mts
//
// Sugestao errada aceita sem olhar poe a analise no talhao errado, e adubacao
// calculada em cima disso vira prejuizo no campo. Por isso o corte e alto: e
// melhor deixar o campo vazio do que sugerir o talhao vizinho.
import { semelhanca, sugerirTalhao } from "../src/services/importacaoLaudo.js";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  console.log(
    `  ${ok ? "ok   " : "FALHA"} ${nome}${ok ? "" : `  obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`,
  );
  if (!ok) falhas++;
}
function afirmar(nome: string, condicao: boolean, detalhe = "") {
  console.log(`  ${condicao ? "ok   " : "FALHA"} ${nome}${condicao ? "" : `  ${detalhe}`}`);
  if (!condicao) falhas++;
}

// Os talhoes reais do sitio, como aparecem no cadastro.
const TALHOES = [
  { id: "t1", nome: "Limão Anão", codigo: null },
  { id: "t2", nome: "Limão Novo", codigo: null },
  { id: "t3", nome: "Abacate", codigo: null },
  { id: "t4", nome: "Fortuna", codigo: null },
  { id: "t5", nome: "Reforma", codigo: null },
];

console.log("\n== identificacoes reais que aparecem nos laudos do sitio ==");
{
  // Estas strings sao exatamente as que o leitor extraiu dos arquivos.
  conferir("LIMÃO NOVO acha o talhao", sugerirTalhao("LIMÃO NOVO", TALHOES)?.talhaoId, "t2");
  conferir("ABACATE acha o talhao", sugerirTalhao("ABACATE", TALHOES)?.talhaoId, "t3");
  conferir("REFORMA acha o talhao", sugerirTalhao("REFORMA", TALHOES)?.talhaoId, "t5");
  conferir("acento e caixa nao atrapalham", sugerirTalhao("limao novo", TALHOES)?.talhaoId, "t2");
}

console.log("\n== o que NAO pode ser sugerido ==");
{
  afirmar(
    "SACOLA AMARELA nao vira talhao nenhum",
    sugerirTalhao("SACOLA AMARELA", TALHOES) === null,
    JSON.stringify(sugerirTalhao("SACOLA AMARELA", TALHOES)),
  );
  afirmar("DANIEL nao vira talhao", sugerirTalhao("DANIEL", TALHOES) === null);
  afirmar("identificacao vazia nao sugere", sugerirTalhao(null, TALHOES) === null);
  afirmar("sem talhoes cadastrados nao sugere", sugerirTalhao("LIMÃO NOVO", []) === null);
}

console.log("\n== o caso perigoso: nomes parecidos ==");
{
  // "LIMAO NOVO" e "Limao Anao" tem uma palavra em comum de duas: 0,5.
  // Fica no limite de proposito - o que importa e nao trocar um pelo outro.
  const s = sugerirTalhao("LIMÃO NOVO", TALHOES);
  conferir("entre os dois limoes, escolhe o certo", s?.talhaoId, "t2");
  afirmar("e com confianca total", (s?.confianca ?? 0) === 1, `confianca ${s?.confianca}`);

  // "ABACATE GEADA" existe nos laudos mas nao ha talhao com esse nome:
  // meia palavra nao deve bastar para cravar "Abacate".
  const g = sugerirTalhao("ABACATE GEADA", TALHOES);
  afirmar(
    "ABACATE GEADA sugere Abacate, mas sem confianca total",
    g?.talhaoId === "t3" && (g?.confianca ?? 1) < 1,
    JSON.stringify(g),
  );
}

console.log("\n== a medida de semelhanca em si ==");
{
  conferir("igual da 1", semelhanca("Limão Novo", "LIMAO NOVO"), 1);
  conferir("nada em comum da 0", semelhanca("Abacate", "Fortuna"), 0);
  conferir("metade das palavras da 0,5", semelhanca("Limão Novo", "Limão Anão"), 0.5);
  conferir("texto vazio da 0", semelhanca("", "Abacate"), 0);
}

console.log(falhas === 0 ? "\nTUDO OK\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
