// Rateio de custo entre talhoes proporcional a area (decisao do usuario:
// "por area em hectares"). Usado nas operacoes de campo e, na fase de
// pulverizacao, tambem para o custo dos produtos.

export interface TalhaoParaRateio {
  id: string;
  areaHa: number | null;
}

export interface ParcelaRateio {
  talhaoId: string;
  areaHa: number | null;
  custoRateado: number | null;
}

/**
 * Distribui `custoTotal` entre os talhoes na proporcao da area de cada um.
 *
 * Casos de borda tratados:
 * - custo nulo/zero -> todas as parcelas ficam nulas (operacao da equipe
 *   propria, sem custo de terceiro lancado);
 * - talhoes sem area cadastrada -> cai para divisao igualitaria, porque
 *   ratear por area seria arbitrario sem o dado;
 * - a ultima parcela absorve a diferenca de arredondamento, garantindo que
 *   a soma das parcelas seja exatamente o custo total.
 */
export function ratearPorArea(
  talhoes: TalhaoParaRateio[],
  custoTotal: number | null | undefined,
): ParcelaRateio[] {
  const semCusto = custoTotal == null || custoTotal === 0;

  if (semCusto) {
    return talhoes.map((t) => ({ talhaoId: t.id, areaHa: t.areaHa, custoRateado: null }));
  }

  const areaTotal = talhoes.reduce((soma, t) => soma + (t.areaHa ?? 0), 0);
  const centavos = (v: number) => Math.round(v * 100) / 100;

  // sem area utilizavel: divide igualmente
  if (areaTotal <= 0) {
    const parcela = centavos(custoTotal / talhoes.length);
    return talhoes.map((t, i) => ({
      talhaoId: t.id,
      areaHa: t.areaHa,
      custoRateado:
        i === talhoes.length - 1
          ? centavos(custoTotal - parcela * (talhoes.length - 1))
          : parcela,
    }));
  }

  let acumulado = 0;
  return talhoes.map((t, i) => {
    const ultimo = i === talhoes.length - 1;
    const valor = ultimo
      ? centavos(custoTotal - acumulado)
      : centavos((custoTotal * (t.areaHa ?? 0)) / areaTotal);
    acumulado = centavos(acumulado + valor);
    return { talhaoId: t.id, areaHa: t.areaHa, custoRateado: valor };
  });
}
