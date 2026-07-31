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
  const [pesoCaixaKg, setPesoCaixaKg] = useState("");

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        nome,
        variedade,
        // Campo vazio significa "vendido por quilo", não "não informado" —
        // por isso vai null explícito, e não undefined.
        pesoCaixaKg: pesoCaixaKg.trim() ? Number(pesoCaixaKg) : null,
      };
      return editandoId
        ? api.patch(`/culturas/${editandoId}`, corpo)
        : api.post("/culturas", corpo);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["culturas"] });
      // A tela de colheitas depende da unidade da cultura para rotular o preço
      qc.invalidateQueries({ queryKey: ["colheitas"] });
      qc.invalidateQueries({ queryKey: ["colheitas-resumo"] });
      setNome("");
      setVariedade("");
      setPesoCaixaKg("");
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
    setPesoCaixaKg(c.pesoCaixaKg?.toString() ?? "");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Culturas</h1>
        <p className="text-sm text-gray-500">
          O peso da caixa define em que unidade o preço da colheita é lançado. Limão taiti é vendido
          por caixa de 27,2 kg; abacate, por quilo — nesse caso, deixe o campo vazio.
        </p>
      </div>

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
          <div>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="Peso da caixa em kg (ex: 27,2) — vazio = vende por quilo"
              value={pesoCaixaKg}
              onChange={(e) => setPesoCaixaKg(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              {pesoCaixaKg.trim()
                ? `O preço da colheita será lançado por caixa de ${pesoCaixaKg} kg.`
                : "O preço da colheita será lançado por quilo."}
            </p>
          </div>
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
                  setPesoCaixaKg("");
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
              <th className="px-4 py-2">Preço da colheita</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {culturas?.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2">{c.nome}</td>
                <td className="px-4 py-2">{c.variedade ?? "-"}</td>
                <td className="px-4 py-2">
                  {c.pesoCaixaKg != null ? (
                    <>
                      por caixa
                      <span className="ml-1 text-xs text-gray-400">
                        ({c.pesoCaixaKg.toLocaleString("pt-BR")} kg)
                      </span>
                    </>
                  ) : (
                    "por quilo"
                  )}
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
