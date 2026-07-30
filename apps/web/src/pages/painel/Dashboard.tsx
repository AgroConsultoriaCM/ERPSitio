import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { ROTULO_FUNCAO_INSUMO } from "../../lib/types";
import type {
  AlertaPraga,
  Atividade,
  Colheita,
  Insumo,
  ResumoColheitaTalhao,
  SituacaoSetor,
  Talhao,
} from "../../lib/types";

const moeda = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function Card({
  titulo,
  valor,
  detalhe,
  link,
}: {
  titulo: string;
  valor: string | number;
  detalhe?: string;
  link: string;
}) {
  return (
    <Link to={link} className="rounded-xl bg-white p-5 shadow-sm hover:shadow-md">
      <p className="text-sm text-gray-500">{titulo}</p>
      <p className="mt-1 text-3xl font-bold text-green-800">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-gray-400">{detalhe}</p>}
    </Link>
  );
}

export default function Dashboard() {
  const { data: talhoes } = useQuery({ queryKey: ["talhoes"], queryFn: () => api.get<Talhao[]>("/talhoes") });
  const { data: atividades } = useQuery({
    queryKey: ["atividades-recentes"],
    queryFn: () => api.get<Atividade[]>("/atividades"),
  });
  const { data: colheitas } = useQuery({
    queryKey: ["colheitas-recentes"],
    queryFn: () => api.get<Colheita[]>("/colheitas"),
  });
  const { data: resumo } = useQuery({
    queryKey: ["colheitas-resumo"],
    queryFn: () => api.get<ResumoColheitaTalhao[]>("/colheitas/resumo"),
  });
  const { data: insumos } = useQuery({ queryKey: ["insumos"], queryFn: () => api.get<Insumo[]>("/insumos") });
  const { data: alertas } = useQuery({
    queryKey: ["pragas-alertas"],
    queryFn: () => api.get<AlertaPraga[]>("/pragas/alertas"),
  });
  const { data: setores } = useQuery({
    queryKey: ["irrigacao-situacao"],
    queryFn: () => api.get<SituacaoSetor[]>("/irrigacoes/situacao"),
  });

  // setores parados ha mais de 7 dias merecem olhada
  const setoresAtrasados = setores?.filter((s) => (s.diasDesdeUltima ?? 999) > 7) ?? [];

  const insumosBaixos = insumos?.filter(
    (i) => i.estoqueMinimo != null && (i.saldoAtual ?? 0) < i.estoqueMinimo,
  );

  const areaTotal = talhoes?.reduce((s, t) => s + (t.areaHa ?? 0), 0) ?? 0;
  const caixasTotal = resumo?.reduce((s, r) => s + r.caixas, 0) ?? 0;
  const custoColheita = resumo?.reduce((s, r) => s + r.custoColheita, 0) ?? 0;
  const custoOperacoes = atividades?.reduce((s, a) => s + (a.custoMaoDeObra ?? 0), 0) ?? 0;
  const receita = resumo?.reduce((s, r) => s + r.receita, 0) ?? 0;

  const hoje = new Date().toISOString().slice(0, 10);
  const caixasHoje =
    colheitas
      ?.filter((c) => c.data.slice(0, 10) === hoje)
      .reduce((s, c) => s + c.quantidadeCaixas, 0) ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card
          titulo="Colhido hoje"
          valor={`${caixasHoje.toLocaleString("pt-BR")} cx`}
          link="/painel/colheitas"
        />
        <Card
          titulo="Colheita acumulada"
          valor={`${caixasTotal.toLocaleString("pt-BR")} cx`}
          detalhe={areaTotal > 0 ? `${(caixasTotal / areaTotal).toFixed(1)} cx/ha` : undefined}
          link="/painel/colheitas"
        />
        <Card
          titulo="Custo de colheita"
          valor={moeda(custoColheita)}
          detalhe={caixasTotal > 0 ? `${moeda(custoColheita / caixasTotal)}/caixa` : undefined}
          link="/painel/colheitas"
        />
        <Card
          titulo="Custo de operações"
          valor={moeda(custoOperacoes)}
          detalhe={`${atividades?.length ?? 0} operações`}
          link="/painel/atividades"
        />
      </div>

      {receita > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Resultado parcial (colheitas com venda lançada)</p>
          <div className="mt-2 flex flex-wrap gap-8">
            <div>
              <p className="text-xs text-gray-400">Receita</p>
              <p className="text-xl font-bold text-gray-800">{moeda(receita)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Custos lançados</p>
              <p className="text-xl font-bold text-gray-800">{moeda(custoColheita + custoOperacoes)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Margem</p>
              <p
                className={`text-xl font-bold ${
                  receita - custoColheita - custoOperacoes >= 0 ? "text-green-700" : "text-red-600"
                }`}
              >
                {moeda(receita - custoColheita - custoOperacoes)}
              </p>
            </div>
          </div>
        </div>
      )}

      {(!!alertas?.length || !!setoresAtrasados.length) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {!!alertas?.length && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-red-800">Controle de pragas</p>
                <Link to="/painel/pragas" className="text-xs text-red-700 underline">
                  ver todos
                </Link>
              </div>
              <ul className="space-y-1 text-sm text-red-900">
                {alertas.slice(0, 5).map((a) => (
                  <li key={`${a.regraId}-${a.talhaoId}`}>
                    <span className="font-medium">
                      {a.talhaoCodigo ? `${a.talhaoCodigo} · ` : ""}
                      {a.talhaoNome}
                    </span>{" "}
                    precisa de {ROTULO_FUNCAO_INSUMO[a.funcao]}
                    {a.nuncaAplicado ? " (nunca aplicado)" : ` (há ${a.diasDesdeUltima} dias)`}
                  </li>
                ))}
              </ul>
              {alertas.length > 5 && (
                <p className="mt-2 text-xs text-red-700">e mais {alertas.length - 5}...</p>
              )}
            </div>
          )}

          {!!setoresAtrasados.length && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-sky-800">Irrigação</p>
                <Link to="/painel/irrigacao" className="text-xs text-sky-700 underline">
                  ver manejo hídrico
                </Link>
              </div>
              <ul className="space-y-1 text-sm text-sky-900">
                {setoresAtrasados.slice(0, 5).map((s) => (
                  <li key={s.setorId}>
                    <span className="font-medium">
                      {s.codigo ? `${s.codigo} · ` : ""}
                      {s.nome}
                    </span>
                    {s.diasDesdeUltima != null
                      ? ` — última irrigação há ${s.diasDesdeUltima} dias`
                      : " — nunca irrigado"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!!insumosBaixos?.length && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 font-semibold text-amber-800">Atenção: estoque abaixo do mínimo</p>
          <ul className="list-inside list-disc text-sm text-amber-800">
            {insumosBaixos.map((i) => (
              <li key={i.id}>
                {i.nome}: {i.saldoAtual} {i.unidadeMedida} (mínimo {i.estoqueMinimo})
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!resumo?.length && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-700">Produtividade por talhão</h2>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-500">
                <tr>
                  <th className="px-4 py-2">Talhão</th>
                  <th className="px-4 py-2">Caixas</th>
                  <th className="px-4 py-2">Cx/ha</th>
                  <th className="px-4 py-2">Custo colheita</th>
                </tr>
              </thead>
              <tbody>
                {resumo.map((r) => (
                  <tr key={r.talhaoId} className="border-t">
                    <td className="px-4 py-2">
                      {r.codigo ? `${r.codigo} · ` : ""}
                      {r.nome}
                    </td>
                    <td className="px-4 py-2">{r.caixas.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2">{r.caixasPorHectare ?? "-"}</td>
                    <td className="px-4 py-2">{moeda(r.custoColheita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold text-gray-700">Últimas operações</h2>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-500">
              <tr>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Operação</th>
                <th className="px-4 py-2">Talhões</th>
                <th className="px-4 py-2">Quem fez</th>
              </tr>
            </thead>
            <tbody>
              {atividades?.slice(0, 8).map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2">{new Date(a.data).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-2">{a.tipoAtividade?.nome}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {a.talhoes?.map((t) => t.talhao.nome).join(", ")}
                  </td>
                  <td className="px-4 py-2">{a.executor?.nome ?? a.responsavel?.nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {atividades?.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma operação lançada ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
