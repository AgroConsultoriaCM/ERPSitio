import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { PerfilBomba } from "../../lib/types";

export default function PerfisBomba() {
  const qc = useQueryClient();
  const { data: bombas } = useQuery({
    queryKey: ["perfis-bomba"],
    queryFn: () => api.get<PerfilBomba[]>("/perfis-bomba"),
  });

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [capacidade, setCapacidade] = useState("");

  function limpar() {
    setEditandoId(null);
    setNome("");
    setCapacidade("");
  }

  function editar(b: PerfilBomba) {
    setEditandoId(b.id);
    setNome(b.nome);
    setCapacidade(String(b.capacidadeLitros));
  }

  const salvar = useMutation({
    mutationFn: () => {
      const body = { nome, capacidadeLitros: Number(capacidade) };
      return editandoId ? api.patch(`/perfis-bomba/${editandoId}`, body) : api.post("/perfis-bomba", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perfis-bomba"] });
      limpar();
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/perfis-bomba/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perfis-bomba"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Bombas de pulverização</h1>
        <p className="text-sm text-gray-600">
          Capacidade de cada bomba, usada para calcular o volume total pulverizado (cargas × capacidade).
        </p>
      </div>

      <div className="max-w-md rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold text-gray-800">{editandoId ? "Editar bomba" : "Nova bomba"}</p>
        <div className="space-y-2">
          <input
            placeholder="Nome (ex: Bomba 4000L)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="any"
            placeholder="Capacidade em litros"
            value={capacidade}
            onChange={(e) => setCapacidade(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => salvar.mutate()}
            disabled={!nome || !capacidade || salvar.isPending}
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
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Capacidade</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {bombas?.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-4 py-2">{b.nome}</td>
                <td className="px-4 py-2">{b.capacidadeLitros} L</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => editar(b)} className="mr-3 text-green-700">
                    Editar
                  </button>
                  <button onClick={() => remover.mutate(b.id)} className="text-red-600">
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
