// Prova o leitor de laudos contra os arquivos REAIS do laboratorio.
//
//   npx tsx apps/api/verificacoes/analise-laudo.mts
//
// Os laudos ficam em analises_sitio/, que esta no .gitignore: sao documentos
// reais, com nome e endereco do proprietario, e o repositorio e publico. Se a
// pasta nao existir, a verificacao dos arquivos reais e PULADA e so os casos
// montados a mao rodam - assim isto continua util em outra maquina.
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
// O pacote xlsx e CommonJS: com "import * as" o ESM entrega um namespace sem
// as funcoes. createRequire e o caminho que funciona nos dois mundos.
const exigir = createRequire(import.meta.url);
const XLSX = exigir("xlsx") as typeof import("xlsx");
import {
  detectarTipo,
  lerLaudo,
  montarRotulos,
  LaudoInvalidoError,
  type Planilha,
} from "../src/services/analiseLaudo.js";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  console.log(
    `  ${ok ? "ok   " : "FALHA"} ${nome}${ok ? "" : `\n         obtido:   ${JSON.stringify(obtido)}\n         esperado: ${JSON.stringify(esperado)}`}`,
  );
  if (!ok) falhas++;
}
function afirmar(nome: string, condicao: boolean, detalhe = "") {
  console.log(`  ${condicao ? "ok   " : "FALHA"} ${nome}${condicao ? "" : `  ${detalhe}`}`);
  if (!condicao) falhas++;
}

function abrir(caminho: string): Planilha {
  const wb = XLSX.readFile(caminho, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as Planilha;
}

console.log("\n== casos montados a mao: o que NAO pode virar numero ==");
{
  const planilha: Planilha = [
    ["RELATORIO DE ENSAIO"],
    ["Nome:", "Igor", "Material:", "Solo"],
    ["N º Laboratório", "Cliente", null, null, null, "pH", "M.O.", "Ca", "CTC"],
    [null, "Propriedade", "Talhão", "Prof.", "Grid", null, null, null, null],
    ["S26/89869", "Sitio", "DANIEL", "0-20", "-", 5.65, 7.49, "ns", 45.6],
  ];
  const laudo = lerLaudo(planilha);
  conferir("detecta quimica pela CTC", laudo.tipo, "QUIMICA");
  conferir("uma amostra", laudo.amostras.length, 1);
  const a = laudo.amostras[0];
  conferir("codigo do laboratorio", a.codigoLaboratorio, "S26/89869");
  conferir("identificacao do cliente", a.identificacao, "DANIEL");
  conferir("profundidade", a.profundidade, "0-20");
  conferir("pH com precisao cheia", a.valores.ph, 5.65);
  afirmar('"ns" (nao solicitado) NAO vira zero', a.valores.calcio === undefined,
    `veio ${a.valores.calcio}`);
  afirmar('"-" no grid nao vira nutriente', !("grid" in a.valores));
}

console.log("\n== zero e resultado, ausencia nao ==");
{
  const planilha: Planilha = [
    ["N º Laboratório", "Cliente", null, null, null, "Al", "pH", "CTC"],
    [null, "Propriedade", "Talhão", "Prof.", "Grid", null, null, null],
    ["S26/1", "Sitio", "T1", "0-20", "-", 0, 5.5, 45],
    ["S26/2", "Sitio", "T2", "0-20", "-", "-", 5.5, 45],
  ];
  const l = lerLaudo(planilha);
  conferir("aluminio zero e guardado", l.amostras[0].valores.aluminio, 0);
  afirmar("aluminio ausente nao vira zero", l.amostras[1].valores.aluminio === undefined);
  conferir("duas amostras lidas", l.amostras.length, 2);
}

console.log("\n== unidade diferente da padrao (Athenas) e convertida ==");
{
  // Mesmo layout da quimica real, mas o laboratorio fictício usa cmolc/dm3 em
  // vez de mmolc/dm3 para Ca, e ppm em vez de mg/dm3 para P — as duas
  // conversoes que o leitor deve saber fazer sozinho.
  const planilha: Planilha = [
    ["N º Laboratório", "Cliente", null, null, null, "pH", "M.O.", "P", "Ca", "CTC"],
    [null, "Propriedade", "Talhão", "Prof.", "Grid", null, null, null, null, null],
    [null, null, null, null, null, "CaCl2", "g dm-3", "ppm", "cmolc dm-3", "mmolc dm-3"],
    ["S26/1", "Sitio", "T1", "0-20", "-", 5.5, 20, 10, 4, 45],
  ];
  const a = lerLaudo(planilha).amostras[0];
  conferir("P convertido de ppm para mg/dm3 (1:1, sem mudar o numero)", a.valores.fosforo, 10);
  conferir("Ca convertido de cmolc para mmolc/dm3 (x10)", a.valores.calcio, 40);
  conferir("pH e CTC ja na unidade padrao — passam direto", [a.valores.ph, a.valores.ctc], [5.5, 45]);
  afirmar("avisa sobre a conversao do fosforo", a.avisosUnidade.some((m) => /PPM/i.test(m)));
  afirmar("avisa sobre a conversao do calcio", a.avisosUnidade.some((m) => /CMOLC/i.test(m)));
}

console.log("\n== unidade desconhecida: mantem o valor e avisa, nao chuta ==");
{
  const planilha: Planilha = [
    ["N º Laboratório", "Cliente", null, null, null, "pH", "Ca", "CTC"],
    [null, "Propriedade", "Talhão", "Prof.", "Grid", null, null, null],
    [null, null, null, null, null, "CaCl2", "meq/L", "mmolc dm-3"],
    ["S26/1", "Sitio", "T1", "0-20", "-", 5.5, 4, 45],
  ];
  const a = lerLaudo(planilha).amostras[0];
  conferir("valor mantido sem conversao (unidade nao reconhecida)", a.valores.calcio, 4);
  afirmar(
    "avisa que a unidade nao foi reconhecida",
    a.avisosUnidade.some((m) => m.includes("não reconhecida")),
  );
}

console.log("\n== cabecalho de duas linhas com sentidos que se completam ==");
{
  // Como vem na quimica real: "Sat." em cima, "Bases"/"Al" embaixo. Ler so uma
  // linha nao distingue saturacao por bases de saturacao por aluminio.
  const planilha: Planilha = [
    ["N º Laboratório", "Cliente", null, null, null, "pH", "CTC", "Sat.", "Sat."],
    [null, "Propriedade", "Talhão", "Prof.", "Grid", null, null, "Bases", "Al"],
    ["S26/1", "Sitio", "T1", "0-20", "-", 5.5, 45, 79.8, 0],
  ];
  const a = lerLaudo(planilha).amostras[0];
  conferir("saturacao por bases", a.valores.saturacaoBases, 79.8);
  conferir("saturacao por aluminio", a.valores.saturacaoAluminio, 0);
}

console.log("\n== arquivo que nao e laudo ==");
{
  try {
    lerLaudo([["planilha", "qualquer"], [1, 2]]);
    afirmar("deveria ter recusado", false);
  } catch (e) {
    afirmar("recusa com mensagem clara", e instanceof LaudoInvalidoError, String(e));
  }
}

console.log("\n== cabecalho em duas linhas ==");
{
  const rotulos = montarRotulos(
    [
      ["Lab.", "Cliente", null, null, null, null, "ARGILA", "SILTE"],
      [null, null, "Propriedade", "Talhão", "Prof.", "Grid", null, null],
    ],
    [0, 1],
  );
  conferir("junta as duas linhas por coluna", rotulos.slice(0, 8), [
    "LAB.", "CLIENTE", "PROPRIEDADE", "TALHAO", "PROF.", "GRID", "ARGILA", "SILTE",
  ]);
}

// ---------------------------------------------------------------------------

const PASTA = join(process.cwd(), "analises_sitio");
if (!existsSync(PASTA)) {
  console.log("\n(pasta analises_sitio/ ausente — verificação com arquivos reais pulada)");
} else {
  console.log("\n== ARQUIVOS REAIS DO LABORATORIO ==");
  // "~$nome.xlsx" e o arquivo de bloqueio que o Excel cria enquanto a planilha
  // esta aberta. Tem extensao .xlsx mas nao e laudo - entraria junto se o
  // usuario arrastasse a pasta inteira.
  const arquivos = readdirSync(PASTA).filter(
    (f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"),
  );
  const porTipo: Record<string, number> = {};
  let totalAmostras = 0;
  const naoReconhecidas = new Set<string>();
  const avisosUnidade = new Set<string>();

  for (const nome of arquivos.sort()) {
    try {
      const laudo = lerLaudo(abrir(join(PASTA, nome)));
      porTipo[laudo.tipo] = (porTipo[laudo.tipo] ?? 0) + 1;
      totalAmostras += laudo.amostras.length;
      laudo.amostras.forEach((a) => a.naoReconhecidas.forEach((r) => naoReconhecidas.add(r)));
      laudo.amostras.forEach((a) => a.avisosUnidade.forEach((r) => avisosUnidade.add(r)));

      const ids = laudo.amostras.map((a) => a.identificacao ?? "?").join(", ");
      const nutrientes = laudo.amostras[0] ? Object.keys(laudo.amostras[0].valores).length : 0;
      const data = laudo.dataColeta ? laudo.dataColeta.toLocaleDateString("pt-BR") : "sem data";
      console.log(
        `  ok    ${nome.slice(0, 46).padEnd(46)} ${laudo.tipo.padEnd(8)} ${laudo.amostras.length} amostra(s), ${nutrientes} valores, ${data}`,
      );
      console.log(`        identificações: ${ids}`);

      afirmar(`   ${nome.slice(0, 20)}: tem pelo menos uma amostra`, laudo.amostras.length > 0);
      afirmar(`   ${nome.slice(0, 20)}: primeira amostra tem valores`, nutrientes > 0);
    } catch (e) {
      falhas++;
      console.log(`  FALHA ${nome}  ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\n  resumo: ${arquivos.length} arquivos, ${totalAmostras} amostras`);
  console.log(`  por tipo: ${JSON.stringify(porTipo)}`);
  if (naoReconhecidas.size > 0) {
    console.log(`  colunas com número que NÃO soubemos nomear: ${[...naoReconhecidas].join(" | ")}`);
  } else {
    console.log("  todas as colunas com número foram reconhecidas");
  }
  // Os 13 arquivos sao todos do laboratorio Athenas — que E o padrao adotado.
  // Zero avisos aqui e o resultado esperado; se aparecer algum, ou a leitura
  // da unidade quebrou, ou o laudo realmente veio em unidade diferente e
  // precisa de olhar humano antes de gravar.
  if (avisosUnidade.size > 0) {
    console.log(`  avisos de unidade nos arquivos reais (confira!): ${[...avisosUnidade].join(" | ")}`);
  } else {
    console.log("  nenhum aviso de unidade — os 13 arquivos batem com o padrão Athenas");
  }
  afirmar("arquivos reais (todos Athenas) não geram aviso de unidade", avisosUnidade.size === 0);
  afirmar("detectou os cinco tipos de laudo", Object.keys(porTipo).length === 5,
    `achou ${Object.keys(porTipo).join(",")}`);
}

console.log(falhas === 0 ? "\nTUDO OK\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
