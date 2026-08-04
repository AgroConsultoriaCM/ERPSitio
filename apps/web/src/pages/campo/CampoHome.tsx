import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertCircle, CalendarClock, ChevronRight, Citrus, ClipboardList, Clock, Droplets, Plus, SprayCan, Thermometer, Wind } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { db } from "../../offline/db";
import { numero } from "../../components/ui";
import type { AgoraClima, Atividade, Colheita, ParametroPulverizacao, RespostaClima } from "../../lib/types";
import { corDoScore, horaCurta, PARAMETROS_PADRAO, scoreAgora, type ParametrosJanela } from "../../lib/clima";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function Secao({ children }: { children: string }) {
  return <h2 className="mb-2 rotulo">{children}</h2>;
}

/** Condição do instante, pensada pra "ligo a bomba agora?" em pé no talhão —
 *  não a previsão do dia, que é decisão de quem planeja lá no escritório. */
function BlocoClimaCampo({ agora, parametros }: { agora: AgoraClima; parametros: ParametrosJanela }) {
  const s = scoreAgora(agora, parametros);
  const cor = corDoScore(s.score);

  return (
    <div className="cartao p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-terra-800">
          <SprayCan size={16} className="text-terra-500" />
          Pulverizar agora
        </p>
        <span
          className={`rounded-full bg-gradient-to-r px-2.5 py-1 text-xs font-semibold text-white ${cor.fill}`}
        >
          {s.chovendo ? "chovendo" : `${s.score}% ${cor.rotulo}`}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-4 text-sm text-terra-600">
        <span className="flex items-center gap-1">
          <Wind size={14} className="text-terra-500" />
          {agora.ventoKmh != null ? `${Math.round(agora.ventoKmh)} km/h` : "—"}
        </span>
        <span className="flex items-center gap-1">
          <Droplets size={14} className="text-agua-500" />
          {agora.umidadePct != null ? `${Math.round(agora.umidadePct)}%` : "—"}
        </span>
        <span className="flex items-center gap-1">
          <Thermometer size={14} className="text-amber-500" />
          {agora.tempC != null ? `${Math.round(agora.tempC)}°` : "—"}
        </span>
        <span className="ml-auto text-xs text-terra-400">{horaCurta(agora.hora)}</span>
      </div>
      <p className="mt-1.5 text-xs text-terra-500">{s.motivo}</p>
    </div>
  );
}

export default function CampoHome() {
  const { usuario } = useAuth();
  const hoje = hojeISO();
  const intervalo = `dataInicio=${hoje}T00:00:00.000Z&dataFim=${hoje}T23:59:59.999Z`;

  const { data: atividadesHoje, isLoading: carregandoOps } = useQuery({
    queryKey: ["atividades-hoje", usuario?.id],
    queryFn: () => api.get<Atividade[]>(`/atividades?responsavelId=${usuario!.id}&${intervalo}`),
    enabled: !!usuario,
  });

  const { data: colheitasHoje, isLoading: carregandoColheitas } = useQuery({
    queryKey: ["colheitas-hoje"],
    queryFn: () => api.get<Colheita[]>(`/colheitas?${intervalo}`),
  });

  const { data: clima } = useQuery({
    queryKey: ["clima"],
    queryFn: () => api.get<RespostaClima>("/clima"),
  });
  const { data: parametrosSalvos } = useQuery({
    queryKey: ["parametros-pulverizacao"],
    queryFn: () => api.get<ParametroPulverizacao>("/parametros-pulverizacao"),
  });

  const opsPendentes = useLiveQuery(
    () =>
      db.atividadesPendentes
        .where("status")
        .anyOf(["pendente", "erro"])
        .filter((p) => p.criadoEm.slice(0, 10) === hoje)
        .toArray(),
    [hoje],
    [],
  );

  const colheitasPendentes = useLiveQuery(
    () =>
      db.colheitasPendentes
        .where("status")
        .anyOf(["pendente", "erro"])
        .filter((p) => p.criadoEm.slice(0, 10) === hoje)
        .toArray(),
    [hoje],
    [],
  );

  // O total do dia soma o que já subiu e o que ainda está no aparelho: para
  // quem está no talhão, caixa colhida é caixa colhida — a fila é detalhe
  // técnico e não pode fazer o número piscar para menos.
  const caixasHoje =
    (colheitasHoje?.reduce((s, c) => s + c.quantidadeCaixas, 0) ?? 0) +
    (colheitasPendentes?.reduce((s, c) => s + c.quantidadeCaixas, 0) ?? 0);

  const totalLancamentos =
    (colheitasHoje?.length ?? 0) +
    (atividadesHoje?.length ?? 0) +
    (colheitasPendentes?.length ?? 0) +
    (opsPendentes?.length ?? 0);

  return (
    <div className="escalonar space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <Link
          to="/campo/colheita"
          className="group flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-limao-400 to-limao-600 py-6 text-lg font-bold text-mata-900 shadow-cartao transition duration-200 ease-suave active:scale-[0.98] active:shadow-cartao"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mata-900/10 transition-transform duration-200 group-active:scale-90">
            <Plus size={20} strokeWidth={3} />
          </span>
          Registrar colheita
        </Link>
        <Link
          to="/campo/nova"
          className="group flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-mata-600 to-mata-800 py-6 text-lg font-bold text-white shadow-cartao transition duration-200 ease-suave active:scale-[0.98]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 group-active:scale-90">
            <Plus size={20} strokeWidth={3} />
          </span>
          Nova operação
        </Link>
        <Link
          to="/campo/pulverizacao"
          className="group flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-sky-500 to-sky-700 py-6 text-lg font-bold text-white shadow-cartao transition duration-200 ease-suave active:scale-[0.98]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 group-active:scale-90">
            <SprayCan size={20} strokeWidth={2.5} />
          </span>
          Pulverização
        </Link>
      </div>

      <Link
        to="/campo/calendario"
        className="flex items-center gap-3 rounded-2xl border border-terra-200 bg-white px-4 py-3 shadow-cartao transition active:scale-[0.99]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mata-50 text-mata-600">
          <CalendarClock size={18} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-terra-800">Tarefas programadas</span>
          <span className="block text-xs text-terra-500">O que a gestão pediu para fazer</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-terra-400" />
      </Link>

      {clima?.agora && <BlocoClimaCampo agora={clima.agora} parametros={parametrosSalvos ?? PARAMETROS_PADRAO} />}

      {caixasHoje > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-limao-200 bg-gradient-to-br from-limao-50 to-limao-100/60 px-4 py-4 text-center">
          <Citrus
            size={90}
            strokeWidth={1}
            className="pointer-events-none absolute -right-3 -top-4 text-limao-500/10"
            aria-hidden
          />
          <p className="relative rotulo text-limao-800">Colhido hoje</p>
          <p className="numero relative mt-1 text-4xl font-bold text-limao-900">
            {numero(caixasHoje, 0)}
            <span className="ml-1.5 text-lg font-semibold">caixas</span>
          </p>
        </div>
      )}

      {(!!opsPendentes?.length || !!colheitasPendentes?.length) && (
        <section>
          <Secao>Aguardando envio</Secao>
          <ul className="space-y-2">
            {colheitasPendentes?.map((p) => (
              <li key={p.clientId} className="cartao border-l-4 border-l-amber-400 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="flex items-center gap-1.5 font-semibold text-terra-800">
                    <Clock size={14} className="text-amber-500" />
                    Colheita
                  </p>
                  <p className="numero font-bold text-limao-700">{p.quantidadeCaixas} cx</p>
                </div>
                <p className="mt-0.5 text-sm text-terra-500">{p.talhaoNome}</p>
                {p.status === "erro" && (
                  <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">
                    <AlertCircle size={13} className="mt-px shrink-0" />
                    {p.erro}
                  </p>
                )}
              </li>
            ))}
            {opsPendentes?.map((p) => (
              <li key={p.clientId} className="cartao border-l-4 border-l-amber-400 p-3">
                <p className="flex items-center gap-1.5 font-semibold text-terra-800">
                  <Clock size={14} className="text-amber-500" />
                  {p.tipoAtividadeNome}
                </p>
                <p className="mt-0.5 text-sm text-terra-500">{p.descricaoTalhoes}</p>
                {p.status === "erro" && (
                  <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">
                    <AlertCircle size={13} className="mt-px shrink-0" />
                    {p.erro}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {totalLancamentos === 0 && !carregandoColheitas && !carregandoOps && (
        <div className="cartao px-5 py-9 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-terra-100 text-terra-400">
            <ClipboardList size={22} strokeWidth={1.75} />
          </div>
          <p className="font-semibold text-terra-700">Nada lançado hoje ainda</p>
          <p className="mt-1.5 text-sm leading-relaxed text-terra-500">
            Use os botões acima. Sem sinal também funciona — fica guardado e sobe sozinho quando a
            conexão voltar.
          </p>
        </div>
      )}

      {!!colheitasHoje?.length && (
        <section>
          <Secao>Colheitas de hoje</Secao>
          <ul className="space-y-2">
            {colheitasHoje.map((c) => (
              <li key={c.id} className="cartao p-3 transition duration-200 active:scale-[0.99]">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-terra-800">{c.talhao?.nome}</p>
                  <p className="numero text-lg font-bold text-limao-700">{c.quantidadeCaixas} cx</p>
                </div>
                <p className="mt-0.5 text-sm text-terra-500">
                  {c.executor?.nome ?? "sem executor"}
                  {c.valorPorCaixa != null && ` · R$ ${c.valorPorCaixa.toFixed(2)}/cx`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!atividadesHoje?.length && (
        <section>
          <Secao>Operações de hoje</Secao>
          <ul className="space-y-2">
            {atividadesHoje.map((a) => (
              <li key={a.id} className="cartao p-3 transition duration-200 active:scale-[0.99]">
                <p className="font-semibold text-terra-800">{a.tipoAtividade?.nome}</p>
                <p className="mt-0.5 text-sm text-terra-500">
                  {a.talhoes?.map((t) => t.talhao.nome).join(", ")}
                </p>
                {a.executor && <p className="text-xs text-terra-400">{a.executor.nome}</p>}
                {a.insumos.length > 0 && (
                  <p className="mt-1.5 text-xs text-terra-400">
                    {a.insumos.map((i) => `${i.insumo.nome} (${i.quantidade}${i.unidade})`).join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
