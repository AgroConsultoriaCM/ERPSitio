import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Colheita, Executor, ResumoColheitaTalhao, Talhao } from "../../lib/types";

const moeda = (v: number | null | undefined) =>
  v == null ? "-" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const num = (v: number | null | undefined, casas = 2) =>
  v == null ? "-" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

export default function Colheitas() {
  const qc = useQueryClient();
  const [somentePendentes, setSomentePendentes] = useState(false);

  const { data: colheitas } = useQuery({
    queryKey: ["colheitas", somentePendentes],
    queryFn: () =>
      api.get<Colheita[]>(`/colheitas${somentePendentes ? "?pendentesComercial=true" : ""}`),
  });
  const { data: resumo } = useQuery({
    queryKey: ["colheitas-resumo"],
    queryFn: () => api.get<ResumoColheitaTalhao[]>("/colheitas/resumo"),
  });
  const { data: talhoes } = useQuery({ queryKey: ["talhoes"], queryFn: () => api.get<Talhao[]>("/talhoes") });
  const { data: executores } = useQuery({
    queryKey: ["executores"],
    queryFn: () => api.get<Executor[]>("/executores"),
  });

  // lançamento manual (retroativo) pelo painel
  const [talhaoId, setTalhaoId] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [caixas, setCaixas] = useState("");
  const [executorId, setExecutorId] = useState("");
  const [valorPorCaixa, setValorPorCaixa] = useState("");

  // edição do complemento comercial
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [pesoTotalKg, setPesoTotalKg] = useState("");
  const [pesoRefugoKg, setPesoRefugoKg] = useState("");
  const [precoCaixaBom, setPrecoCaixaBom] = useState("");
  const [precoCaixaRefugo, setPrecoCaixaRefugo] = useState("");

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["colheitas"] });
    qc.invalidateQueries({ queryKey: ["colheitas-resumo"] });
  }

  const criar = useMutation({
    mutationFn: () =>
      api.post("/colheitas", {
        talhaoId,
        data: new Date(`${data}T12:00:00`).toISOString(),
        quantidadeCaixas: Number(caixas),
        executorId: executorId || undefined,
        valorPorCaixa: valorPorCaixa ? Number(valorPorCaixa) : undefined,
        origem: "WEB",
      }),
    onSuccess: () => {
      invalidar();
      setTalhaoId("");
      setCaixas("");
      setValorPorCaixa("");
    },
  });

  const salvarComercial = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/colheitas/${id}`, {
        pesoTotalKg: pesoTotalKg ? Number(pesoTotalKg) : null,
        pesoRefugoKg: pesoRefugoKg ? Number(pesoRefugoKg) : null,
        precoCaixaBom: precoCaixaBom ? Number(precoCaixaBom) : null,
        precoCaixaRefugo: precoCaixaRefugo ? Number(precoCaixaRefugo) : null,
      }),
    onSuccess: () => {
      invalidar();
      setEditandoId(null);
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/colheitas/${id}`),
    onSuccess: invalidar,
  });

  const totais = colheitas?.reduce(
    (acc, c) => ({
      caixas: acc.caixas + c.quantidadeCaixas,
      custo: acc.custo + (c.custoColheita ?? 0),
      vendaBom: acc.vendaBom + (c.valorVendaBom ?? 0),
      vendaRefugo: acc.vendaRefugo + (c.valorVendaRefugo ?? 0),
      receita: acc.receita + (c.valorVendaTotal ?? 0),
    }),
    { caixas: 0, custo: 0, vendaBom: 0, vendaRefugo: 0, receita: 0 },
  );

  // A unidade do preço varia por linha, porque depende da cultura do talhão:
  // limão vai por caixa de 27,2 kg, abacate vai por quilo. Quem decide é o
  // cadastro da cultura — aqui só se traduz para o rótulo.
  const unidadePreco = (c: Colheita) =>
    c.pesoCaixaKg != null ? `R$/cx de ${c.pesoCaixaKg.toLocaleString("pt-BR")} kg` : "R$/kg";

  /**
   * Memória de cálculo da linha, em uma frase.
   *
   * Mostrar só "R$ 1,50/cx" escondia a divisão por 27,2 e fazia um resultado
   * legítimo parecer erro. Aqui aparece o preço lançado, o preço do quilo que
   * saiu dele e os quilos que entraram na conta.
   */
  const memoriaCalculo = (
    c: Colheita,
    preco: number | null | undefined,
    precoKg: number | null | undefined,
    kg: number | null | undefined,
  ) => {
    if (preco == null) return null;
    const kgTexto = `${num(kg)} kg`;
    if (c.pesoCaixaKg == null) return `${moeda(preco)}/kg × ${kgTexto}`;
    return `${moeda(preco)}/cx ÷ ${c.pesoCaixaKg.toLocaleString("pt-BR")} = ${moeda(
      precoKg ?? 0,
    )}/kg × ${kgTexto}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Colheitas</h1>
        <p className="text-sm text-gray-500">
          O encarregado lança as caixas no campo. Aqui você complementa com o peso colhido, o refugo e o preço
          pago, separado entre fruta boa e refugo. <strong>A unidade do preço vem da cultura do talhão</strong>:
          limão vai por caixa de 27,2 kg, abacate vai por quilo — cada linha mostra qual usar. O sistema
          multiplica pelo peso de cada qualidade e calcula receita, kg/caixa e margem. A receita não é digitada.
        </p>
      </div>

      {!!resumo?.length && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <p className="border-b bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
            Acumulado por talhão
          </p>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-500">
              <tr>
                <th className="px-4 py-2">Talhão</th>
                <th className="px-4 py-2">Caixas</th>
                <th className="px-4 py-2">Cx/ha</th>
                <th className="px-4 py-2">kg/cx</th>
                <th className="px-4 py-2">Custo colheita</th>
                <th className="px-4 py-2">Receita</th>
                <th className="px-4 py-2">Margem</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((r) => (
                <tr key={r.talhaoId} className="border-t">
                  <td className="px-4 py-2">
                    {r.codigo ? `${r.codigo} · ` : ""}
                    {r.nome}
                  </td>
                  <td className="px-4 py-2">{num(r.caixas)}</td>
                  <td className="px-4 py-2">{num(r.caixasPorHectare)}</td>
                  <td className="px-4 py-2">{num(r.kgPorCaixa, 3)}</td>
                  <td className="px-4 py-2">{moeda(r.custoColheita)}</td>
                  <td className="px-4 py-2">{moeda(r.receita)}</td>
                  <td className={`px-4 py-2 font-medium ${r.margem >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {moeda(r.margem)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="max-w-3xl rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">Lançar colheita (retroativa)</p>
        <div className="grid grid-cols-5 gap-2">
          <select
            value={talhaoId}
            onChange={(e) => setTalhaoId(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Talhão...</option>
            {talhoes?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo ? `${t.codigo} · ` : ""}
                {t.nome}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Caixas"
            value={caixas}
            onChange={(e) => setCaixas(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="R$/caixa"
            value={valorPorCaixa}
            onChange={(e) => setValorPorCaixa(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={executorId}
            onChange={(e) => setExecutorId(e.target.value)}
            className="col-span-4 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Quem colheu...</option>
            {executores?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
          <button
            onClick={() => criar.mutate()}
            disabled={!talhaoId || !caixas || criar.isPending}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Lançar
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={somentePendentes}
          onChange={(e) => setSomentePendentes(e.target.checked)}
        />
        Mostrar só as colheitas sem dados de venda
      </label>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-500">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Talhão</th>
              <th className="px-3 py-2">Caixas</th>
              <th className="px-3 py-2">Quem colheu</th>
              <th className="px-3 py-2">R$/cx</th>
              <th className="px-3 py-2">Custo</th>
              <th className="px-3 py-2">Peso (kg)</th>
              <th className="px-3 py-2">Refugo</th>
              <th className="px-3 py-2">kg/cx</th>
              <th className="px-3 py-2">
                Venda · bom
                <span className="block text-[10px] font-normal normal-case text-gray-400">
                  preço conforme a cultura
                </span>
              </th>
              <th className="px-3 py-2">
                Venda · refugo
                <span className="block text-[10px] font-normal normal-case text-gray-400">
                  preço conforme a cultura
                </span>
              </th>
              <th className="px-3 py-2">Margem</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {colheitas?.map((c) => {
              const editando = editandoId === c.id;
              return (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(c.data).toLocaleDateString("pt-BR")}
                  </td>
                  {/* A cultura fica visível porque é ela que decide a unidade
                      do preço nesta linha. Sem isso, um resultado 27x menor
                      parecia erro de conta, quando era cadastro faltando. */}
                  <td className="px-3 py-2">
                    {c.talhao?.nome}
                    {c.talhao?.cultura ? (
                      <span className="block text-xs text-gray-400">{c.talhao.cultura.nome}</span>
                    ) : (
                      <span
                        className="block text-xs font-medium text-amber-600"
                        title="Sem cultura, o sistema usa caixa de 27,2 kg. Defina a cultura em Cadastros → Talhões."
                      >
                        sem cultura
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{num(c.quantidadeCaixas)}</td>
                  <td className="px-3 py-2">{c.executor?.nome ?? "-"}</td>
                  <td className="px-3 py-2">{moeda(c.valorPorCaixa)}</td>
                  <td className="px-3 py-2">{moeda(c.custoColheita)}</td>
                  <td className="px-3 py-2">
                    {editando ? (
                      <input
                        type="number"
                        step="0.1"
                        value={pesoTotalKg}
                        onChange={(e) => setPesoTotalKg(e.target.value)}
                        className="w-24 rounded border border-gray-300 px-2 py-1"
                      />
                    ) : (
                      num(c.pesoTotalKg)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editando ? (
                      <input
                        type="number"
                        step="0.1"
                        value={pesoRefugoKg}
                        onChange={(e) => setPesoRefugoKg(e.target.value)}
                        className="w-24 rounded border border-gray-300 px-2 py-1"
                      />
                    ) : (
                      <>
                        {num(c.pesoRefugoKg)}
                        {c.percentualRefugo != null && (
                          <span className="ml-1 text-xs text-gray-400">({c.percentualRefugo}%)</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-700">{num(c.kgPorCaixa, 3)}</td>

                  {/* Digita-se o preço da caixa; embaixo aparece o que isso deu
                      em dinheiro, para conferir a conta sem sair da tela. */}
                  <td className="px-3 py-2">
                    {editando ? (
                      <>
                        <input
                          type="number"
                          step="0.01"
                          value={precoCaixaBom}
                          onChange={(e) => setPrecoCaixaBom(e.target.value)}
                          className="w-28 rounded border border-gray-300 px-2 py-1"
                        />
                        <span className="block text-[10px] text-gray-400">{unidadePreco(c)}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-gray-800">{moeda(c.valorVendaBom)}</span>
                        <span className="block text-xs text-gray-400">
                          {memoriaCalculo(c, c.precoCaixaBom, c.precoKgBom, c.pesoLiquidoKg)}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editando ? (
                      <>
                        <input
                          type="number"
                          step="0.01"
                          value={precoCaixaRefugo}
                          onChange={(e) => setPrecoCaixaRefugo(e.target.value)}
                          className="w-28 rounded border border-gray-300 px-2 py-1"
                        />
                        <span className="block text-[10px] text-gray-400">{unidadePreco(c)}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-gray-800">
                          {moeda(c.valorVendaRefugo)}
                        </span>
                        <span className="block text-xs text-gray-400">
                          {memoriaCalculo(c, c.precoCaixaRefugo, c.precoKgRefugo, c.pesoRefugoKg)}
                        </span>
                      </>
                    )}
                  </td>
                  <td
                    className={`px-3 py-2 font-medium ${
                      c.margem == null ? "" : c.margem >= 0 ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {moeda(c.margem)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    {editando ? (
                      <>
                        <button
                          onClick={() => salvarComercial.mutate(c.id)}
                          className="mr-2 text-green-700"
                        >
                          Salvar
                        </button>
                        <button onClick={() => setEditandoId(null)} className="text-gray-500">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditandoId(c.id);
                            setPesoTotalKg(c.pesoTotalKg?.toString() ?? "");
                            setPesoRefugoKg(c.pesoRefugoKg?.toString() ?? "");
                            setPrecoCaixaBom(c.precoCaixaBom?.toString() ?? "");
                            setPrecoCaixaRefugo(c.precoCaixaRefugo?.toString() ?? "");
                          }}
                          className="mr-2 text-green-700"
                        >
                          Venda
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Excluir este lançamento de colheita?")) remover.mutate(c.id);
                          }}
                          className="text-red-600"
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {!!totais && !!colheitas?.length && (
            <tfoot>
              <tr className="border-t bg-gray-50 font-medium">
                <td className="px-3 py-2" colSpan={2}>
                  Total ({colheitas.length} lançamentos)
                </td>
                <td className="px-3 py-2">{num(totais.caixas)}</td>
                <td className="px-3 py-2" colSpan={2} />
                <td className="px-3 py-2">{moeda(totais.custo)}</td>
                <td className="px-3 py-2" colSpan={3} />
                <td className="px-3 py-2">{moeda(totais.vendaBom)}</td>
                <td className="px-3 py-2">{moeda(totais.vendaRefugo)}</td>
                <td className="px-3 py-2">{moeda(totais.receita - totais.custo)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {colheitas?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma colheita lançada ainda.</p>
        )}
      </div>
    </div>
  );
}
