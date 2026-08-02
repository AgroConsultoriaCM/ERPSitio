// Prova a extracao do numero de registro do MAPA a partir do texto livre da
// nota fiscal.
//
//   npx tsx apps/api/verificacoes/registro-mapa.mts
//
// O numero e a unica chave exata entre a nota e o cadastro oficial do Agrofit.
// Errar aqui cadastraria o produto errado, com o modo de acao errado, e o
// controle de pragas passaria a mentir.
import { extrairRegistroMapa } from "../src/services/nfe.js";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = obtido === esperado;
  console.log(
    `  ${ok ? "ok   " : "FALHA"} ${nome}${ok ? "" : `  obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`,
  );
  if (!ok) falhas++;
}

console.log("\n== formas como o emitente escreve o registro ==");
conferir("REG.MAPA com dois pontos", extrairRegistroMapa("REG.MAPA: 11023"), "11023");
conferir("Registro MAPA n", extrairRegistroMapa("Registro MAPA n 7208"), "7208");
conferir("Reg. MAPA no", extrairRegistroMapa("Reg. MAPA no 45725"), "45725");
conferir("MAPA sob numero", extrairRegistroMapa("Registrado no MAPA sob n 35523"), "35523");
conferir("com ponto entre letras", extrairRegistroMapa("Reg. M.A.P.A. 3456"), "3456");
conferir(
  "ministerio por extenso",
  extrairRegistroMapa("REGISTRO NO MINISTERIO DA AGRICULTURA SOB N 12345"),
  "12345",
);
conferir("MAPA depois do numero", extrairRegistroMapa("Registro n 998 - MAPA"), "998");
conferir("com acento no numero", extrairRegistroMapa("Registro MAPA nº 04321"), "4321");

console.log("\n== zeros a esquerda somem, como no Agrofit ==");
conferir("07208 vira 7208", extrairRegistroMapa("REG MAPA 07208"), "7208");
conferir("000998 vira 998", extrairRegistroMapa("REG MAPA 000998"), "998");

console.log("\n== o que NAO pode ser confundido com registro ==");
conferir("concentracao no nome do produto", extrairRegistroMapa(null, "ZAPP QI 620"), null);
conferir("formulacao na descricao", extrairRegistroMapa(null, "GLIFOSATO 480 SL"), null);
conferir("numero solto no texto livre", extrairRegistroMapa("Lote 12345 - validade 06/2027"), null);
conferir("nota sem info adicional", extrairRegistroMapa(null), null);
conferir("texto vazio", extrairRegistroMapa("   "), null);
conferir(
  "CNPJ nao vira registro",
  extrairRegistroMapa("Emitente CNPJ 12.345.678/0001-90"),
  null,
);
conferir(
  "numero curto demais e recusado",
  extrairRegistroMapa("REG MAPA 12"),
  null,
);

console.log("\n== caso real combinado: texto longo de nota ==");
{
  const texto =
    "PRODUTO FITOSSANITARIO - USO AGRICOLA. Registro no MAPA sob n 11023. " +
    "Lote 2026A-77. Fabricado em 03/2026. Validade 03/2028. Classe toxicologica IV.";
  conferir("acha no meio do texto", extrairRegistroMapa(texto, "DIHA WG"), "11023");
}

console.log("\n== a descricao tambem e olhada, se a info adicional faltar ==");
conferir(
  "registro escrito na propria descricao",
  extrairRegistroMapa(null, "HERBICIDA XPTO REG MAPA 45725"),
  "45725",
);

console.log(falhas === 0 ? "\nTUDO OK\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
