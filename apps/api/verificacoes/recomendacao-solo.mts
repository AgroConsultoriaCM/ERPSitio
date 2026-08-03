// Prova a classificacao de status geral do solo (a bolinha do Manejo
// Nutricional) contra o perfil de correcao da cultura.
//
//   npx tsx apps/api/verificacoes/recomendacao-solo.mts
import { classificarStatusGeralSolo } from "../src/services/recomendacaoSolo.js";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = obtido === esperado;
  console.log(
    `  ${ok ? "ok   " : "FALHA"} ${nome}${ok ? "" : `  obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`,
  );
  if (!ok) falhas++;
}

const analiseBase = {
  dataColeta: new Date("2026-01-01"),
  ph: 6.0,
  materiaOrganica: 25,
  fosforo: 25,
  potassio: 3.5,
  calcio: 40,
  magnesio: 15,
  ctc: 80,
  saturacaoBases: 70,
};

const perfil = {
  nome: "Citros",
  phIdealMin: 5.5,
  phIdealMax: 6.5,
  materiaOrganicaIdeal: 25,
  fosforoIdeal: 25,
  potassioIdeal: 3.5,
  calcioIdeal: 40,
  magnesioIdeal: 15,
  saturacaoBasesIdeal: 70,
};

console.log("\n== sem perfil cadastrado -> sem_referencia, nunca 'adequado' por omissao ==");
{
  conferir("sem perfil", classificarStatusGeralSolo(analiseBase, null), "SEM_REFERENCIA");
}

console.log("\n== tudo dentro do ideal ==");
{
  conferir("tudo igual ao ideal", classificarStatusGeralSolo(analiseBase, perfil), "ADEQUADO");
}

console.log("\n== um so parametro critico ja marca a bolinha toda ==");
{
  // Potassio bem abaixo do ideal (ideal 3.5, aqui 1.0 -> razao 0,29 < 0,7)
  const analise = { ...analiseBase, potassio: 1.0 };
  conferir("potassio baixo derruba a bolinha inteira", classificarStatusGeralSolo(analise, perfil), "BAIXO");
}

console.log("\n== margem inferior (perto do ideal, mas abaixo) ==");
{
  // Ideal 3.5; 80% do ideal = 2.8 -> razao 0,8, entre 0,7 e 1 = MARGEM
  const analise = { ...analiseBase, potassio: 2.8 };
  conferir("80% do ideal = margem, nao baixo", classificarStatusGeralSolo(analise, perfil), "MARGEM");
}

console.log("\n== muito acima do ideal ==");
{
  // Ideal 3.5; 200% do ideal = 7.0 -> razao 2,0 > 1,4 = ALTO
  const analise = { ...analiseBase, potassio: 7.0 };
  conferir("200% do ideal = alto", classificarStatusGeralSolo(analise, perfil), "ALTO");
}

console.log("\n== BAIXO tem prioridade sobre ALTO quando ha os dois ao mesmo tempo ==");
{
  // Um nutriente muito baixo, outro muito alto ao mesmo tempo - o pior (BAIXO)
  // deve vencer, porque falta e mais urgente que sobra.
  const analise = { ...analiseBase, potassio: 1.0, calcio: 100 };
  conferir("baixo vence alto", classificarStatusGeralSolo(analise, perfil), "BAIXO");
}

console.log("\n== pH: faixa com minimo E maximo, nao so um 'ideal' ==");
{
  // Faixa 5,5-6,5 (largura 1,0), margem = 25% da largura = 0,25.
  conferir("pH 5,3 esta na margem (entre 5,25 e 5,5)", classificarStatusGeralSolo({ ...analiseBase, ph: 5.3 }, perfil), "MARGEM");
  conferir("pH 5,1 esta baixo (abaixo de 5,25)", classificarStatusGeralSolo({ ...analiseBase, ph: 5.1 }, perfil), "BAIXO");
  conferir("pH 6,6 continua adequado (ate 6,75)", classificarStatusGeralSolo({ ...analiseBase, ph: 6.6 }, perfil), "ADEQUADO");
  conferir("pH 6,9 esta alto (acima de 6,75)", classificarStatusGeralSolo({ ...analiseBase, ph: 6.9 }, perfil), "ALTO");
}

console.log("\n== parametro sem valor medido nao entra na conta ==");
{
  // fosforo null: o resto continua adequado, e fosforo nao pode contar como
  // "baixo" so por estar ausente - isso seria inventar dado.
  const analise = { ...analiseBase, fosforo: null };
  conferir("fosforo ausente nao derruba a bolinha", classificarStatusGeralSolo(analise, perfil), "ADEQUADO");
}

console.log("\n== nenhum parametro em comum com o perfil -> sem_referencia ==");
{
  const perfilVazio = { ...perfil, phIdealMin: null, phIdealMax: null, materiaOrganicaIdeal: null, fosforoIdeal: null, potassioIdeal: null, calcioIdeal: null, magnesioIdeal: null, saturacaoBasesIdeal: null };
  conferir("perfil sem nenhum ideal preenchido", classificarStatusGeralSolo(analiseBase, perfilVazio), "SEM_REFERENCIA");
}

console.log(falhas === 0 ? "\nTUDO OK\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
