import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Calda, Insumo } from "../../lib/types";

interface LinhaItem {
  insumoId: string;
  dosePor100L: string;
}

export default function Caldas() {
  const qc = useQueryClient();
  const { data: caldas } = useQuery({ queryKey: ["caldas"], queryFn: () => api.get<Calda[]>("/caldas") });
  const { data: insumos } = useQuery({ queryKey: ["insumos"], queryFn: () => api.get<Insumo[]>("/insumos") });

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<LinhaItem[]>([{ insumoId: "", dosePor100L: "" }]);

  function limpar() {
    setEditandoId(null);
    setNome("");
    setObservacoes("");
    setItens([{ insumoId: "", dosePor100L: "" }]);
  }

  function editar(c: Calda) {
    setEditandoId(c.id);
    setNome(c.nome);
    setObservacoes(c.observacoes ?? "");
    setItens(c.itens.map((i) => ({ insumoId: i.insumoId, dosePor100L: String(i.dosePor100L) })));
  }

  const itensValidos = itens.filter((i) => i.insumoId && i.dosePor100L);

  const salvar = useMutation({
    mutationFn: () => {
      const body = {
        nome,
        observacoes: observacoes || undefined,
        itens: itensValidos.map((i) => ({ insumoId: i.insumoId, dosePor100L: Number(i.dosePor100L) })),
      };
      return editandoId ? api.patch(`/caldas/${editandoId}`, body) : api.post("/caldas", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caldas"] });
      limpar();
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/caldas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caldas"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Caldas</h1>
        <p className="text-sm text-gray-600">
          Receitas de calda: produto e dose por 100L. Usadas ao lançar uma pulverização, ou o operador monta
          uma na hora.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold text-gray-800">{editandoId ? "Editar calda" : "Nova calda"}</p>
        <input
          placeholder="Nome da calda"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-gray-600">Produtos</p>
        <div className="space-y-2">
          {itens.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <select
                value={item.insumoId}
                onChange={(e) =>
                  setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, insumoId: e.target.value } : it)))
                }
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Produto...</option>
                {insumos?.map((ins) => (
                  <option key={ins.id} value={ins.id}>
                    {ins.nome}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="any"
                placeholder="dose/100L"
                value={item.dosePor100L}
                onChange={(e) =>
                  setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, dosePor100L: e.target.value } : it)))
                }
                className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              {itens.length > 1 && (
                <button
                  onClick={() => setItens((arr) => arr.filter((_, i) => i !== idx))}
                  className="text-red-600"
                  title="Remover"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => setItens((arr) => [...arr, { insumoId: "", dosePor100L: "" }])}
          className="mt-2 text-sm text-green-700"
        >
          + adicionar produto
        </button>

        <textarea
          placeholder="Observações"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => salvar.mutate()}
            disabled={!nome || itensValidos.length === 0 || salvar.isPending}
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
              <th className="px-4 py-2">Produtos</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {caldas?.map((c) => (
              <tr key={c.id} className="border-t align-top">
                <td className="px-4 py-2">{c.nome}</td>
                <td className="px-4 py-2 text-gray-700">
                  {c.itens.map((i) => `${i.insumo?.nome ?? "?"} (${i.dosePor100L}/100L)`).join(", ")}
                </td>
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
