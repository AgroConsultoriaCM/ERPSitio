// Confere a leitura de embalagem contra as descricoes REAIS das notas do
// sitio - Frutagro e Agro-Marapoama.
import { lerEmbalagem, sugerirNome } from "../src/services/embalagem.js";

let falhas = 0;

function checar(descricao: string, esperado: number | null, base?: "L" | "KG") {
  const r = lerEmbalagem(descricao);
  const obtido = r ? r.quantidade : null;
  const okQtd = obtido === esperado;
  const okBase = esperado === null || !base || r?.base === base;
  const ok = okQtd && okBase;
  if (!ok) falhas++;
  const lido = r ? `${r.quantidade} ${r.base}  (de "${r.trecho}")` : "nao leu";
  console.log(`${ok ? "ok   " : "FALHA"} ${descricao.slice(0, 48).padEnd(50)} -> ${lido}`);
}

console.log("--- descricoes reais das suas notas ---");
// Frutagro
checar("ZAPP QI 620 20 L BRA", 20, "L");
checar("GLUFOSINATO 200 SL INNO ATHYS ( BD 20 LT )", 20, "L");
checar("GLIFOSATO CCAB 620 SL 1X20L", 20, "L");
// Agro-Marapoama
checar("PROGIBB 400 (250 GR) (ACIDO GIBERELICO)", 0.25, "KG");
checar("ENGEO PLENO S (LT) (TIAMETOXAM+LAMBDA-CIALOTRINA", 1, "L");
checar("BIVACK (BR) (LT) (CARFENTRAZONA-ETILICA", 1, "L");
checar("PREFER (20 LT) (GLUFOSINATO - SAL DE AMONIO", 20, "L");
checar("SUMYZIN 500 SC (LT) (FLUMIOXAZINA)", 1, "L");
// sem embalagem declarada: tem de admitir que nao sabe
checar("SMARTFRESH FOR LIMES | TABS", null);
checar("SMARTFRESH SMARTTABS", null);
checar("SMARTFRESH ACTIVATOR KIT", null);

console.log("\n--- a armadilha: concentracao nao e embalagem ---");
checar("ZAPP QI 620 SL", null);
checar("SUMYZIN 500 SC", null);
checar("PRODUTO 200 EC", null);
checar("ADUBO 20 20 20", null);

console.log("\n--- outras formas que aparecem no mercado ---");
checar("HERBICIDA FRASCO 500 ML", 0.5, "L");
checar("FERTILIZANTE SACO 25 KG", 25, "KG");
checar("ESPALHANTE 5 LITROS", 5, "L");
checar("PRODUTO 2 X 5 KG", 5, "KG");
checar("PO MOLHAVEL 1 KG", 1, "KG");

console.log("\n--- fora de faixa plausivel para insumo ---");
checar("PRODUTO 99999 L", null);
checar("PRODUTO 0,001 ML", null);

console.log("\n--- nome sugerido (o gestor edita) ---");
for (const d of [
  "ZAPP QI 620 20 L BRA",
  "GLUFOSINATO 200 SL INNO ATHYS ( BD 20 LT )",
  "GLIFOSATO CCAB 620 SL 1X20L",
  "PREFER (20 LT) (GLUFOSINATO - SAL DE AMONIO",
  "SUMYZIN 500 SC (LT) (FLUMIOXAZINA)",
]) {
  console.log(`  ${d.slice(0, 46).padEnd(48)} -> "${sugerirNome(d)}"`);
}

console.log(falhas === 0 ? "\nTODOS OS CASOS PASSARAM" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
