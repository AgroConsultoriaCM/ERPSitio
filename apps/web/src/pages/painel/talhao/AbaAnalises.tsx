import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../../../lib/api";
import type { AnaliseFoliar, AnaliseSolo, DiagnosticoResposta } from "../../../lib/types";

const statusCor: Record<string, string> = {
  BAIXO: "bg-red-100 text-red-800",
  ADEQUADO: "bg-green-100 text-green-800",
  ALTO: "bg-amber-100 text-amber-800",
  SEM_REFERENCIA: "bg-gray-100 text-gray-500",
};

function campoNum(
  label: string,
  valor: string,
  onChange: (v: string) => void,
) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-500">{label}</label>
      <input
        type="number"
        step="any"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}

export default function AbaAnalises({ talhaoId }: { talhaoId: string }) {
  const qc = useQueryClient();

  const { data: diagnostico } = useQuery({
    queryKey: ["diagnostico", talhaoId],
    queryFn: () => api.get<DiagnosticoResposta>(`/talhoes/${talhaoId}/diagnostico`),
  });
  const { data: analisesSolo } = useQuery({
    queryKey: ["analises-solo", talhaoId],
    queryFn: () => api.get<AnaliseSolo[]>(`/analises-solo?talhaoId=${talhaoId}`),
  });
  const { data: analisesFoliar } = useQuery({
    queryKey: ["analises-foliar", talhaoId],
    queryFn: () => api.get<AnaliseFoliar[]>(`/analises-foliar?talhaoId=${talhaoId}`),
  });

  const [soloForm, setSoloForm] = useState<Record<string, string>>({
    dataColeta: "",
    profundidadeCm: "",
    laboratorio: "",
    ph: "",
    materiaOrganica: "",
    fosforo: "",
    enxofre: "",
    potassio: "",
    calcio: "",
    magnesio: "",
    aluminio: "",
    hAl: "",
    somaBases: "",
    ctc: "",
    saturacaoBases: "",
    saturacaoAluminio: "",
  });

  const salvarSolo = useMutation({
    mutationFn: () => {
      const n = (v: string) => (v ? Number(v) : null);
      return api.post("/analises-solo", {
        talhaoId,
        dataColeta: soloForm.dataColeta,
        profundidadeCm: soloForm.profundidadeCm || null,
        laboratorio: soloForm.laboratorio || undefined,
        ph: n(soloForm.ph),
        materiaOrganica: n(soloForm.materiaOrganica),
        fosforo: n(soloForm.fosforo),
        enxofre: n(soloForm.enxofre),
        potassio: n(soloForm.potassio),
        calcio: n(soloForm.calcio),
        magnesio: n(soloForm.magnesio),
        aluminio: n(soloForm.aluminio),
        hAl: n(soloForm.hAl),
        somaBases: n(soloForm.somaBases),
        ctc: n(soloForm.ctc),
        saturacaoBases: n(soloForm.saturacaoBases),
        saturacaoAluminio: n(soloForm.saturacaoAluminio),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analises-solo", talhaoId] });
      qc.invalidateQueries({ queryKey: ["diagnostico", talhaoId] });
      setSoloForm((f) => ({ ...Object.fromEntries(Object.keys(f).map((k) => [k, ""])) }));
    },
  });

  const [foliarForm, setFoliarForm] = useState<Record<string, string>>({
    dataColeta: "",
    estadioFenologico: "",
    nitrogenio: "",
    fosforo: "",
    potassio: "",
    calcio: "",
    magnesio: "",
    enxofre: "",
  });

  const salvarFoliar = useMutation({
    mutationFn: () => {
      const n = (v: string) => (v ? Number(v) : null);
      return api.post("/analises-foliar", {
        talhaoId,
        dataColeta: foliarForm.dataColeta,
        estadioFenologico: foliarForm.estadioFenologico || undefined,
        nitrogenio: n(foliarForm.nitrogenio),
        fosforo: n(foliarForm.fosforo),
        potassio: n(foliarForm.potassio),
        calcio: n(foliarForm.calcio),
        magnesio: n(foliarForm.magnesio),
        enxofre: n(foliarForm.enxofre),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analises-foliar", talhaoId] });
      setFoliarForm((f) => ({ ...Object.fromEntries(Object.keys(f).map((k) => [k, ""])) }));
    },
  });

  const dadosGrafico = analisesSolo
    ?.slice()
    .reverse()
    .map((a) => ({
      data: new Date(a.dataColeta).toLocaleDateString("pt-BR"),
      pH: a.ph,
      "V%": a.saturacaoBases,
    }));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-700">Diagnóstico (última análise x perfil da cultura)</h2>
        {!diagnostico?.possuiAnalise && (
          <p className="text-sm text-gray-500">{diagnostico?.mensagem}</p>
        )}
        {diagnostico?.possuiAnalise && !diagnostico.possuiPerfil && (
          <p className="text-sm text-amber-700">
            Há análise de solo cadastrada, mas nenhum perfil de correção para a cultura deste talhão. Cadastre um em
            "Perfis de correção".
          </p>
        )}
        {diagnostico?.possuiPerfil && (
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm text-gray-500">Perfil usado: {diagnostico.perfilNome}</p>
            <div className="flex flex-wrap gap-2">
              {diagnostico.parametros?.map((p) => (
                <span key={p.parametro} className={`rounded-full px-3 py-1 text-xs font-medium ${statusCor[p.status]}`}>
                  {p.parametro}: {p.valorMedido ?? "-"} ({p.status.replace("_", " ").toLowerCase()})
                </span>
              ))}
            </div>
            {diagnostico.observacaoCalagem && (
              <p className="mt-3 text-sm text-gray-700">
                {diagnostico.necessidadeCalagemToneladasPorHectare != null && (
                  <strong>Necessidade de calagem estimada: {diagnostico.necessidadeCalagemToneladasPorHectare} t/ha. </strong>
                )}
                {diagnostico.observacaoCalagem}
              </p>
            )}
          </div>
        )}
      </section>

      {dadosGrafico && dadosGrafico.length > 1 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-700">Evolução do solo (pH e saturação por bases)</h2>
          <div className="h-64 rounded-xl bg-white p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="pH" stroke="#16a34a" />
                <Line type="monotone" dataKey="V%" stroke="#0891b2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-700">Análises de solo</h2>
        <div className="max-w-3xl rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-3 font-semibold">Novo lançamento</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Data de coleta</label>
              <input
                type="date"
                value={soloForm.dataColeta}
                onChange={(e) => setSoloForm((f) => ({ ...f, dataColeta: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Profundidade (cm)</label>
              <input
                value={soloForm.profundidadeCm}
                onChange={(e) => setSoloForm((f) => ({ ...f, profundidadeCm: e.target.value }))}
                placeholder="ex.: 0-20"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Laboratório</label>
              <input
                value={soloForm.laboratorio}
                onChange={(e) => setSoloForm((f) => ({ ...f, laboratorio: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            {campoNum("pH", soloForm.ph, (v) => setSoloForm((f) => ({ ...f, ph: v })))}
            {campoNum("Matéria orgânica", soloForm.materiaOrganica, (v) => setSoloForm((f) => ({ ...f, materiaOrganica: v })))}
            {campoNum("Fósforo (P)", soloForm.fosforo, (v) => setSoloForm((f) => ({ ...f, fosforo: v })))}
            {campoNum("Enxofre (S)", soloForm.enxofre, (v) => setSoloForm((f) => ({ ...f, enxofre: v })))}
            {campoNum("Potássio (K)", soloForm.potassio, (v) => setSoloForm((f) => ({ ...f, potassio: v })))}
            {campoNum("Cálcio (Ca)", soloForm.calcio, (v) => setSoloForm((f) => ({ ...f, calcio: v })))}
            {campoNum("Magnésio (Mg)", soloForm.magnesio, (v) => setSoloForm((f) => ({ ...f, magnesio: v })))}
            {campoNum("Alumínio (Al)", soloForm.aluminio, (v) => setSoloForm((f) => ({ ...f, aluminio: v })))}
            {campoNum("H+Al", soloForm.hAl, (v) => setSoloForm((f) => ({ ...f, hAl: v })))}
            {campoNum("Soma de bases (SB)", soloForm.somaBases, (v) => setSoloForm((f) => ({ ...f, somaBases: v })))}
            {campoNum("CTC", soloForm.ctc, (v) => setSoloForm((f) => ({ ...f, ctc: v })))}
            {campoNum("Saturação por bases (V%)", soloForm.saturacaoBases, (v) => setSoloForm((f) => ({ ...f, saturacaoBases: v })))}
            {campoNum("Saturação por alumínio (m%)", soloForm.saturacaoAluminio, (v) => setSoloForm((f) => ({ ...f, saturacaoAluminio: v })))}
          </div>
          <button
            onClick={() => salvarSolo.mutate()}
            disabled={!soloForm.dataColeta || salvarSolo.isPending}
            className="mt-3 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Salvar análise de solo
          </button>
        </div>

        <ul className="mt-3 space-y-2">
          {analisesSolo?.map((a) => (
            <li key={a.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
              <span className="font-medium">{new Date(a.dataColeta).toLocaleDateString("pt-BR")}</span>
              {" — "}pH {a.ph ?? "-"}, V% {a.saturacaoBases ?? "-"}, P {a.fosforo ?? "-"}, K {a.potassio ?? "-"}
              {a.laboratorio ? ` (${a.laboratorio})` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-700">Análises foliares</h2>
        <div className="max-w-3xl rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-3 font-semibold">Novo lançamento</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Data de coleta</label>
              <input
                type="date"
                value={foliarForm.dataColeta}
                onChange={(e) => setFoliarForm((f) => ({ ...f, dataColeta: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Estádio fenológico</label>
              <input
                value={foliarForm.estadioFenologico}
                onChange={(e) => setFoliarForm((f) => ({ ...f, estadioFenologico: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            {campoNum("Nitrogênio (N)", foliarForm.nitrogenio, (v) => setFoliarForm((f) => ({ ...f, nitrogenio: v })))}
            {campoNum("Fósforo (P)", foliarForm.fosforo, (v) => setFoliarForm((f) => ({ ...f, fosforo: v })))}
            {campoNum("Potássio (K)", foliarForm.potassio, (v) => setFoliarForm((f) => ({ ...f, potassio: v })))}
            {campoNum("Cálcio (Ca)", foliarForm.calcio, (v) => setFoliarForm((f) => ({ ...f, calcio: v })))}
            {campoNum("Magnésio (Mg)", foliarForm.magnesio, (v) => setFoliarForm((f) => ({ ...f, magnesio: v })))}
            {campoNum("Enxofre (S)", foliarForm.enxofre, (v) => setFoliarForm((f) => ({ ...f, enxofre: v })))}
          </div>
          <button
            onClick={() => salvarFoliar.mutate()}
            disabled={!foliarForm.dataColeta || salvarFoliar.isPending}
            className="mt-3 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Salvar análise foliar
          </button>
        </div>

        <ul className="mt-3 space-y-2">
          {analisesFoliar?.map((a) => (
            <li key={a.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
              <span className="font-medium">{new Date(a.dataColeta).toLocaleDateString("pt-BR")}</span>
              {" — "}N {a.nitrogenio ?? "-"}, P {a.fosforo ?? "-"}, K {a.potassio ?? "-"}
              {a.estadioFenologico ? ` (${a.estadioFenologico})` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
