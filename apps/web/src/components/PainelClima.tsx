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

const CORES_JANELA: Record<QualidadeJanela, { barra: string; ponto: string; rotulo: string }> = {
  boa: { barra: "bg-mata-100", ponto: "bg-mata-500", rotulo: "boa" },
  atencao: { barra: "bg-amber-100", ponto: "bg-amber-500", rotulo: "atenção" },
  ruim: { barra: "bg-red-100", ponto: "bg-red-500", rotulo: "evitar" },
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
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-terra-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="font-semibold text-terra-900">Clima e água</h2>
          <p className="text-sm text-terra-500">{resumoClima(clima)}</p>
        </div>
        <span className="text-xs text-terra-400">Open-Meteo</span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-terra-100 sm:grid-cols-4">
        <Numero titulo="Chuva 7 dias" valor={`${numero(clima.chuva7DiasMm)} mm`} />
        <Numero titulo="Chuva 30 dias" valor={`${numero(clima.chuva30DiasMm)} mm`} />
        <Numero
          titulo="Dias sem chuva"
          valor={clima.diasSemChuva != null ? String(clima.diasSemChuva) : "—"}
          alerta={(clima.diasSemChuva ?? 0) > 7}
        />
        <Numero
          titulo="Saldo hídrico 7d"
          valor={balanco.temDados ? `${balanco.saldoMm > 0 ? "+" : ""}${numero(balanco.saldoMm)} mm` : "—"}
          alerta={balanco.temDados && balanco.deficit}
          ajuda={
            balanco.temDados
              ? `Chuva ${numero(balanco.chuvaMm)} mm − demanda ${numero(balanco.demandaMm)} mm (ET0 × Kc 0,70)`
              : undefined
          }
        />
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-medium text-terra-700">Próximos dias</p>
          <p className="text-xs text-terra-500">
            {boa
              ? `melhor dia para pulverizar: ${diaCurto(boa.data)}`
              : "sem dia livre de chuva na semana"}
          </p>
        </div>

        <div className="flex gap-1.5 overflow-x-auto rolagem-fina pb-1">
          {previsao.map((d) => {
            const j = janela.find((x) => x.data === d.data);
            const cor = CORES_JANELA[j?.qualidade ?? "boa"];
            const altura = Math.max(3, ((d.chuvaMm ?? 0) / maxChuva) * 44);
            return (
              <div
                key={d.data}
                className="flex w-[3.25rem] shrink-0 flex-col items-center rounded-lg border border-terra-100 px-1 pb-1.5 pt-2"
                title={[
                  `${diaCurto(d.data)} — pulverização ${cor.rotulo}: ${j?.motivo ?? ""}`,
                  j?.avisoDiaSeguinte,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <span className="text-[10px] font-medium uppercase text-terra-500">
                  {diaSemana(d.data)}
                </span>
                <span className="numero text-[11px] text-terra-400">{diaCurto(d.data)}</span>

                <div className="mt-1.5 flex h-12 w-full items-end justify-center">
                  <div
                    className={`w-3.5 rounded-t ${(d.chuvaMm ?? 0) > 0 ? "bg-agua-400" : "bg-terra-200"}`}
                    style={{ height: `${altura}px` }}
                  />
                </div>

                <span className="numero mt-1 text-[11px] text-terra-600">
                  {(d.chuvaMm ?? 0) > 0 ? `${numero(d.chuvaMm)}` : "0"}
                </span>
                <span className="numero text-[10px] text-terra-400">
                  {d.tempMin != null && d.tempMax != null
                    ? `${Math.round(d.tempMin)}/${Math.round(d.tempMax)}°`
                    : ""}
                </span>

                <span className={`mt-1.5 h-1.5 w-full rounded-full ${cor.barra}`}>
                  <span className={`block h-1.5 w-1/3 rounded-full ${cor.ponto}`} />
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-terra-500">
          <span>Barra azul = chuva prevista (mm)</span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-mata-500" /> pulverização boa
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-amber-500" /> atenção
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-red-500" /> evitar
          </span>
        </div>
      </div>
    </div>
  );
}

function Numero({
  titulo,
  valor,
  alerta,
  ajuda,
}: {
  titulo: string;
  valor: string;
  alerta?: boolean;
  ajuda?: string;
}) {
  return (
    <div className="bg-white px-4 py-3" title={ajuda}>
      <p className="rotulo">{titulo}</p>
      <p
        className={`numero mt-0.5 text-xl font-bold ${alerta ? "text-amber-700" : "text-terra-800"}`}
      >
        {valor}
      </p>
    </div>
  );
}
