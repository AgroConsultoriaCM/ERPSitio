import { CalendarDays, CloudRain, Droplets, Scale, Settings2, SprayCan, Sun, SunMedium, Wind } from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ParametroPulverizacao, RespostaClima } from "../lib/types";
import { api } from "../lib/api";
import { ROTAS } from "../lib/rotas";
import {
  balancoHidrico,
  diaCurto,
  diaSemana,
  janelaPulverizacao,
  PARAMETROS_PADRAO,
  proximaJanelaBoa,
  resumoClima,
} from "../lib/clima";
import { numero } from "./ui";

/** Faixas de cor do score contínuo (0-100), do pior ao melhor. */
function corDoScore(score: number): { fill: string; track: string; rotulo: string } {
  if (score > 90) return { fill: "from-agua-600 to-agua-400", track: "bg-agua-50", rotulo: "ótimo" };
  if (score >= 70) return { fill: "from-mata-600 to-mata-400", track: "bg-mata-50", rotulo: "bom" };
  if (score >= 40) return { fill: "from-amber-600 to-amber-400", track: "bg-amber-50", rotulo: "atenção" };
  if (score >= 20) return { fill: "from-orange-600 to-orange-400", track: "bg-orange-50", rotulo: "ruim" };
  return { fill: "from-red-600 to-red-400", track: "bg-red-50", rotulo: "evitar" };
}

/**
 * Clima da coordenada da propriedade, lido em chave de decisão: quanto choveu,
 * quanto a planta pediu, e em que dia dá para pulverizar.
 *
 * Compacto de propósito — é um bloco do painel, não a tela de manejo hídrico,
 * que continua sendo o lugar do detalhe e do registro de irrigação.
 */
export default function PainelClima({ clima }: { clima: RespostaClima }) {
  const { data: parametrosSalvos } = useQuery({
    queryKey: ["parametros-pulverizacao"],
    queryFn: () => api.get<ParametroPulverizacao>("/parametros-pulverizacao"),
  });
  const parametros = parametrosSalvos ?? PARAMETROS_PADRAO;

  const janela = janelaPulverizacao(clima.dias, parametros);
  const boa = proximaJanelaBoa(janela);
  const balanco = balancoHidrico(clima.dias, 7, parametros.kcCultura);
  const previsao = clima.dias.filter((d) => !d.passado);
  const maxChuva = Math.max(2, ...previsao.map((d) => d.chuvaMm ?? 0));

  return (
    <div className="cartao overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terra-100 bg-gradient-to-r from-agua-50/60 to-transparent px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-agua-100 text-agua-600 ring-1 ring-agua-200/60">
            <CloudRain size={16} strokeWidth={2} />
          </span>
          <div>
            <h2 className="font-semibold tracking-tight text-terra-900">Clima e água</h2>
            <p className="text-sm leading-snug text-terra-600">{resumoClima(clima, parametros)}</p>
          </div>
        </div>
        <span className="rounded-full bg-terra-100 px-2 py-0.5 text-xs font-medium text-terra-600">
          Open-Meteo
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-terra-100 sm:grid-cols-4">
        <Numero titulo="Chuva 7 dias" valor={`${numero(clima.chuva7DiasMm)} mm`} icone={CloudRain} />
        <Numero
          titulo="Chuva 30 dias"
          valor={`${numero(clima.chuva30DiasMm)} mm`}
          icone={CalendarDays}
        />
        <Numero
          titulo="Dias sem chuva"
          valor={clima.diasSemChuva != null ? String(clima.diasSemChuva) : "—"}
          icone={Sun}
          alerta={(clima.diasSemChuva ?? 0) > 7}
        />
        <Numero
          titulo="Saldo hídrico 7d"
          valor={
            balanco.temDados ? `${balanco.saldoMm > 0 ? "+" : ""}${numero(balanco.saldoMm)} mm` : "—"
          }
          icone={Scale}
          alerta={balanco.temDados && balanco.deficit}
          ajuda={
            balanco.temDados
              ? `Chuva ${numero(balanco.chuvaMm)} mm − demanda ${numero(balanco.demandaMm)} mm (ET0 × Kc ${numero(parametros.kcCultura, 2)})`
              : undefined
          }
        />
      </div>

      <div className="px-4 py-5 sm:px-5">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-base font-semibold text-terra-800">
            <SprayCan size={17} strokeWidth={2} className="text-terra-500" />
            Janela de pulverização
          </p>
          <div className="flex items-center gap-2">
            {boa ? (
              <span className="rounded-full bg-mata-50 px-2.5 py-1 text-sm font-semibold text-mata-700 ring-1 ring-mata-100">
                melhor dia: {diaCurto(boa.data)}
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-700 ring-1 ring-amber-100">
                sem dia livre de chuva
              </span>
            )}
            <Link
              to={ROTAS.parametrosPulverizacao}
              className="flex items-center gap-1 rounded-full border border-terra-200 px-2.5 py-1 text-sm font-medium text-terra-600 transition hover:border-terra-300 hover:bg-terra-50"
              title="Editar parâmetros ideais"
            >
              <Settings2 size={13} />
              Parâmetros
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {previsao.map((d) => {
            const j = janela.find((x) => x.data === d.data);
            const score = j?.score ?? 100;
            const cor = corDoScore(score);
            return (
              <div
                key={d.data}
                className="flex flex-col items-center rounded-2xl border border-terra-100 px-2 pb-3 pt-3 transition duration-200 ease-suave hover:-translate-y-0.5 hover:border-terra-200 hover:shadow-cartao"
                title={[`${diaCurto(d.data)} — score ${score}% (${cor.rotulo}): ${j?.motivo ?? ""}`, j?.avisoDiaSeguinte]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <span className="text-sm font-semibold uppercase tracking-wide text-terra-600">
                  {diaSemana(d.data)}
                </span>
                <span className="numero text-sm text-terra-500">{diaCurto(d.data)}</span>

                {/* Probabilidade de chuva, em cima da barra que ela descreve. */}
                <span
                  className="numero mt-1.5 text-xs font-semibold text-agua-600"
                  title="Probabilidade de chuva no dia"
                >
                  {d.probabilidadeChuva != null ? `${Math.round(d.probabilidadeChuva)}%` : "—"}
                </span>

                {/* Candle de chuva: altura proporcional aos mm previstos no dia. */}
                <div className="mt-1 flex h-14 w-full items-end justify-center" title={`${numero(d.chuvaMm ?? 0)} mm previstos`}>
                  <div
                    className={`w-6 origin-bottom animate-crescer rounded-t ${
                      (d.chuvaMm ?? 0) > 0 ? "bg-gradient-to-t from-agua-500 to-agua-300" : "bg-terra-200"
                    }`}
                    style={{ height: `${Math.max(4, ((d.chuvaMm ?? 0) / maxChuva) * 52)}px` }}
                  />
                </div>

                <span className="numero mt-1.5 text-base font-semibold text-terra-800" title="Chuva prevista para o dia, em milímetros (mm)">
                  {(d.chuvaMm ?? 0) > 0 ? numero(d.chuvaMm) : "0"} mm
                </span>
                <span className="numero text-sm text-terra-500" title="Temperatura mínima / máxima prevista, em °C">
                  {d.tempMin != null && d.tempMax != null
                    ? `${Math.round(d.tempMin)}° / ${Math.round(d.tempMax)}°`
                    : ""}
                </span>

                <div className="mt-2 flex w-full items-center justify-center gap-2.5 border-t border-terra-100 pt-2 text-terra-600">
                  <span className="flex items-center gap-1" title="Umidade relativa média do dia (%)">
                    <Droplets size={12} className="text-agua-500" />
                    <span className="numero text-xs">
                      {d.umidadeMediaPct != null ? `${Math.round(d.umidadeMediaPct)}%` : "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1" title="Vento máximo previsto, em km/h">
                    <Wind size={12} className="text-terra-500" />
                    <span className="numero text-xs">
                      {d.ventoMaxKmh != null ? `${Math.round(d.ventoMaxKmh)}` : "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1" title="Índice UV máximo previsto (escala 0-11+)">
                    <SunMedium size={12} className="text-amber-500" />
                    <span className="numero text-xs">
                      {d.indiceUv != null ? numero(d.indiceUv, 0) : "—"}
                    </span>
                  </span>
                </div>

                {/* Score de pulverização: barra deitada, sempre 0-100% preenchida. */}
                <div className="mt-2.5 w-full" title={`Score de pulverização: ${score}% (${cor.rotulo})`}>
                  <div className={`h-2 w-full overflow-hidden rounded-full ${cor.track}`}>
                    <div
                      className={`h-2 origin-left animate-crescer-x rounded-full bg-gradient-to-r ${cor.fill}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="numero mt-1 block text-center text-xs font-semibold text-terra-500">{score}%</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-terra-600">
          <span className="flex items-center gap-1.5">
            <Droplets size={12} className="text-agua-500" /> chuva e umidade
          </span>
          <span className="flex items-center gap-1.5">
            <Wind size={12} className="text-terra-500" /> vento (km/h)
          </span>
          <span className="flex items-center gap-1.5">
            <SunMedium size={12} className="text-amber-500" /> índice UV
          </span>
          <span className="mx-1 h-3 w-px bg-terra-200" />
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-agua-500" /> &gt;90% ótimo
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-mata-500" /> 70–90% bom
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-amber-500" /> 40–70% atenção
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-orange-500" /> 20–40% ruim
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-red-500" /> &lt;20% evitar
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-terra-500">
          Score de 0 a 100% combinando chuva, vento e umidade contra os parâmetros ideais cadastrados —
          passe o mouse sobre o dia para ver qual fator pesou mais.
        </p>
      </div>
    </div>
  );
}

function Numero({
  titulo,
  valor,
  alerta,
  ajuda,
  icone: Ico,
}: {
  titulo: string;
  valor: string;
  alerta?: boolean;
  ajuda?: string;
  icone: ComponentType<LucideProps>;
}) {
  return (
    <div className="group bg-white px-4 py-3 transition-colors duration-200 hover:bg-terra-50/60" title={ajuda}>
      <p className="flex items-center gap-1.5 rotulo">
        <Ico
          size={12}
          strokeWidth={2.25}
          className={alerta ? "text-amber-500" : "text-terra-400"}
        />
        {titulo}
      </p>
      <p
        className={`numero mt-1 text-xl font-bold ${alerta ? "text-amber-700" : "text-terra-800"}`}
      >
        {valor}
      </p>
    </div>
  );
}
