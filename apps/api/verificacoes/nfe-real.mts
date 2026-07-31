// Confere o leitor contra uma NF-e de verdade, autorizada pela SEFAZ.
//
// Uso:  npx tsx verificacoes/nfe-real.mts "C:/caminho/da/nota.xml"
//
// Nao imprime o conteudo do arquivo: so o que foi entendido dele.
import { readFileSync } from "node:fs";
import { lerXmlNfe, conferirTotal } from "../src/services/nfe.js";

const caminho = process.argv[2];
if (!caminho) {
  console.error("informe o caminho do XML");
  process.exit(1);
}

const nota = lerXmlNfe(readFileSync(caminho, "utf8"));

console.log("=== cabecalho ===");
console.log("  chave      :", nota.chaveAcesso, `(${nota.chaveAcesso.length} digitos)`);
console.log("  nota/serie :", nota.numero, "/", nota.serie);
console.log("  emissao    :", nota.dataEmissao.toLocaleDateString("pt-BR"));
console.log("  fornecedor :", nota.nomeEmitente);
console.log("  CNPJ       :", nota.cnpjEmitente);
console.log("  total      : R$", nota.valorTotal.toFixed(2));

console.log("\n=== itens ===");
for (const i of nota.itens) {
  console.log(`  [${i.numero}] cod ${i.codigo}  ${i.descricao}`);
  console.log(
    `        ${i.quantidade} ${i.unidade}  x  R$ ${i.valorUnitario.toFixed(2)}` +
      `  =  R$ ${i.valorProduto.toFixed(2)}`,
  );
  const extras: string[] = [];
  if (i.desconto) extras.push(`desconto R$ ${i.desconto.toFixed(2)}`);
  if (i.frete) extras.push(`frete R$ ${i.frete.toFixed(2)}`);
  if (i.seguro) extras.push(`seguro R$ ${i.seguro.toFixed(2)}`);
  if (i.outrasDespesas) extras.push(`outras R$ ${i.outrasDespesas.toFixed(2)}`);
  if (extras.length) console.log("        " + extras.join(", "));
  console.log(`        custo real para o estoque: R$ ${i.custoUnitarioReal.toFixed(2)} por ${i.unidade}`);
}

const t = conferirTotal(nota);
console.log("\n=== conferencia ===");
console.log("  soma dos itens : R$", t.somaItens.toFixed(2));
console.log("  total da nota  : R$", nota.valorTotal.toFixed(2));
console.log("  fecha?         :", t.confere ? "SIM" : `NAO (diferenca de R$ ${t.diferenca.toFixed(2)})`);

process.exit(t.confere ? 0 : 1);
