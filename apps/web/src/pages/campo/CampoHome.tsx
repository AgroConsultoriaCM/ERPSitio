import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { db } from "../../offline/db";
import { numero } from "../../components/ui";
import type { Atividade, Colheita } from "../../lib/types";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <Link
          to="/campo/colheita"
          className="flex items-center justify-center gap-2 rounded-2xl bg-limao-500 py-6 text-lg font-bold text-mata-900 shadow-cartao transition active:scale-[0.99] active:bg-limao-600"
        >
          <span className="text-2xl leading-none">+</span> Registrar colheita
        </Link>
        <Link
          to="/campo/nova"
          className="flex items-center justify-center gap-2 rounded-2xl bg-mata-600 py-6 text-lg font-bold text-white shadow-cartao transition active:scale-[0.99] active:bg-mata-700"
        >
          <span className="text-2xl leading-none">+</span> Nova operação
        </Link>
      </div>

      {caixasHoje > 0 && (
        <div className="rounded-2xl border border-limao-200 bg-limao-50 px-4 py-4 text-center">
          <p className="rotulo text-limao-800">Colhido hoje</p>
          <p className="numero mt-0.5 text-4xl font-bold text-limao-900">
            {numero(caixasHoje, 0)}
            <span className="ml-1.5 text-lg font-semibold">caixas</span>
          </p>
        </div>
      )}

      {(!!opsPendentes?.length || !!colheitasPendentes?.length) && (
        <section>
          <h2 className="mb-2 rotulo">Aguardando envio</h2>
          <ul className="space-y-2">
            {colheitasPendentes?.map((p) => (
              <li key={p.clientId} className="cartao p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-terra-800">Colheita</p>
                  <p className="numero font-bold text-limao-700">{p.quantidadeCaixas} cx</p>
                </div>
                <p className="text-sm text-terra-500">{p.talhaoNome}</p>
                {p.status === "erro" && (
                  <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{p.erro}</p>
                )}
              </li>
            ))}
            {opsPendentes?.map((p) => (
              <li key={p.clientId} className="cartao p-3">
                <p className="font-semibold text-terra-800">{p.tipoAtividadeNome}</p>
                <p className="text-sm text-terra-500">{p.descricaoTalhoes}</p>
                {p.status === "erro" && (
                  <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{p.erro}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {totalLancamentos === 0 && !carregandoColheitas && !carregandoOps && (
        <div className="cartao px-5 py-8 text-center">
          <p className="font-medium text-terra-700">Nada lançado hoje ainda</p>
          <p className="mt-1 text-sm text-terra-500">
            Use os botões acima. Sem sinal também funciona — fica guardado e sobe sozinho quando a
            conexão voltar.
          </p>
        </div>
      )}

      {!!colheitasHoje?.length && (
        <section>
          <h2 className="mb-2 rotulo">Colheitas de hoje</h2>
          <ul className="space-y-2">
            {colheitasHoje.map((c) => (
              <li key={c.id} className="cartao p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-terra-800">{c.talhao?.nome}</p>
                  <p className="numero text-lg font-bold text-limao-700">{c.quantidadeCaixas} cx</p>
                </div>
                <p className="text-sm text-terra-500">
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
          <h2 className="mb-2 rotulo">Operações de hoje</h2>
          <ul className="space-y-2">
            {atividadesHoje.map((a) => (
              <li key={a.id} className="cartao p-3">
                <p className="font-semibold text-terra-800">{a.tipoAtividade?.nome}</p>
                <p className="text-sm text-terra-500">
                  {a.talhoes?.map((t) => t.talhao.nome).join(", ")}
                </p>
                {a.executor && <p className="text-xs text-terra-400">{a.executor.nome}</p>}
                {a.insumos.length > 0 && (
                  <p className="mt-1 text-xs text-terra-400">
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
