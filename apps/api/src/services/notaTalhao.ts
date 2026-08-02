/**
 * Nota do talhao a partir do satelite.
 *
 * Tres componentes, sempre visiveis separados. Nota unica escondendo o motivo
 * nao serve para agronomo: o que importa e *por que* caiu.
 *
 *   1. VIGOR       - OSAVI medio comparado a propria historia do talhao no
 *                    mesmo mes de anos anteriores
 *   2. UNIFORMIDADE- coeficiente de variacao (desvio / media)
 *   3. TENDENCIA   - para onde as ultimas leituras estao indo
 *
 * POR QUE OSAVI E NAO NDVI: em citros boa parte da area entre as ruas e solo
 * exposto, e o solo contamina o NDVI. O OSAVI desconta isso com o fator 0,16.
 * Medido no sitio: NDVI 0,663 contra OSAVI 0,450 na mesma cena.
 *
 * POR QUE COMPARAR COM A PROPRIA HISTORIA E NAO COM LIMIAR DE LIVRO: os valores
 * de referencia da literatura sao de cultura de cobertura total. Um limao a
 * 6x4 m nunca alcanca aquilo, e seria reprovado sem estar doente. Cada talhao
 * e julgado contra ele mesmo, no mesmo mes.
 *
 * LIMITES QUE ESTE CALCULO NAO VENCE:
 * - o NDVI satura acima de ~0,8 e para de distinguir dossel denso
 * - o pixel de 10 m mistura copa, solo e rua
 * - comparar talhoes entre si e injusto quando idade e espacamento diferem
 */

export type Faixa = "bom" | "atencao" | "critico" | "sem_dados";

export interface LeituraSatelite {
  /** Inicio do intervalo agregado, em ISO. */
  data: string;
  ndviMedio: number | null;
  osaviMedio: number | null;
  desvio: number | null;
  pixels: number;
}

export interface ComponenteNota {
  faixa: Faixa;
  /** Numero que sustenta a faixa, para aparecer na tela. */
  valor: number | null;
  /** Frase curta explicando, na linguagem da operacao. */
  explicacao: string;
}

export interface NotaTalhao {
  faixa: Faixa;
  vigor: ComponenteNota;
  uniformidade: ComponenteNota;
  tendencia: ComponenteNota;
  /** Quantas leituras com cena limpa sustentam esta nota. */
  leiturasUsadas: number;
  atualizadoEm: string | null;
}

const SEM_DADOS: ComponenteNota = {
  faixa: "sem_dados",
  valor: null,
  explicacao: "sem cena limpa no período",
};

/** Leituras com pixel de verdade. Cena nublada volta com sampleCount zero. */
export function apenasValidas(leituras: LeituraSatelite[]): LeituraSatelite[] {
  return leituras.filter((l) => l.pixels > 0 && l.osaviMedio != null && l.ndviMedio != null);
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenado = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  return ordenado.length % 2 === 0
    ? (ordenado[meio - 1] + ordenado[meio]) / 2
    : ordenado[meio];
}

const arred = (v: number, casas = 3) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

/**
 * Vigor: quanto o OSAVI atual se afasta da mediana historica do MESMO MES.
 *
 * Usa mediana, e nao media, porque uma unica cena com nuvem residual puxa a
 * media e faria um talhao saudavel parecer em queda.
 */
export function avaliarVigor(
  atual: LeituraSatelite | null,
  historicoMesmoMes: LeituraSatelite[],
): ComponenteNota {
  if (!atual?.osaviMedio) return SEM_DADOS;

  const base = mediana(
    apenasValidas(historicoMesmoMes)
      .map((l) => l.osaviMedio)
      .filter((v): v is number => v != null),
  );

  if (base == null || base === 0) {
    return {
      faixa: "sem_dados",
      valor: arred(atual.osaviMedio),
      explicacao: `OSAVI ${arred(atual.osaviMedio, 2)} — ainda sem histórico deste mês para comparar`,
    };
  }

  const variacao = ((atual.osaviMedio - base) / base) * 100;
  const faixa: Faixa = variacao <= -20 ? "critico" : variacao <= -8 ? "atencao" : "bom";

  const sinal = variacao >= 0 ? "+" : "";
  return {
    faixa,
    valor: arred(variacao, 1),
    explicacao:
      `OSAVI ${arred(atual.osaviMedio, 2)}, ${sinal}${arred(variacao, 1)}% ` +
      `frente à mediana deste mês (${arred(base, 2)})`,
  };
}

/**
 * Uniformidade: coeficiente de variacao dentro do talhao.
 *
 * CV alto significa mancha - falha de estande, planta doente, solo diferente.
 * Os cortes vêm do que se mede em pomar: abaixo de 20% e homogeneo, acima de
 * 30% ha area destoando o bastante para ir olhar.
 */
export function avaliarUniformidade(atual: LeituraSatelite | null): ComponenteNota {
  if (!atual?.ndviMedio || atual.desvio == null || atual.ndviMedio === 0) return SEM_DADOS;

  const cv = (atual.desvio / atual.ndviMedio) * 100;
  const faixa: Faixa = cv >= 30 ? "critico" : cv >= 20 ? "atencao" : "bom";

  return {
    faixa,
    valor: arred(cv, 1),
    explicacao:
      `variação interna de ${arred(cv, 1)}% — ` +
      (faixa === "bom"
        ? "talhão homogêneo"
        : faixa === "atencao"
          ? "há áreas destoando"
          : "manchas relevantes dentro do talhão"),
  };
}

/**
 * Tendencia: inclinacao das ultimas leituras.
 *
 * Regressao linear simples sobre o OSAVI das ultimas leituras validas. Duas
 * leituras nao formam tendencia - com menos de tres, devolve sem_dados em vez
 * de fingir que uma reta entre dois pontos significa algo.
 */
export function avaliarTendencia(recentes: LeituraSatelite[]): ComponenteNota {
  const validas = apenasValidas(recentes).slice(-6);
  if (validas.length < 3) {
    return { faixa: "sem_dados", valor: null, explicacao: "poucas cenas limpas para ver tendência" };
  }

  const n = validas.length;
  const xs = validas.map((_, i) => i);
  const ys = validas.map((l) => l.osaviMedio as number);
  const mediaX = xs.reduce((a, b) => a + b, 0) / n;
  const mediaY = ys.reduce((a, b) => a + b, 0) / n;
  const numerador = xs.reduce((s, x, i) => s + (x - mediaX) * (ys[i] - mediaY), 0);
  const denominador = xs.reduce((s, x) => s + (x - mediaX) ** 2, 0);
  const inclinacao = denominador === 0 ? 0 : numerador / denominador;

  // Variacao percentual por leitura, para o numero significar algo ao usuario.
  const porLeitura = mediaY === 0 ? 0 : (inclinacao / mediaY) * 100;
  const faixa: Faixa = porLeitura <= -3 ? "critico" : porLeitura <= -1 ? "atencao" : "bom";

  const rumo = porLeitura > 1 ? "subindo" : porLeitura < -1 ? "caindo" : "estável";
  return {
    faixa,
    valor: arred(porLeitura, 2),
    explicacao: `${rumo} ${arred(Math.abs(porLeitura), 1)}% por leitura, nas últimas ${n} cenas limpas`,
  };
}

/** A nota do talhao e o pior dos tres. Media esconderia um problema grave. */
export function combinar(componentes: ComponenteNota[]): Faixa {
  const ordem: Faixa[] = ["bom", "atencao", "critico"];
  const consideradas = componentes.filter((c) => c.faixa !== "sem_dados");
  if (consideradas.length === 0) return "sem_dados";
  return consideradas.reduce<Faixa>(
    (pior, c) => (ordem.indexOf(c.faixa) > ordem.indexOf(pior) ? c.faixa : pior),
    "bom",
  );
}

export function calcularNota(
  recentes: LeituraSatelite[],
  historicoMesmoMes: LeituraSatelite[],
): NotaTalhao {
  const validas = apenasValidas(recentes);
  const atual = validas.length > 0 ? validas[validas.length - 1] : null;

  const vigor = avaliarVigor(atual, historicoMesmoMes);
  const uniformidade = avaliarUniformidade(atual);
  const tendencia = avaliarTendencia(validas);

  return {
    faixa: combinar([vigor, uniformidade, tendencia]),
    vigor,
    uniformidade,
    tendencia,
    leiturasUsadas: validas.length,
    atualizadoEm: atual?.data ?? null,
  };
}
