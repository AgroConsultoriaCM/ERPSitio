import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { Safra } from "../../../lib/types";

export default function AbaSafras({ talhaoId }: { talhaoId: string }) {
  const qc = useQueryClient();
  const { data: safras } = useQuery({
    queryKey: ["safras", talhaoId],
    queryFn: () => api.get<Safra[]>(`/safras?talhaoId=${talhaoId}`),
  });

  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const salvar = useMutation({
    mutationFn: () =>
      api.post("/safras", {
        talhaoId,
        nome,
        dataInicio,
        dataFim: dataFim || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["safras", talhaoId] });
      setNome("");
      setDataInicio("");
      setDataFim("");
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/safras/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["safras", talhaoId] }),
  });

  return (
    <div className="space-y-4">
      <div className="max-w-lg rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">Nova safra / ciclo</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Nome (ex: Safra 2026)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div>
            <label className="mb-1 block text-xs text-gray-600">Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Fim (opcional)</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={() => salvar.mutate()}
          disabled={!nome || !dataInicio || salvar.isPending}
          className="mt-3 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Salvar
        </button>
      </div>

      <ul className="space-y-2">
        {safras?.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
            <div>
              <p className="font-medium">{s.nome}</p>
              <p className="text-sm text-gray-600">
                {new Date(s.dataInicio).toLocaleDateString("pt-BR")}
                {s.dataFim ? ` – ${new Date(s.dataFim).toLocaleDateString("pt-BR")}` : ""}
              </p>
            </div>
            <button onClick={() => remover.mutate(s.id)} className="text-red-600">
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
