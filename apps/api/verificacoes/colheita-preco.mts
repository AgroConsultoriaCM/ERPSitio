// Prova a conta de receita da colheita, sem subir servidor nem banco.
//
//   npx tsx apps/api/verificacoes/colheita-preco.mts
//
// O limao e vendido por caixa padrao de 27,2 kg, com preco diferente para
// fruta boa e refugo. A receita nao e digitada: sai da conversao do preco da
// caixa em preco do quilo, multiplicado pelo peso de cada qualidade.
import { comDerivados, PESO_CAIXA_PADRAO_KG } from "../src/routes/colheitas.routes.js";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = obtido === esperado;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome}${ok ? "" : `  obtido ${obtido}, esperado ${esperado}`}`);
  if (!ok) falhas++;
}

// Molde minimo: comDerivados so olha estes campos.
const base = {
  quantidadeCaixas: 0,
  pesoTotalKg: null as number | null,
  pesoRefugoKg: null as number | null,
  precoCaixaBom: null as number | null,
  precoCaixaRefugo: null as number | null,
  valorTotalVenda: null as number | null,
  custoColheita: null as number | null,
  talhao: { areaHa: null as number | null, cultura: null as { pesoCaixaKg: number | null } | null },
};
const calcular = (dados: Partial<typeof base>) =>
  comDerivados({ ...base, ...dados } as never as never) as unknown as Record<string, number | null>;

/** Cultura vendida por caixa, como o limao taiti. */
const porCaixa = (kg: number) => ({ pesoCaixaKg: kg });
/** Cultura vendida por quilo, como o abacate. */
const porQuilo = { pesoCaixaKg: null };

console.log(`\npeso de caixa usado quando o talhao nao tem cultura: ${PESO_CAIXA_PADRAO_KG} kg\n`);

console.log("== LIMAO: preco por caixa de 27,2 kg (exemplo combinado) ==");
{
  // 1000 kg, 150 de refugo, R$100/cx no bom e R$40/cx no refugo
  const r = calcular({
    talhao: { areaHa: null, cultura: porCaixa(27.2) },
    quantidadeCaixas: 40,
    pesoTotalKg: 1000,
    pesoRefugoKg: 150,
    precoCaixaBom: 100,
    precoCaixaRefugo: 40,
  });
  conferir("peso de fruta boa = total - refugo", r.pesoLiquidoKg, 850);
  conferir("receita boa  = 850 x (100/27,2)", r.valorVendaBom, 3125);
  conferir("receita refugo = 150 x (40/27,2)", r.valorVendaRefugo, 220.59);
  conferir("total = soma das duas", r.valorVendaTotal, 3345.59);
  conferir("percentual de refugo", r.percentualRefugo, 15);
  conferir("kg por caixa colhida", r.kgPorCaixa, 25);
}

console.log("\n== ABACATE: preco ja vem por quilo, nao se divide nada ==");
{
  // Mesmos pesos, mas preco em R$/kg: 3,00 no bom e 1,00 no refugo
  const r = calcular({
    talhao: { areaHa: null, cultura: porQuilo },
    quantidadeCaixas: 40,
    pesoTotalKg: 1000,
    pesoRefugoKg: 150,
    precoCaixaBom: 3,
    precoCaixaRefugo: 1,
  });
  conferir("preco do quilo e o proprio preco lancado", r.precoKgBom, 3);
  conferir("receita boa = 850 kg x R$ 3,00", r.valorVendaBom, 2550);
  conferir("receita refugo = 150 kg x R$ 1,00", r.valorVendaRefugo, 150);
  conferir("total", r.valorVendaTotal, 2700);
  conferir("unidade informada a tela e nula", r.pesoCaixaKg, null);
}

console.log("\n== a mesma propriedade com as duas unidades ao mesmo tempo ==");
{
  const limao = calcular({
    talhao: { areaHa: null, cultura: porCaixa(27.2) },
    quantidadeCaixas: 10,
    pesoTotalKg: 272,
    precoCaixaBom: 100,
  });
  const abacate = calcular({
    talhao: { areaHa: null, cultura: porQuilo },
    quantidadeCaixas: 10,
    pesoTotalKg: 272,
    precoCaixaBom: 100,
  });
  conferir("limao: 272 kg com R$100/cx = 10 caixas x 100", limao.valorVendaBom, 1000);
  conferir("abacate: 272 kg com R$100/kg", abacate.valorVendaBom, 27200);
  conferir("o mesmo numero digitado da resultados diferentes, e certo", true, true);
}

console.log("\n== talhao sem cultura cadastrada mantem o comportamento antigo ==");
{
  const r = calcular({
    talhao: { areaHa: null, cultura: null },
    quantidadeCaixas: 10,
    pesoTotalKg: 272,
    precoCaixaBom: 100,
  });
  conferir("cai no peso padrao de 27,2", r.valorVendaBom, 1000);
  conferir("informa a unidade usada", r.pesoCaixaKg, PESO_CAIXA_PADRAO_KG);
}

console.log("\n== peso de caixa zerado no cadastro nao divide por zero ==");
{
  const r = calcular({
    talhao: { areaHa: null, cultura: { pesoCaixaKg: 0 } },
    quantidadeCaixas: 10,
    pesoTotalKg: 100,
    precoCaixaBom: 5,
  });
  conferir("trata como preco por quilo", r.valorVendaBom, 500);
}

console.log("\n== margem desconta o custo de colheita ==");
{
  const r = calcular({
    talhao: { areaHa: null, cultura: porCaixa(27.2) },
    quantidadeCaixas: 40,
    pesoTotalKg: 1000,
    pesoRefugoKg: 150,
    precoCaixaBom: 100,
    precoCaixaRefugo: 40,
    custoColheita: 345.59,
  });
  conferir("margem = 3345,59 - 345,59", r.margem, 3000);
}

console.log("\n== so preco do bom, sem refugo lancado ==");
{
  const r = calcular({ quantidadeCaixas: 10, pesoTotalKg: 272, precoCaixaBom: 50 });
  conferir("refugo ausente conta como zero", r.pesoLiquidoKg, 272);
  conferir("receita boa = 272 x (50/27,2)", r.valorVendaBom, 500);
  conferir("sem preco de refugo, receita refugo e nula", r.valorVendaRefugo, null);
  conferir("total considera so o bom", r.valorVendaTotal, 500);
}

console.log("\n== lancamento antigo, com valor fechado ==");
{
  const r = calcular({ quantidadeCaixas: 10, pesoTotalKg: 272, valorTotalVenda: 900 });
  conferir("sem precos por qualidade, vale o valor fechado", r.valorVendaTotal, 900);
  conferir("nao inventa receita por qualidade", r.valorVendaBom, null);
}

console.log("\n== preco por qualidade tem prioridade sobre o valor antigo ==");
{
  const r = calcular({
    quantidadeCaixas: 10,
    pesoTotalKg: 272,
    precoCaixaBom: 50,
    valorTotalVenda: 900,
  });
  conferir("o calculado manda", r.valorVendaTotal, 500);
}

console.log("\n== sem peso nao ha como calcular ==");
{
  const r = calcular({ quantidadeCaixas: 10, precoCaixaBom: 50 });
  conferir("sem peso, receita boa e nula", r.valorVendaBom, null);
  conferir("total tambem", r.valorVendaTotal, null);
}

console.log("\n== preco zero e diferente de preco ausente ==");
{
  const r = calcular({ quantidadeCaixas: 10, pesoTotalKg: 272, pesoRefugoKg: 72, precoCaixaRefugo: 0 });
  conferir("refugo doado: receita zero, nao nula", r.valorVendaRefugo, 0);
  conferir("total reconhece o zero como venda lancada", r.valorVendaTotal, 0);
}

console.log(falhas === 0 ? "\nTUDO OK\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
