import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import type { Irrigacao as IrrigacaoTipo, RespostaClima, SituacaoSetor } from "../../lib/types";

const num = (v: number | null | undefined, casas = 1) =>
  v == null ? "-" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

export default function Irrigacao() {
  const qc = useQueryClient();

  const { data: situacao } = useQuery({
    queryKey: ["irrigacao-situacao"],
    queryFn: () => api.get<SituacaoSetor[]>("/irrigacoes/situacao"),
  });
  const { data: registros } = useQuery({
    queryKey: ["irrigacoes"],
    queryFn: () => api.get<IrrigacaoTipo[]>("/irrigacoes"),
  });
  const clima = useQuery({
    queryKey: ["clima"],
    queryFn: () => api.get<RespostaClima>("/clima"),
    retry: false,
    staleTime: 30 * 60 * 1000,
  });

  const [setorId, setSetorId] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [duracaoHoras, setDuracaoHoras] = useState("");
  const [laminaMm, setLaminaMm] = useState("");

  const registrar = useMutation({
    mutationFn: () =>
      api.post("/irrigacoes", {
        setorId,
        data: new Date(`${data}T12:00:00`).toISOString(),
        duracaoHoras: duracaoHoras ? Number(duracaoHoras) : undefined,
        laminaMm: laminaMm ? Number(laminaMm) : undefined,
        origem: "WEB",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["irrigacoes"] });
      qc.invalidateQueries({ queryKey: ["irrigacao-situacao"] });
      setDuracaoHoras("");
      setLaminaMm("");
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/irrigacoes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["irrigacoes"] });
      qc.invalidateQueries({ queryKey: ["irrigacao-situacao"] });
    },
  });

  const previsao = clima.data?.dias.filter((d) => !d.passado) ?? [];
  const ultimos = clima.data?.dias.filter((d) => d.passado).slice(-14) ?? [];
  const maxChuva = Math.max(1, ...clima.data?.dias.map((d) => d.chuvaMm ?? 0) ?? [1]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Manejo hídrico</h1>
        <p className="text-sm text-gray-600">
          Registro de irrigação por setor, com chuva registrada e previsão do tempo da coordenada da propriedade.
        </p>
      </div>

      {clima.isError && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {clima.error instanceof ApiError
            ? clima.error.message
            : "Não foi possível carregar a previsão do tempo agora."}
        </div>
      )}

      {clima.data && (
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs text-gray-500">Chuva últimos 7 dias</p>
              <p className="text-2xl font-bold text-sky-700">{num(clima.data.chuva7DiasMm)} mm</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Últimos 30 dias</p>
              <p className="text-2xl font-bold text-gray-800">{num(clima.data.chuva30DiasMm)} mm</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Previsão próximos 7 dias</p>
              <p className="text-2xl font-bold text-sky-700">{num(clima.data.chuvaPrevista7DiasMm)} mm</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Dias sem chuva (≥1 mm)</p>
              <p
                className={`text-2xl font-bold ${
                  (clima.data.diasSemChuva ?? 0) > 7 ? "text-amber-700" : "text-gray-800"
                }`}
              >
                {clima.data.diasSemChuva ?? "—"}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Chuva (14 dias) e previsão (7 dias)</p>
            <div className="flex items-end gap-1 overflow-x-auto pb-1">
              {[...ultimos, ...previsao].map((d) => {
                const altura = Math.max(2, ((d.chuvaMm ?? 0) / maxChuva) * 60);
                return (
                  <div key={d.data} className="flex w-9 shrink-0 flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-500">
                      {d.chuvaMm ? num(d.chuvaMm) : ""}
                    </span>
                    <div
                      className={`w-full rounded-t ${d.passado ? "bg-sky-500" : "bg-sky-300"}`}
                      style={{ height: `${altura}px` }}
                      title={`${new Date(d.data + "T12:00").toLocaleDateString("pt-BR")}: ${num(
                        d.chuvaMm,
                      )} mm`}
                    />
                    <span className="text-[10px] text-gray-600">
                      {new Date(d.data + "T12:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Azul escuro = já ocorrido · azul claro = previsão. Fonte: Open-Meteo.
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <p className="border-b bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
          Situação dos setores
        </p>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-2">Setor</th>
              <th className="px-4 py-2">Área</th>
              <th className="px-4 py-2">Última irrigação</th>
              <th className="px-4 py-2">Há quantos dias</th>
              <th className="px-4 py-2">Duração</th>
              <th className="px-4 py-2">Lâmina</th>
            </tr>
          </thead>
          <tbody>
            {situacao?.map((s) => (
              <tr key={s.setorId} className="border-t">
                <td className="px-4 py-2">
                  {s.codigo ? `${s.codigo} · ` : ""}
                  {s.nome}
                </td>
                <td className="px-4 py-2">{num(s.areaHa, 2)} ha</td>
                <td className="px-4 py-2">
                  {s.ultimaIrrigacao ? new Date(s.ultimaIrrigacao).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td
                  className={`px-4 py-2 font-medium ${
                    (s.diasDesdeUltima ?? 99) > 7 ? "text-amber-700" : "text-gray-700"
                  }`}
                >
                  {s.diasDesdeUltima != null ? `${s.diasDesdeUltima} dias` : "nunca"}
                </td>
                <td className="px-4 py-2">{s.duracaoHoras ? `${num(s.duracaoHoras)} h` : "-"}</td>
                <td className="px-4 py-2">{s.laminaMm ? `${num(s.laminaMm)} mm` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {situacao?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            Nenhum setor de irrigação cadastrado. Cadastre em "Setores de irrigação".
          </p>
        )}
      </div>

      {!!situacao?.length && (
        <div className="max-w-3xl rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-3 font-semibold">Registrar irrigação</p>
          <div className="grid grid-cols-5 gap-2">
            <select
              value={setorId}
              onChange={(e) => setSetorId(e.target.value)}
              className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Setor...</option>
              {situacao.map((s) => (
                <option key={s.setorId} value={s.setorId}>
                  {s.codigo ? `${s.codigo} · ` : ""}
                  {s.nome}
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
              step="0.1"
              placeholder="Horas"
              value={duracaoHoras}
              onChange={(e) => setDuracaoHoras(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              step="0.1"
              placeholder="Lâmina (mm)"
              value={laminaMm}
              onChange={(e) => setLaminaMm(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => registrar.mutate()}
              disabled={!setorId || registrar.isPending}
              className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Registrar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <p className="border-b bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">Histórico</p>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Setor</th>
              <th className="px-4 py-2">Duração</th>
              <th className="px-4 py-2">Lâmina</th>
              <th className="px-4 py-2">Responsável</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {registros?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">{new Date(r.data).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-2">{r.setor?.nome}</td>
                <td className="px-4 py-2">{r.duracaoHoras ? `${num(r.duracaoHoras)} h` : "-"}</td>
                <td className="px-4 py-2">{r.laminaMm ? `${num(r.laminaMm)} mm` : "-"}</td>
                <td className="px-4 py-2">{r.responsavel?.nome ?? "-"}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => {
                      if (confirm("Excluir este registro de irrigação?")) remover.mutate(r.id);
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
        {registros?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">Nenhuma irrigação registrada ainda.</p>
        )}
      </div>
    </div>
  );
}
