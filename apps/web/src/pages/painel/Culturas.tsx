import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Cultura } from "../../lib/types";

export default function Culturas() {
  const qc = useQueryClient();
  const { data: culturas } = useQuery({ queryKey: ["culturas"], queryFn: () => api.get<Cultura[]>("/culturas") });

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [variedade, setVariedade] = useState("");

  const salvar = useMutation({
    mutationFn: () =>
      editandoId
        ? api.patch(`/culturas/${editandoId}`, { nome, variedade })
        : api.post("/culturas", { nome, variedade }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["culturas"] });
      setNome("");
      setVariedade("");
      setEditandoId(null);
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/culturas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["culturas"] }),
  });

  function editar(c: Cultura) {
    setEditandoId(c.id);
    setNome(c.nome);
    setVariedade(c.variedade ?? "");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Culturas</h1>

      <div className="max-w-md rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">{editandoId ? "Editar cultura" : "Nova cultura"}</p>
        <div className="space-y-2">
          <input
            placeholder="Nome (ex: Manga)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Variedade (ex: Palmer)"
            value={variedade}
            onChange={(e) => setVariedade(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => salvar.mutate()}
              disabled={!nome || salvar.isPending}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Salvar
            </button>
            {editandoId && (
              <button
                onClick={() => {
                  setEditandoId(null);
                  setNome("");
                  setVariedade("");
                }}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Variedade</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {culturas?.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2">{c.nome}</td>
                <td className="px-4 py-2">{c.variedade ?? "-"}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => editar(c)} className="mr-3 text-green-700">
                    Editar
                  </button>
                  <button onClick={() => remover.mutate(c.id)} className="text-red-600">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
