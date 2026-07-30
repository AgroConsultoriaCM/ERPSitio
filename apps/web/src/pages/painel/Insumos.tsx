import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { ROTULO_FUNCAO_INSUMO } from "../../lib/types";
import type { FuncaoInsumo, Insumo } from "../../lib/types";

const categorias = ["DEFENSIVO", "FERTILIZANTE", "EMBALAGEM", "OUTRO"] as const;
const funcoes = Object.keys(ROTULO_FUNCAO_INSUMO) as FuncaoInsumo[];

export default function Insumos() {
  const qc = useQueryClient();
  const { data: insumos } = useQuery({ queryKey: ["insumos"], queryFn: () => api.get<Insumo[]>("/insumos") });

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<(typeof categorias)[number]>("OUTRO");
  const [funcao, setFuncao] = useState<FuncaoInsumo | "">("");
  const [unidadeMedida, setUnidadeMedida] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");

  const salvar = useMutation({
    mutationFn: () => {
      const body = {
        nome,
        categoria,
        funcao: funcao || null,
        unidadeMedida,
        estoqueMinimo: estoqueMinimo ? Number(estoqueMinimo) : null,
      };
      return editandoId ? api.patch(`/insumos/${editandoId}`, body) : api.post("/insumos", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insumos"] });
      limpar();
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/insumos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insumos"] }),
  });

  function limpar() {
    setEditandoId(null);
    setNome("");
    setCategoria("OUTRO");
    setFuncao("");
    setUnidadeMedida("");
    setEstoqueMinimo("");
  }

  function editar(i: Insumo) {
    setEditandoId(i.id);
    setNome(i.nome);
    setCategoria(i.categoria);
    setFuncao(i.funcao ?? "");
    setUnidadeMedida(i.unidadeMedida);
    setEstoqueMinimo(i.estoqueMinimo?.toString() ?? "");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Insumos</h1>

      <div className="max-w-lg rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">{editandoId ? "Editar insumo" : "Novo insumo"}</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as typeof categoria)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            placeholder="Unidade (kg, L, un...)"
            value={unidadeMedida}
            onChange={(e) => setUnidadeMedida(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="col-span-2">
            <select
              value={funcao}
              onChange={(e) => setFuncao(e.target.value as FuncaoInsumo | "")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Função agronômica (opcional)...</option>
              {funcoes.map((f) => (
                <option key={f} value={f}>
                  {ROTULO_FUNCAO_INSUMO[f]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Usada no controle de pragas para saber quando cada talhão recebeu inseticida, herbicida etc.
            </p>
          </div>
          <input
            placeholder="Estoque mínimo (opcional)"
            type="number"
            value={estoqueMinimo}
            onChange={(e) => setEstoqueMinimo(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => salvar.mutate()}
            disabled={!nome || !unidadeMedida || salvar.isPending}
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
          <thead className="bg-gray-100 text-gray-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Categoria</th>
              <th className="px-4 py-2">Função</th>
              <th className="px-4 py-2">Saldo atual</th>
              <th className="px-4 py-2">Mínimo</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {insumos?.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="px-4 py-2">{i.nome}</td>
                <td className="px-4 py-2">{i.categoria}</td>
                <td className="px-4 py-2">
                  {i.funcao ? (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800">
                      {ROTULO_FUNCAO_INSUMO[i.funcao]}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">definir</span>
                  )}
                </td>
                <td className={`px-4 py-2 ${i.estoqueMinimo != null && (i.saldoAtual ?? 0) < i.estoqueMinimo ? "font-semibold text-red-600" : ""}`}>
                  {i.saldoAtual} {i.unidadeMedida}
                </td>
                <td className="px-4 py-2">{i.estoqueMinimo ?? "-"}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => editar(i)} className="mr-3 text-green-700">
                    Editar
                  </button>
                  <button onClick={() => remover.mutate(i.id)} className="text-red-600">
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
