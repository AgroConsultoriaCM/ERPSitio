import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { GrupoTalhaoResumo, Talhao } from "../../lib/types";

export default function Grupos() {
  const qc = useQueryClient();
  const { data: grupos } = useQuery({
    queryKey: ["grupos"],
    queryFn: () => api.get<GrupoTalhaoResumo[]>("/grupos"),
  });
  const { data: talhoes } = useQuery({
    queryKey: ["talhoes"],
    queryFn: () => api.get<Talhao[]>("/talhoes"),
  });

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [talhaoIds, setTalhaoIds] = useState<string[]>([]);

  function limpar() {
    setEditandoId(null);
    setNome("");
    setObservacoes("");
    setTalhaoIds([]);
  }

  const salvar = useMutation({
    mutationFn: () => {
      const body = { nome, observacoes: observacoes || undefined, talhaoIds };
      return editandoId ? api.patch(`/grupos/${editandoId}`, body) : api.post("/grupos", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grupos"] });
      limpar();
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/grupos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grupos"] }),
  });

  const areaSelecionada =
    talhoes?.filter((t) => talhaoIds.includes(t.id)).reduce((s, t) => s + (t.areaHa ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Grupos de talhões</h1>
        <p className="text-sm text-gray-600">
          Atalhos para lançar operações em vários talhões de uma vez. No app de campo, o encarregado escolhe o grupo
          e o sistema resolve os talhões. Um talhão pode estar em vários grupos.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">{editandoId ? "Editar grupo" : "Novo grupo"}</p>
        <input
          placeholder="Nome do grupo (ex: Limão novo)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Observações (opcional)"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <p className="mb-2 text-sm font-medium text-gray-700">
          Talhões do grupo
          {talhaoIds.length > 0 && (
            <span className="ml-2 font-normal text-gray-600">
              {talhaoIds.length} selecionado{talhaoIds.length > 1 ? "s" : ""} ·{" "}
              {areaSelecionada.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha
            </span>
          )}
        </p>
        <div className="grid grid-cols-2 gap-1 md:grid-cols-3">
          {talhoes?.map((t) => (
            <label key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-green-50">
              <input
                type="checkbox"
                checked={talhaoIds.includes(t.id)}
                onChange={() =>
                  setTalhaoIds((a) => (a.includes(t.id) ? a.filter((x) => x !== t.id) : [...a, t.id]))
                }
              />
              <span className="text-sm">
                {t.codigo ? `${t.codigo} · ` : ""}
                {t.nome}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => salvar.mutate()}
            disabled={!nome || talhaoIds.length === 0 || salvar.isPending}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Salvar
          </button>
          {editandoId && (
            <button onClick={limpar} className="rounded-md border px-4 py-2 text-sm">
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-2">Grupo</th>
              <th className="px-4 py-2">Talhões</th>
              <th className="px-4 py-2">Área total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {grupos?.map((g) => (
              <tr key={g.id} className="border-t align-top">
                <td className="px-4 py-2 font-medium">{g.nome}</td>
                <td className="px-4 py-2 text-gray-600">
                  {g.talhoes.map((t) => t.nome).join(", ")}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {g.areaTotalHa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-right">
                  <button
                    onClick={() => {
                      setEditandoId(g.id);
                      setNome(g.nome);
                      setObservacoes(g.observacoes ?? "");
                      setTalhaoIds(g.talhoes.map((t) => t.id));
                    }}
                    className="mr-3 text-green-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir o grupo "${g.nome}"? As operações já lançadas não são afetadas.`)) {
                        remover.mutate(g.id);
                      }
                    }}
                    className="text-red-600"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {grupos?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">Nenhum grupo cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
