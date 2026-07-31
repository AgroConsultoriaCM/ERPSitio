import { lerXmlNfe, conferirTotal, XmlInvalidoError } from "../src/services/nfe.js";

let falhas = 0;
function ok(rotulo: string, condicao: boolean, detalhe = "") {
  if (!condicao) falhas++;
  console.log(`${condicao ? "ok   " : "FALHA"} ${rotulo}${detalhe ? "  -> " + detalhe : ""}`);
}

const CHAVE = "35240612345678000199550010000012341234567890";

// Nota com DOIS itens, um deles com desconto e frete.
const notaDupla = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00"><NFe><infNFe Id="NFe${CHAVE}" versao="4.00">
  <ide><nNF>1234</nNF><serie>1</serie><dhEmi>2026-07-15T10:30:00-03:00</dhEmi></ide>
  <emit><CNPJ>12345678000199</CNPJ><xNome>AGRO INSUMOS LTDA</xNome></emit>
  <det nItem="1"><prod>
    <cProd>007</cProd><xProd>OLEO MINERAL ASSIST 20L</xProd><NCM>38089329</NCM>
    <uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>450.0000000000</vUnCom><vProd>900.00</vProd>
    <vDesc>50.00</vDesc><vFrete>30.00</vFrete>
  </prod></det>
  <det nItem="2"><prod>
    <cProd>ABC-12</cProd><xProd>SULFATO DE COBRE SC 25KG</xProd><NCM>28332500</NCM>
    <uCom>SC</uCom><qCom>4.0000</qCom><vUnCom>120.0000000000</vUnCom><vProd>480.00</vProd>
  </prod></det>
  <total><ICMSTot><vNF>1360.00</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

console.log("--- nota com dois itens ---");
const n1 = lerXmlNfe(notaDupla);
ok("chave de acesso preservada (44 digitos, sem virar numero)", n1.chaveAcesso === CHAVE, n1.chaveAcesso);
ok("CNPJ do emitente", n1.cnpjEmitente === "12345678000199", n1.cnpjEmitente);
ok("nome do emitente", n1.nomeEmitente === "AGRO INSUMOS LTDA");
ok("numero da nota", n1.numero === "1234", n1.numero);
ok("data de emissao", n1.dataEmissao.toISOString().startsWith("2026-07-15"), n1.dataEmissao.toISOString());
ok("dois itens lidos", n1.itens.length === 2, String(n1.itens.length));

const i1 = n1.itens[0];
ok("codigo com zero a esquerda preservado", i1.codigo === "007", i1.codigo);
ok("quantidade", i1.quantidade === 2);
ok("preco de tabela", i1.valorUnitario === 450);
// (900 - 50 + 30) / 2 = 440
ok("custo real por unidade inclui desconto e frete", i1.custoUnitarioReal === 440, String(i1.custoUnitarioReal));

const i2 = n1.itens[1];
ok("codigo com hifen", i2.codigo === "ABC-12", i2.codigo);
ok("item sem despesa: custo real = preco", i2.custoUnitarioReal === 120, String(i2.custoUnitarioReal));

const t1 = conferirTotal(n1);
ok("soma dos itens fecha com o total da nota", t1.confere, `soma ${t1.somaItens} x total ${n1.valorTotal}`);

// --- ARMADILHA: nota com UM item so. O parser entrega objeto, nao lista. ---
const notaUnica = `<?xml version="1.0"?>
<nfeProc><NFe><infNFe Id="NFe${CHAVE}">
  <ide><nNF>99</nNF><serie>1</serie><dhEmi>2026-07-20T08:00:00-03:00</dhEmi></ide>
  <emit><CNPJ>99888777000166</CNPJ><xNome>FORNECEDOR UNICO ME</xNome></emit>
  <det nItem="1"><prod>
    <cProd>X1</cProd><xProd>UREIA 50KG</xProd>
    <uCom>SC</uCom><qCom>10.0000</qCom><vUnCom>180.0000000000</vUnCom><vProd>1800.00</vProd>
  </prod></det>
  <total><ICMSTot><vNF>1800.00</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

console.log("\n--- nota com um item so (armadilha classica) ---");
const n2 = lerXmlNfe(notaUnica);
ok("leu o item unico como lista", n2.itens.length === 1, String(n2.itens.length));
ok("descricao do item unico", n2.itens[0].descricao === "UREIA 50KG");

// --- XML sem o embrulho nfeProc ---
console.log("\n--- XML sem o protocolo (NFe na raiz) ---");
const n3 = lerXmlNfe(notaUnica.replace("<nfeProc>", "").replace("</nfeProc>", ""));
ok("le NFe solta, sem nfeProc", n3.chaveAcesso === CHAVE);

// --- quantidade zero (bonificacao) nao pode virar Infinity ---
console.log("\n--- item com quantidade zero (bonificacao) ---");
const notaZero = notaUnica.replace("<qCom>10.0000</qCom>", "<qCom>0</qCom>");
const n4 = lerXmlNfe(notaZero);
ok("custo nao vira Infinity nem NaN", Number.isFinite(n4.itens[0].custoUnitarioReal), String(n4.itens[0].custoUnitarioReal));
ok("custo zerado", n4.itens[0].custoUnitarioReal === 0);

// --- divergencia de total tem de ser detectada ---
console.log("\n--- nota com total divergente ---");
const notaErrada = notaUnica.replace("<vNF>1800.00</vNF>", "<vNF>1500.00</vNF>");
const t2 = conferirTotal(lerXmlNfe(notaErrada));
ok("divergencia detectada", !t2.confere, `diferenca de R$ ${t2.diferenca}`);

// --- arquivos que nao servem ---
console.log("\n--- arquivos invalidos ---");
function recusa(rotulo: string, conteudo: string) {
  try { lerXmlNfe(conteudo); ok(rotulo, false, "aceitou quando deveria recusar"); }
  catch (e) { ok(rotulo, e instanceof XmlInvalidoError, e instanceof Error ? e.message : ""); }
}
recusa("texto que nao e XML", "isto nao e um xml");
recusa("XML de outra coisa", "<?xml version='1.0'?><recibo><n>1</n></recibo>");
recusa("NF-e sem chave de acesso", notaUnica.replace(`Id="NFe${CHAVE}"`, 'Id="NFe123"'));
recusa("NF-e sem itens", notaUnica.replace(/<det nItem="1">[\s\S]*?<\/det>/, ""));

console.log(falhas === 0 ? "\nTODOS OS CASOS PASSARAM" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
