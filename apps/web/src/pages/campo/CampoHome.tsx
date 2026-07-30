import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { db } from "../../offline/db";
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

  const caixasHoje =
    (colheitasHoje?.reduce((s, c) => s + c.quantidadeCaixas, 0) ?? 0) +
    (colheitasPendentes?.reduce((s, c) => s + c.quantidadeCaixas, 0) ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <Link
          to="/campo/colheita"
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-5 text-lg font-semibold text-white shadow active:bg-amber-700"
        >
          + Registrar colheita
        </Link>
        <Link
          to="/campo/nova"
          className="flex items-center justify-center gap-2 rounded-xl bg-green-700 py-5 text-lg font-semibold text-white shadow active:bg-green-800"
        >
          + Nova operação
        </Link>
      </div>

      {caixasHoje > 0 && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-center">
          <p className="text-sm text-amber-800">Colhido hoje</p>
          <p className="text-3xl font-bold text-amber-900">
            {caixasHoje.toLocaleString("pt-BR")} <span className="text-lg font-medium">caixas</span>
          </p>
        </div>
      )}

      {(!!opsPendentes?.length || !!colheitasPendentes?.length) && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-500">Aguardando sincronização</h2>
          <ul className="space-y-2">
            {colheitasPendentes?.map((p) => (
              <li key={p.clientId} className="rounded-lg bg-white p-3 shadow-sm">
                <p className="font-medium">Colheita · {p.quantidadeCaixas} cx</p>
                <p className="text-sm text-gray-500">{p.talhaoNome}</p>
                {p.status === "erro" && <p className="mt-1 text-xs text-red-600">{p.erro}</p>}
              </li>
            ))}
            {opsPendentes?.map((p) => (
              <li key={p.clientId} className="rounded-lg bg-white p-3 shadow-sm">
                <p className="font-medium">{p.tipoAtividadeNome}</p>
                <p className="text-sm text-gray-500">{p.descricaoTalhoes}</p>
                {p.status === "erro" && <p className="mt-1 text-xs text-red-600">{p.erro}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Colheitas de hoje</h2>
        {carregandoColheitas && <p className="text-sm text-gray-400">Carregando...</p>}
        {!carregandoColheitas && !colheitasHoje?.length && (
          <p className="text-sm text-gray-400">Nenhuma colheita lançada hoje.</p>
        )}
        <ul className="space-y-2">
          {colheitasHoje?.map((c) => (
            <li key={c.id} className="rounded-lg bg-white p-3 shadow-sm">
              <div className="flex items-baseline justify-between">
                <p className="font-medium">{c.talhao?.nome}</p>
                <p className="text-lg font-bold text-amber-700">{c.quantidadeCaixas} cx</p>
              </div>
              <p className="text-sm text-gray-500">
                {c.executor?.nome ?? "sem executor"}
                {c.valorPorCaixa != null && ` · R$ ${c.valorPorCaixa.toFixed(2)}/cx`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Operações de hoje</h2>
        {carregandoOps && <p className="text-sm text-gray-400">Carregando...</p>}
        {!carregandoOps && !atividadesHoje?.length && (
          <p className="text-sm text-gray-400">Nenhuma operação lançada hoje.</p>
        )}
        <ul className="space-y-2">
          {atividadesHoje?.map((a) => (
            <li key={a.id} className="rounded-lg bg-white p-3 shadow-sm">
              <p className="font-medium">{a.tipoAtividade?.nome}</p>
              <p className="text-sm text-gray-500">
                {a.talhoes?.map((t) => t.talhao.nome).join(", ")}
              </p>
              {a.executor && <p className="text-xs text-gray-400">{a.executor.nome}</p>}
              {a.insumos.length > 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  {a.insumos.map((i) => `${i.insumo.nome} (${i.quantidade}${i.unidade})`).join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
