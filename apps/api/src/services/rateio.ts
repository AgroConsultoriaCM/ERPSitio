// Rateio de custo entre talhoes proporcional a um peso: area em hectares nas
// operacoes normais; metros lineares percorridos nas pulverizacoes, onde o
// espacamento entre linhas de cada talhao muda quanto realmente foi
// percorrido, nao so a area.

export interface TalhaoParaRateio {
  id: string;
  areaHa: number | null;
}

export interface ParcelaRateio {
  talhaoId: string;
  areaHa: number | null;
  custoRateado: number | null;
}

export interface ItemParaRateio {
  id: string;
  peso: number;
}

export interface ParcelaRateioPeso {
  id: string;
  custoRateado: number | null;
}

/**
 * Distribui `custoTotal` entre itens na proporcao do `peso` de cada um.
 *
 * Casos de borda tratados:
 * - custo nulo/zero -> todas as parcelas ficam nulas;
 * - peso total zero/negativo -> cai para divisao igualitaria, porque ratear
 *   por um peso que ninguem tem seria arbitrario;
 * - o ultimo item absorve a diferenca de arredondamento, garantindo que a
 *   soma das parcelas seja exatamente o custo total.
 */
export function ratearPorPeso(
  itens: ItemParaRateio[],
  custoTotal: number | null | undefined,
): ParcelaRateioPeso[] {
  const semCusto = custoTotal == null || custoTotal === 0;

  if (semCusto) {
    return itens.map((i) => ({ id: i.id, custoRateado: null }));
  }

  const pesoTotal = itens.reduce((soma, i) => soma + (i.peso || 0), 0);
  const centavos = (v: number) => Math.round(v * 100) / 100;

  if (pesoTotal <= 0) {
    const parcela = centavos(custoTotal / itens.length);
    return itens.map((i, idx) => ({
      id: i.id,
      custoRateado:
        idx === itens.length - 1 ? centavos(custoTotal - parcela * (itens.length - 1)) : parcela,
    }));
  }

  let acumulado = 0;
  return itens.map((i, idx) => {
    const ultimo = idx === itens.length - 1;
    const valor = ultimo ? centavos(custoTotal - acumulado) : centavos((custoTotal * i.peso) / pesoTotal);
    acumulado = centavos(acumulado + valor);
    return { id: i.id, custoRateado: valor };
  });
}

/**
 * Distribui `custoTotal` entre os talhoes na proporcao da area de cada um -
 * especializacao de `ratearPorPeso` usando `areaHa` como peso. Mantida com o
 * mesmo formato de entrada/saida de sempre (talhoes com area, nao um peso
 * solto) porque e a forma mais comum de chamar isto no resto do sistema.
 */
export function ratearPorArea(
  talhoes: TalhaoParaRateio[],
  custoTotal: number | null | undefined,
): ParcelaRateio[] {
  const porPeso = ratearPorPeso(
    talhoes.map((t) => ({ id: t.id, peso: t.areaHa ?? 0 })),
    custoTotal,
  );
  const porId = new Map(porPeso.map((p) => [p.id, p.custoRateado]));
  return talhoes.map((t) => ({ talhaoId: t.id, areaHa: t.areaHa, custoRateado: porId.get(t.id) ?? null }));
}
