import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { ROTULO_FUNCAO_INSUMO } from "../../lib/types";
import type {
  AlertaPraga,
  EscopoAlerta,
  FuncaoInsumo,
  GrupoTalhaoResumo,
  RegraAlerta,
  Talhao,
  UltimaAplicacaoTalhao,
} from "../../lib/types";

const funcoes = Object.keys(ROTULO_FUNCAO_INSUMO) as FuncaoInsumo[];
// funcoes que fazem sentido acompanhar no controle fitossanitario
const funcoesMonitoradas: FuncaoInsumo[] = [
  "INSETICIDA",
  "FUNGICIDA",
  "HERBICIDA",
  "ACARICIDA",
  "NUTRICAO_FOLIAR",
];

export default function Pragas() {
  const qc = useQueryClient();
  const { data: alertas } = useQuery({
    queryKey: ["pragas-alertas"],
    queryFn: () => api.get<AlertaPraga[]>("/pragas/alertas"),
  });
  const { data: matriz } = useQuery({
    queryKey: ["pragas-ultimas"],
    queryFn: () => api.get<UltimaAplicacaoTalhao[]>("/pragas/ultimas-aplicacoes"),
  });
  const { data: regras } = useQuery({
    queryKey: ["pragas-regras"],
    queryFn: () => api.get<RegraAlerta[]>("/pragas/regras"),
  });
  const { data: grupos } = useQuery({
    queryKey: ["grupos"],
    queryFn: () => api.get<GrupoTalhaoResumo[]>("/grupos"),
  });
  const { data: talhoes } = useQuery({ queryKey: ["talhoes"], queryFn: () => api.get<Talhao[]>("/talhoes") });

  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState<FuncaoInsumo>("INSETICIDA");
  const [intervaloDias, setIntervaloDias] = useState("30");
  const [escopo, setEscopo] = useState<EscopoAlerta>("TODOS_TALHOES");
  const [grupoId, setGrupoId] = useState("");
  const [talhaoId, setTalhaoId] = useState("");

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["pragas-regras"] });
    qc.invalidateQueries({ queryKey: ["pragas-alertas"] });
  }

  const criar = useMutation({
    mutationFn: () =>
      api.post("/pragas/regras", {
        nome,
        funcao,
        intervaloDias: Number(intervaloDias),
        escopo,
        grupoId: escopo === "GRUPO" ? grupoId : null,
        talhaoId: escopo === "TALHAO" ? talhaoId : null,
      }),
    onSuccess: () => {
      invalidar();
      setNome("");
    },
  });

  const alternarAtiva = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      api.patch(`/pragas/regras/${id}`, { ativo }),
    onSuccess: invalidar,
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/pragas/regras/${id}`),
    onSuccess: invalidar,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Controle de pragas</h1>
        <p className="text-sm text-gray-500">
          O sistema acompanha quando cada talhão recebeu cada tipo de produto e avisa quando passa do intervalo que
          você definir. Os alertas são um lembrete para sua decisão — o sistema não aplica nada sozinho.
        </p>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">
          Alertas em aberto{" "}
          {!!alertas?.length && (
            <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-sm text-red-700">
              {alertas.length}
            </span>
          )}
        </p>
        {!alertas?.length ? (
          <p className="text-sm text-gray-400">
            Nenhum alerta. {regras?.length ? "Tudo dentro do intervalo." : "Cadastre uma regra abaixo para começar."}
          </p>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a) => (
              <li
                key={`${a.regraId}-${a.talhaoId}`}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  a.nuncaAplicado ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <span className="font-semibold">
                  {a.talhaoCodigo ? `${a.talhaoCodigo} · ` : ""}
                  {a.talhaoNome}
                </span>{" "}
                precisa de <span className="font-semibold">{ROTULO_FUNCAO_INSUMO[a.funcao]}</span>
                {a.nuncaAplicado ? (
                  <span className="text-red-700"> — nunca aplicado</span>
                ) : (
                  <span className="text-amber-800">
                    {" "}
                    — última há {a.diasDesdeUltima} dias (intervalo: {a.intervaloDias};{" "}
                    {a.diasVencido} dia{a.diasVencido === 1 ? "" : "s"} vencido)
                  </span>
                )}
                <span className="ml-1 text-xs text-gray-500">· regra "{a.regraNome}"</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="max-w-3xl rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">Nova regra de alerta</p>
        <div className="grid grid-cols-6 gap-2">
          <input
            placeholder="Nome (ex: Inseticida a cada 30 dias)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="col-span-3 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={funcao}
            onChange={(e) => setFuncao(e.target.value as FuncaoInsumo)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {funcoes.map((f) => (
              <option key={f} value={f}>
                {ROTULO_FUNCAO_INSUMO[f]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            placeholder="Dias"
            value={intervaloDias}
            onChange={(e) => setIntervaloDias(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={escopo}
            onChange={(e) => setEscopo(e.target.value as EscopoAlerta)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="TODOS_TALHOES">Todos os talhões</option>
            <option value="GRUPO">Um grupo</option>
            <option value="TALHAO">Um talhão</option>
          </select>
          {escopo === "GRUPO" && (
            <select
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
              className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Grupo...</option>
              {grupos?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          )}
          {escopo === "TALHAO" && (
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
          )}
          <button
            onClick={() => criar.mutate()}
            disabled={
              !nome ||
              !intervaloDias ||
              (escopo === "GRUPO" && !grupoId) ||
              (escopo === "TALHAO" && !talhaoId) ||
              criar.isPending
            }
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Criar
          </button>
        </div>
      </div>

      {!!regras?.length && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <p className="border-b bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">Regras</p>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-500">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Função</th>
                <th className="px-4 py-2">Intervalo</th>
                <th className="px-4 py-2">Escopo</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {regras.map((r) => (
                <tr key={r.id} className={`border-t ${r.ativo ? "" : "text-gray-400"}`}>
                  <td className="px-4 py-2">{r.nome}</td>
                  <td className="px-4 py-2">{ROTULO_FUNCAO_INSUMO[r.funcao]}</td>
                  <td className="px-4 py-2">{r.intervaloDias} dias</td>
                  <td className="px-4 py-2 text-xs">
                    {r.escopo === "TODOS_TALHOES"
                      ? "Todos"
                      : r.escopo === "GRUPO"
                        ? grupos?.find((g) => g.id === r.grupoId)?.nome ?? "Grupo"
                        : talhoes?.find((t) => t.id === r.talhaoId)?.nome ?? "Talhão"}
                  </td>
                  <td className="px-4 py-2">{r.ativo ? "Ativa" : "Inativa"}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-right">
                    <button
                      onClick={() => alternarAtiva.mutate({ id: r.id, ativo: !r.ativo })}
                      className="mr-3 text-green-700"
                    >
                      {r.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir a regra "${r.nome}"?`)) remover.mutate(r.id);
                      }}
                      className="text-red-600"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <p className="border-b bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
          Última aplicação por talhão (dias atrás)
        </p>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-500">
            <tr>
              <th className="px-4 py-2">Talhão</th>
              {funcoesMonitoradas.map((f) => (
                <th key={f} className="px-4 py-2">
                  {ROTULO_FUNCAO_INSUMO[f]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz?.map((t) => (
              <tr key={t.talhaoId} className="border-t">
                <td className="px-4 py-2">
                  {t.codigo ? `${t.codigo} · ` : ""}
                  {t.nome}
                </td>
                {funcoesMonitoradas.map((f) => {
                  const ap = t.aplicacoes[f];
                  return (
                    <td key={f} className="px-4 py-2">
                      {ap ? (
                        <span title={`${ap.produto} em ${new Date(ap.data).toLocaleDateString("pt-BR")}`}>
                          {ap.diasAtras}d
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t px-4 py-2 text-xs text-gray-400">
          Preenchido automaticamente pelas operações que usaram produtos com função definida no cadastro de insumos.
        </p>
      </div>
    </div>
  );
}
