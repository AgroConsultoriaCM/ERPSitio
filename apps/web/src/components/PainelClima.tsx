import { CalendarDays, CloudRain, Droplets, Scale, SprayCan, Sun, SunMedium, Wind } from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import type { RespostaClima } from "../lib/types";
import {
  balancoHidrico,
  diaCurto,
  diaSemana,
  janelaPulverizacao,
  proximaJanelaBoa,
  resumoClima,
  type QualidadeJanela,
} from "../lib/clima";
import { numero } from "./ui";

const CORES_JANELA: Record<QualidadeJanela, { trilho: string; ponto: string; rotulo: string }> = {
  boa: { trilho: "bg-mata-100", ponto: "bg-mata-500", rotulo: "boa" },
  atencao: { trilho: "bg-amber-100", ponto: "bg-amber-500", rotulo: "atenção" },
  ruim: { trilho: "bg-red-100", ponto: "bg-red-500", rotulo: "evitar" },
};

/**
 * Clima da coordenada da propriedade, lido em chave de decisão: quanto choveu,
 * quanto a planta pediu, e em que dia dá para pulverizar.
 *
 * Compacto de propósito — é um bloco do painel, não a tela de manejo hídrico,
 * que continua sendo o lugar do detalhe e do registro de irrigação.
 */
export default function PainelClima({ clima }: { clima: RespostaClima }) {
  const janela = janelaPulverizacao(clima.dias);
  const boa = proximaJanelaBoa(janela);
  const balanco = balancoHidrico(clima.dias);
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
            <p className="text-sm leading-snug text-terra-500">{resumoClima(clima)}</p>
          </div>
        </div>
        <span className="rounded-full bg-terra-100 px-2 py-0.5 text-[11px] font-medium text-terra-500">
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
              ? `Chuva ${numero(balanco.chuvaMm)} mm − demanda ${numero(balanco.demandaMm)} mm (ET0 × Kc 0,70)`
              : undefined
          }
        />
      </div>

      <div className="px-4 py-5 sm:px-5">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-terra-700">
            <SprayCan size={16} strokeWidth={2} className="text-terra-400" />
            Janela de pulverização
          </p>
          {boa ? (
            <span className="rounded-full bg-mata-50 px-2.5 py-1 text-xs font-semibold text-mata-700 ring-1 ring-mata-100">
              melhor dia: {diaCurto(boa.data)}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
              sem dia livre de chuva
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {previsao.map((d) => {
            const j = janela.find((x) => x.data === d.data);
            const cor = CORES_JANELA[j?.qualidade ?? "boa"];
            const altura = Math.max(4, ((d.chuvaMm ?? 0) / maxChuva) * 52);
            return (
              <div
                key={d.data}
                className="flex flex-col items-center rounded-2xl border border-terra-100 px-2 pb-3 pt-3 transition duration-200 ease-suave hover:-translate-y-0.5 hover:border-terra-200 hover:shadow-cartao"
                title={[
                  `${diaCurto(d.data)} — pulverização ${cor.rotulo}: ${j?.motivo ?? ""}`,
                  j?.avisoDiaSeguinte,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-terra-500">
                  {diaSemana(d.data)}
                </span>
                <span className="numero text-xs text-terra-400">{diaCurto(d.data)}</span>

                <div className="mt-2 flex h-14 w-full items-end justify-center">
                  <div
                    className={`w-5 origin-bottom animate-crescer rounded-t ${
                      (d.chuvaMm ?? 0) > 0
                        ? "bg-gradient-to-t from-agua-500 to-agua-300"
                        : "bg-terra-200"
                    }`}
                    style={{ height: `${altura}px` }}
                  />
                </div>

                <span className="numero mt-1.5 text-sm font-semibold text-terra-700">
                  {(d.chuvaMm ?? 0) > 0 ? numero(d.chuvaMm) : "0"} mm
                </span>
                <span className="numero text-xs text-terra-400">
                  {d.tempMin != null && d.tempMax != null
                    ? `${Math.round(d.tempMin)}° / ${Math.round(d.tempMax)}°`
                    : ""}
                </span>

                <div className="mt-2 flex w-full items-center justify-center gap-2.5 border-t border-terra-100 pt-2 text-terra-500">
                  <span className="flex items-center gap-1" title="Umidade relativa média">
                    <Droplets size={11} className="text-agua-400" />
                    <span className="numero text-[11px]">
                      {d.umidadeMediaPct != null ? `${Math.round(d.umidadeMediaPct)}%` : "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1" title="Vento máximo">
                    <Wind size={11} className="text-terra-400" />
                    <span className="numero text-[11px]">
                      {d.ventoMaxKmh != null ? `${Math.round(d.ventoMaxKmh)}` : "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1" title="Índice UV máximo">
                    <SunMedium size={11} className="text-amber-400" />
                    <span className="numero text-[11px]">
                      {d.indiceUv != null ? numero(d.indiceUv, 0) : "—"}
                    </span>
                  </span>
                </div>

                <span className={`mt-2.5 h-2 w-full overflow-hidden rounded-full ${cor.trilho}`}>
                  <span className={`block h-2 w-1/3 rounded-full ${cor.ponto}`} />
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-terra-500">
          <span className="flex items-center gap-1.5">
            <Droplets size={12} className="text-agua-400" /> chuva e umidade
          </span>
          <span className="flex items-center gap-1.5">
            <Wind size={12} className="text-terra-400" /> vento (km/h)
          </span>
          <span className="flex items-center gap-1.5">
            <SunMedium size={12} className="text-amber-400" /> índice UV
          </span>
          <span className="mx-1 h-3 w-px bg-terra-200" />
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-mata-500" /> boa
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-amber-500" /> atenção
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-red-500" /> evitar
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-terra-400">
          Além da chuva, entram vento (deriva acima de 15 km/h, inversão térmica abaixo de 3 km/h) e
          umidade (evaporação da calda abaixo de 50%) — passe o mouse sobre o dia para ver qual fator
          pesou.
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
