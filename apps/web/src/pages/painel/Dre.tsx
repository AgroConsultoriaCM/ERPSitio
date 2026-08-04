import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Plus, Receipt, Scale, TrendingDown, TrendingUp, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Cartao, TituloSecao, Indicador, EstadoVazio, Tabela, moeda } from "../../components/ui";
import {
  CATEGORIAS_DESPESA,
  ROTULO_CATEGORIA_DESPESA,
  type Despesa,
  type ResultadoDre,
  type Talhao,
} from "../../lib/types";

function primeiroDiaDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dre() {
  const qc = useQueryClient();
  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMes());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [talhaoId, setTalhaoId] = useState("");

  const { data: talhoes } = useQuery({ queryKey: ["talhoes"], queryFn: () => api.get<Talhao[]>("/talhoes") });

  const { data: dre, isLoading } = useQuery({
    queryKey: ["dre", dataInicio, dataFim, talhaoId],
    queryFn: () =>
      api.get<ResultadoDre>(
        `/dre?dataInicio=${dataInicio}T00:00:00.000Z&dataFim=${dataFim}T23:59:59.999Z${talhaoId ? `&talhaoId=${talhaoId}` : ""}`,
      ),
  });

  const { data: despesas } = useQuery({
    queryKey: ["despesas", dataInicio, dataFim, talhaoId],
    queryFn: () =>
      api.get<Despesa[]>(
        `/despesas?dataInicio=${dataInicio}&dataFim=${dataFim}${talhaoId ? `&talhaoId=${talhaoId}` : ""}`,
      ),
  });

  const [categoria, setCategoria] = useState<(typeof CATEGORIAS_DESPESA)[number]>("ADMINISTRATIVO");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataDespesa, setDataDespesa] = useState(hojeISO());
  const [talhaoDespesaId, setTalhaoDespesaId] = useState("");

  const criarDespesa = useMutation({
    mutationFn: () =>
      api.post("/despesas", {
        categoria,
        descricao,
        valor: Number(valor),
        data: dataDespesa,
        talhaoId: talhaoDespesaId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["dre"] });
      setDescricao("");
      setValor("");
    },
  });

  const removerDespesa = useMutation({
    mutationFn: (id: string) => api.delete(`/despesas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["despesas"] });
      qc.invalidateQueries({ queryKey: ["dre"] });
    },
  });

  const talhaoSelecionado = talhoes?.find((t) => t.id === talhaoId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-terra-900">DRE</h1>
        <p className="mt-1 text-sm text-terra-500">
          Resultado do período: receita das colheitas menos os custos das operações e as despesas gerais.
        </p>
      </div>

      <Cartao className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-terra-600">De</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="rounded-lg border border-terra-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-terra-600">Até</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="rounded-lg border border-terra-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-terra-600">Talhão</label>
          <select
            value={talhaoId}
            onChange={(e) => setTalhaoId(e.target.value)}
            className="rounded-lg border border-terra-300 px-3 py-2 text-sm"
          >
            <option value="">Todo o sítio</option>
            {talhoes?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
      </Cartao>

      {!isLoading && dre && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Indicador
              titulo="Receita"
              valor={moeda(dre.receita.colheitas)}
              tom="limao"
              icone={TrendingUp}
              detalhe={`${dre.receita.caixas.toLocaleString("pt-BR")} caixas`}
            />
            <Indicador
              titulo="Custo direto"
              valor={moeda(dre.custos.operacoes + dre.custos.colheita)}
              tom="alerta"
              icone={TrendingDown}
              detalhe="Operações + colheita"
            />
            <Indicador
              titulo="Despesas"
              valor={moeda(dre.custos.despesasProprias + dre.custos.despesasRateadas)}
              tom="alerta"
              icone={Receipt}
              detalhe={talhaoSelecionado ? "Próprias + rateadas por área" : "Gerais do período"}
            />
            <Indicador
              titulo="Resultado"
              valor={moeda(dre.resultado)}
              tom={dre.resultado >= 0 ? "mata" : "perigo"}
              icone={Scale}
              detalhe={dre.margemPercentual != null ? `Margem de ${dre.margemPercentual.toFixed(1)}%` : "Sem receita no período"}
              destaque
              className="col-span-2 sm:col-span-1"
            />
          </div>

          {dre.despesasPorCategoria.length > 0 && (
            <Cartao>
              <TituloSecao icone={Receipt}>Despesas por categoria</TituloSecao>
              <ul className="space-y-1.5">
                {dre.despesasPorCategoria.map((c) => (
                  <li key={c.categoria} className="flex items-center justify-between text-sm">
                    <span className="text-terra-700">
                      {ROTULO_CATEGORIA_DESPESA[c.categoria as keyof typeof ROTULO_CATEGORIA_DESPESA] ?? c.categoria}
                    </span>
                    <span className="numero font-semibold text-terra-800">{moeda(c.valor)}</span>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          {dre.porTalhao && dre.porTalhao.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold tracking-tight text-terra-900">Resultado por talhão</h2>
              <Tabela cabecalho={["Talhão", "Área (ha)", "Receita", "Custo direto", "Despesa rateada", "Resultado"]}>
                {dre.porTalhao.map((l) => (
                  <tr key={l.talhaoId}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-terra-800">{l.nome}</td>
                    <td className="px-4 py-2.5 text-terra-600">{l.areaHa?.toFixed(2) ?? "—"}</td>
                    <td className="numero px-4 py-2.5 text-terra-700">{moeda(l.receita)}</td>
                    <td className="numero px-4 py-2.5 text-terra-700">{moeda(l.custoDireto)}</td>
                    <td className="numero px-4 py-2.5 text-terra-700">{moeda(l.despesasRateadas)}</td>
                    <td className={`numero px-4 py-2.5 font-semibold ${l.resultado >= 0 ? "text-mata-700" : "text-red-600"}`}>
                      {moeda(l.resultado)}
                    </td>
                  </tr>
                ))}
              </Tabela>
            </div>
          )}
        </>
      )}

      <Cartao className="max-w-2xl">
        <TituloSecao icone={Plus} descricao="Contabilidade, ITR, administrativo — o que não nasce de uma operação de campo.">
          Lançar despesa
        </TituloSecao>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as typeof categoria)}
            className="rounded-lg border border-terra-300 px-3 py-2 text-sm"
          >
            {CATEGORIAS_DESPESA.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA_DESPESA[c]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dataDespesa}
            onChange={(e) => setDataDespesa(e.target.value)}
            className="rounded-lg border border-terra-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="rounded-lg border border-terra-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="any"
            placeholder="Valor (R$)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="rounded-lg border border-terra-300 px-3 py-2 text-sm"
          />
          <select
            value={talhaoDespesaId}
            onChange={(e) => setTalhaoDespesaId(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-terra-300 px-3 py-2 text-sm"
          >
            <option value="">Despesa geral do sítio (rateada por área)</option>
            {talhoes?.map((t) => (
              <option key={t.id} value={t.id}>
                Só o talhão: {t.nome}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => criarDespesa.mutate()}
          disabled={!descricao || !valor || Number(valor) <= 0 || criarDespesa.isPending}
          className="mt-3 flex items-center gap-2 rounded-lg bg-mata-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mata-700 disabled:opacity-60"
        >
          <DollarSign size={15} />
          Lançar
        </button>
      </Cartao>

      <div>
        <h2 className="mb-3 text-base font-semibold tracking-tight text-terra-900">Despesas do período</h2>
        {despesas && despesas.length === 0 && (
          <EstadoVazio
            icone={Receipt}
            titulo="Nenhuma despesa lançada"
            descricao="Use o formulário acima para registrar contabilidade, impostos, manutenção e outras despesas gerais."
          />
        )}
        {despesas && despesas.length > 0 && (
          <Tabela cabecalho={["Data", "Categoria", "Descrição", "Talhão", "Valor", ""]}>
            {despesas.map((d) => (
              <tr key={d.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-terra-600">
                  {new Date(d.data).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-2.5 text-terra-600">{ROTULO_CATEGORIA_DESPESA[d.categoria]}</td>
                <td className="px-4 py-2.5 text-terra-800">{d.descricao}</td>
                <td className="px-4 py-2.5 text-terra-600">{d.talhao?.nome ?? "Geral do sítio"}</td>
                <td className="numero px-4 py-2.5 font-semibold text-terra-800">{moeda(d.valor)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => removerDespesa.mutate(d.id)}
                    className="text-terra-400 transition hover:text-red-600"
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </div>
    </div>
  );
}
