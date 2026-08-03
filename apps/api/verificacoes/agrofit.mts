// Prova a integracao com a API Agrofit e descobre o contrato dela.
//
//   AGROFIT_CONSUMER_KEY=... AGROFIT_CONSUMER_SECRET=... \
//     npx tsx apps/api/verificacoes/agrofit.mts
//
// Existe porque a Embrapa nao publica o swagger aberto: /swagger.json responde
// 404 e qualquer rota sem token responde 401, entao de fora nao da para saber
// quais recursos existem nem que forma tem a resposta. Com a credencial na mao,
// este script bate em cada candidato e relata o que respondeu.
//
// NAO imprime a credencial nem o token em momento algum.

import { funcoesSugeridasDoAgrofit, type ProdutoAgrofit } from "../src/services/agrofit.js";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  console.log(
    `  ${ok ? "ok   " : "FALHA"} ${nome}${ok ? "" : `\n         obtido:   ${JSON.stringify(obtido)}\n         esperado: ${JSON.stringify(esperado)}`}`,
  );
  if (!ok) falhas++;
}

// Mapeamento classe -> Função: nao precisa de credencial, roda sempre. E o
// que decide qual Função vem pre-marcada na nota fiscal quando o produto
// tras o registro do MAPA (ver notas.routes.ts).
console.log("\n== mapeamento classe agronomica -> Funcao do cadastro ==");
{
  const inseticida: ProdutoAgrofit = { classe_categoria_agronomica: ["Inseticida"] };
  conferir("Inseticida -> INSETICIDA", funcoesSugeridasDoAgrofit(inseticida), ["INSETICIDA"]);

  const duasClasses: ProdutoAgrofit = {
    classe_categoria_agronomica: ["Inseticida", "Acaricida"],
  };
  conferir(
    "produto com duas classes -> duas funcoes",
    funcoesSugeridasDoAgrofit(duasClasses).sort(),
    ["ACARICIDA", "INSETICIDA"],
  );

  const semAcento: ProdutoAgrofit = { classe_categoria_agronomica: ["FUNGICIDA"] };
  conferir("maiuscula sem acento tambem casa", funcoesSugeridasDoAgrofit(semAcento), ["FUNGICIDA"]);

  const desconhecida: ProdutoAgrofit = { classe_categoria_agronomica: ["Espalhante Adesivo"] };
  conferir("classe sem correspondencia -> nao chuta, fica vazio", funcoesSugeridasDoAgrofit(desconhecida), []);

  const semClasse: ProdutoAgrofit = {};
  conferir("produto sem a classe -> vazio, sem quebrar", funcoesSugeridasDoAgrofit(semClasse), []);
}
console.log(falhas === 0 ? "  (mapeamento) TUDO OK" : `  (mapeamento) ${falhas} FALHA(S)`);

const CHAVE = process.env.AGROFIT_CONSUMER_KEY;
const SEGREDO = process.env.AGROFIT_CONSUMER_SECRET;
const BASE = "https://api.cnptia.embrapa.br/agrofit/v1";

if (!CHAVE || !SEGREDO) {
  console.log(
    "\n(sem AGROFIT_CONSUMER_KEY/SECRET no ambiente — parte ao vivo pulada, só o mapeamento acima rodou)\n",
  );
  process.exit(falhas === 0 ? 0 : 1);
}
async function obterToken(): Promise<string> {
  const basico = Buffer.from(`${CHAVE}:${SEGREDO}`).toString("base64");
  const res = await fetch("https://api.cnptia.embrapa.br/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basico}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`token: HTTP ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  return j.access_token;
}

/** Resumo da forma do JSON, sem despejar o conteudo inteiro no terminal. */
function formato(v: unknown, profundidade = 0): string {
  if (v === null) return "null";
  if (Array.isArray(v)) {
    return v.length === 0 ? "[]" : `[${v.length} itens] de ${formato(v[0], profundidade + 1)}`;
  }
  if (typeof v === "object") {
    const chaves = Object.keys(v as object);
    if (profundidade >= 1) return `{${chaves.slice(0, 8).join(", ")}}`;
    return `{\n    ${chaves.map((k) => `${k}: ${formato((v as Record<string, unknown>)[k], profundidade + 1)}`).join("\n    ")}\n  }`;
  }
  return typeof v;
}

const CANDIDATOS = [
  "/produtos-formulados?page=1&size=1",
  "/produtos-tecnicos?page=1&size=1",
  "/culturas",
  "/pragas?page=1&size=1",
  "/plantas-daninhas?page=1&size=1",
  "/ingredientes-ativos?page=1&size=1",
  "/classes-agronomicas",
  "/classificacoes-toxicologicas",
  "/classificacoes-ambientais",
  "/formulacoes",
  "/marcas-comerciais?page=1&size=1",
  "/modos-acao",
  "/tecnicas-aplicacao",
  "/titulares-registro?page=1&size=1",
];

const token = await obterToken();
console.log("\nautenticado com sucesso (token obtido)\n");

const vivos: string[] = [];

for (const caminho of CANDIDATOS) {
  const url = `${BASE}${caminho}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    const rotulo = caminho.split("?")[0];
    if (res.ok) {
      vivos.push(rotulo);
      const corpo = await res.json();
      console.log(`  ${res.status}  ${rotulo}`);
      console.log(`        ${formato(corpo)}`);
    } else {
      console.log(`  ${res.status}  ${rotulo}`);
    }
  } catch (err) {
    console.log(`  ---  ${caminho}  (${err instanceof Error ? err.message : "erro"})`);
  }
}

console.log(`\n=== ${vivos.length} recurso(s) respondendo ===`);
vivos.forEach((v) => console.log(`  ${v}`));

// Busca de verdade: o caso de uso do sitio e "o que posso usar no limao
// contra esta praga?".
console.log("\n=== busca real: produtos para citros ===");
for (const q of ["cultura=Citros", "cultura=Limão", "cultura=Abacate"]) {
  try {
    const res = await fetch(`${BASE}/produtos-formulados?${q}&page=1&size=3`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
    console.log(`  ${res.status}  ${q}`);
    if (res.ok) {
      const corpo = (await res.json()) as unknown;
      console.log(`        ${formato(corpo)}`);
    }
  } catch (err) {
    console.log(`  ---  ${q}  (${err instanceof Error ? err.message : "erro"})`);
  }
}
console.log("");
console.log(falhas === 0 ? "TUDO OK\n" : `${falhas} FALHA(S) no mapeamento classe->Função\n`);
process.exit(falhas === 0 ? 0 : 1);
