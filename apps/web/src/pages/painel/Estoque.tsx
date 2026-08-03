import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { ROTULO_FUNCAO_INSUMO } from "../../lib/types";
import type { Insumo, LoteInsumo, MovimentacaoEstoque, OrigemLote } from "../../lib/types";

const moeda = (v: number | null | undefined) =>
  v == null ? "-" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const num = (v: number | null | undefined, casas = 3) =>
  v == null ? "-" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

type Aba = "lotes" | "movimentacoes";

export default function Estoque() {
  const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>("lotes");
  const [erro, setErro] = useState<string | null>(null);

  const { data: insumos } = useQuery({ queryKey: ["insumos"], queryFn: () => api.get<Insumo[]>("/insumos") });
  const { data: lotes } = useQuery({ queryKey: ["lotes"], queryFn: () => api.get<LoteInsumo[]>("/lotes") });
  const { data: movimentacoes } = useQuery({
    queryKey: ["movimentacoes"],
    queryFn: () => api.get<MovimentacaoEstoque[]>("/estoque/movimentacoes"),
  });

  const [insumoId, setInsumoId] = useState("");
  const [origem, setOrigem] = useState<OrigemLote>("COMPRA");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [quantidade, setQuantidade] = useState("");
  const [precoUnitario, setPrecoUnitario] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [numeroNota, setNumeroNota] = useState("");

  const registrar = useMutation({
    mutationFn: () =>
      api.post("/lotes", {
        insumoId,
        origem,
        data: new Date(`${data}T12:00:00`).toISOString(),
        quantidade: Number(quantidade),
        precoUnitario: Number(precoUnitario),
        fornecedor: fornecedor || undefined,
        numeroNota: numeroNota || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lotes"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["insumos"] });
      setInsumoId("");
      setQuantidade("");
      setPrecoUnitario("");
      setNumeroNota("");
      setErro(null);
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Erro ao registrar entrada"),
  });

  const excluirLote = useMutation({
    mutationFn: (id: string) => api.delete(`/lotes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lotes"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["insumos"] });
      setErro(null);
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Erro ao excluir"),
  });

  const valorEmEstoque =
    lotes?.reduce((s, l) => s + l.quantidadeRestante * l.precoUnitario, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Estoque</h1>
        <p className="text-sm text-gray-600">
          Cada entrada vira um lote com o preço pago. Quando um produto é usado numa operação, o sistema baixa do
          lote mais antigo (ou do que você escolher) e leva o custo real para o talhão.
        </p>
      </div>

      {erro && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Valor em estoque</p>
          <p className="mt-1 text-2xl font-bold text-green-800">{moeda(valorEmEstoque)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Lotes com saldo</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {lotes?.filter((l) => l.quantidadeRestante > 0).length ?? 0}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Produtos cadastrados</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{insumos?.length ?? 0}</p>
        </div>
      </div>

      <div className="max-w-4xl rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">Entrada no estoque</p>
        <div className="grid grid-cols-6 gap-2">
          <select
            value={origem}
            onChange={(e) => setOrigem(e.target.value as OrigemLote)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="COMPRA">Compra</option>
            <option value="INVENTARIO_INICIAL">Inventário inicial</option>
            <option value="AJUSTE">Ajuste</option>
          </select>
          <select
            value={insumoId}
            onChange={(e) => setInsumoId(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Produto...</option>
            {insumos?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome} ({i.unidadeMedida})
              </option>
            ))}
          </select>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="any"
            placeholder="Quantidade"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Preço unitário R$"
            value={precoUnitario}
            onChange={(e) => setPrecoUnitario(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Fornecedor"
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Nº da nota"
            value={numeroNota}
            onChange={(e) => setNumeroNota(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="col-span-4 flex items-center gap-3">
            <button
              onClick={() => registrar.mutate()}
              disabled={!insumoId || !quantidade || !precoUnitario || registrar.isPending}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Registrar entrada
            </button>
            {quantidade && precoUnitario && (
              <span className="text-sm text-gray-600">
                Total: {moeda(Number(quantidade) * Number(precoUnitario))}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            ["lotes", "Lotes / compras"],
            ["movimentacoes", "Movimentações"],
          ] as [Aba, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setAba(v)}
            className={`px-4 py-2 text-sm font-medium ${
              aba === v ? "border-b-2 border-green-700 text-green-800" : "text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === "lotes" && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Produto</th>
                <th className="px-3 py-2">Função</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Comprado</th>
                <th className="px-3 py-2">Saldo</th>
                <th className="px-3 py-2">R$/un</th>
                <th className="px-3 py-2">Valor do saldo</th>
                <th className="px-3 py-2">Fornecedor / NF</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lotes?.map((l) => {
                const insumo = insumos?.find((i) => i.id === l.insumoId);
                const esgotado = l.quantidadeRestante <= 0;
                return (
                  <tr key={l.id} className={`border-t ${esgotado ? "text-gray-500" : ""}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(l.data).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">{l.insumo?.nome ?? insumo?.nome}</td>
                    <td className="px-3 py-2 text-xs">
                      {insumo?.funcoes?.length
                        ? insumo.funcoes.map((f) => ROTULO_FUNCAO_INSUMO[f]).join(", ")
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {l.origem === "INVENTARIO_INICIAL" ? "Inventário" : l.origem === "AJUSTE" ? "Ajuste" : "Compra"}
                    </td>
                    <td className="px-3 py-2">{num(l.quantidade)}</td>
                    <td className={`px-3 py-2 font-medium ${esgotado ? "" : "text-green-700"}`}>
                      {num(l.quantidadeRestante)}
                    </td>
                    <td className="px-3 py-2">{moeda(l.precoUnitario)}</td>
                    <td className="px-3 py-2">{moeda(l.quantidadeRestante * l.precoUnitario)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {[l.fornecedor, l.numeroNota].filter(Boolean).join(" · ") || "-"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => {
                          if (confirm("Excluir este lote?")) excluirLote.mutate(l.id);
                        }}
                        className="text-red-600"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lotes?.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Nenhuma entrada registrada. Comece pelo inventário inicial do que você já tem em estoque.
            </p>
          )}
        </div>
      )}

      {aba === "movimentacoes" && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Produto</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Quantidade</th>
                <th className="px-3 py-2">Custo</th>
                <th className="px-3 py-2">Observações</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes?.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(m.data).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2">{m.insumo.nome}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        m.tipo === "ENTRADA" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {m.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{m.origem}</td>
                  <td className="px-3 py-2">
                    {num(m.quantidade)} {m.insumo.unidadeMedida}
                  </td>
                  <td className="px-3 py-2">{moeda(m.custoTotal)}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{m.observacoes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movimentacoes?.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Nenhuma movimentação ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}
