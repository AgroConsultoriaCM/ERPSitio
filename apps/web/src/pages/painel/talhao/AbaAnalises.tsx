import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../../../lib/api";
import type { AnaliseFoliar, AnaliseSolo, DiagnosticoResposta } from "../../../lib/types";

const statusCor: Record<string, string> = {
  BAIXO: "bg-red-100 text-red-800",
  ADEQUADO: "bg-green-100 text-green-800",
  ALTO: "bg-amber-100 text-amber-800",
  SEM_REFERENCIA: "bg-gray-100 text-gray-600",
};

/** Unidade de cada campo — mostrada sempre, em tooltip, para não confundir na hora de digitar/conferir. */
const UNIDADE_SOLO: Record<string, string> = {
  ph: "CaCl₂", materiaOrganica: "g/dm³", fosforo: "mg/dm³", enxofre: "mg/dm³",
  potassio: "mmolc/dm³", calcio: "mmolc/dm³", magnesio: "mmolc/dm³", aluminio: "mmolc/dm³",
  hAl: "mmolc/dm³", somaBases: "mmolc/dm³", ctc: "mmolc/dm³", saturacaoBases: "%", saturacaoAluminio: "%",
};
const UNIDADE_FOLIAR: Record<string, string> = {
  nitrogenio: "g/kg", fosforo: "g/kg", potassio: "g/kg", calcio: "g/kg", magnesio: "g/kg", enxofre: "g/kg",
};

function campoNum(label: string, unidade: string | undefined, valor: string, onChange: (v: string) => void) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs text-gray-600" title={unidade ? `Unidade: ${unidade}` : undefined}>
        {label}
        {unidade && <span className="text-gray-400">({unidade})</span>}
      </label>
      <input
        type="number"
        step="any"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        title={unidade ? `${label}, em ${unidade}` : label}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}

const SOLO_VAZIO: Record<string, string> = {
  dataColeta: "", profundidadeCm: "", laboratorio: "", ph: "", materiaOrganica: "", fosforo: "",
  enxofre: "", potassio: "", calcio: "", magnesio: "", aluminio: "", hAl: "", somaBases: "",
  ctc: "", saturacaoBases: "", saturacaoAluminio: "",
};
const FOLIAR_VAZIO: Record<string, string> = {
  dataColeta: "", estadioFenologico: "", nitrogenio: "", fosforo: "", potassio: "", calcio: "",
  magnesio: "", enxofre: "",
};

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

  const [editandoSoloId, setEditandoSoloId] = useState<string | null>(null);
  const [soloForm, setSoloForm] = useState<Record<string, string>>(SOLO_VAZIO);

  function editarSolo(a: AnaliseSolo) {
    setEditandoSoloId(a.id);
    setSoloForm({
      dataColeta: a.dataColeta.slice(0, 10),
      profundidadeCm: a.profundidadeCm ?? "",
      laboratorio: a.laboratorio ?? "",
      ph: a.ph?.toString() ?? "",
      materiaOrganica: a.materiaOrganica?.toString() ?? "",
      fosforo: a.fosforo?.toString() ?? "",
      enxofre: a.enxofre?.toString() ?? "",
      potassio: a.potassio?.toString() ?? "",
      calcio: a.calcio?.toString() ?? "",
      magnesio: a.magnesio?.toString() ?? "",
      aluminio: a.aluminio?.toString() ?? "",
      hAl: a.hAl?.toString() ?? "",
      somaBases: a.somaBases?.toString() ?? "",
      ctc: a.ctc?.toString() ?? "",
      saturacaoBases: a.saturacaoBases?.toString() ?? "",
      saturacaoAluminio: a.saturacaoAluminio?.toString() ?? "",
    });
  }

  function cancelarSolo() {
    setEditandoSoloId(null);
    setSoloForm(SOLO_VAZIO);
  }

  const salvarSolo = useMutation({
    mutationFn: () => {
      const n = (v: string) => (v ? Number(v) : null);
      const body = {
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
      };
      return editandoSoloId ? api.patch(`/analises-solo/${editandoSoloId}`, body) : api.post("/analises-solo", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analises-solo", talhaoId] });
      qc.invalidateQueries({ queryKey: ["diagnostico", talhaoId] });
      cancelarSolo();
    },
  });

  const excluirSolo = useMutation({
    mutationFn: (id: string) => api.delete(`/analises-solo/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analises-solo", talhaoId] });
      qc.invalidateQueries({ queryKey: ["diagnostico", talhaoId] });
    },
  });

  const [editandoFoliarId, setEditandoFoliarId] = useState<string | null>(null);
  const [foliarForm, setFoliarForm] = useState<Record<string, string>>(FOLIAR_VAZIO);

  function editarFoliar(a: AnaliseFoliar) {
    setEditandoFoliarId(a.id);
    setFoliarForm({
      dataColeta: a.dataColeta.slice(0, 10),
      estadioFenologico: a.estadioFenologico ?? "",
      nitrogenio: a.nitrogenio?.toString() ?? "",
      fosforo: a.fosforo?.toString() ?? "",
      potassio: a.potassio?.toString() ?? "",
      calcio: a.calcio?.toString() ?? "",
      magnesio: a.magnesio?.toString() ?? "",
      enxofre: a.enxofre?.toString() ?? "",
    });
  }

  function cancelarFoliar() {
    setEditandoFoliarId(null);
    setFoliarForm(FOLIAR_VAZIO);
  }

  const salvarFoliar = useMutation({
    mutationFn: () => {
      const n = (v: string) => (v ? Number(v) : null);
      const body = {
        talhaoId,
        dataColeta: foliarForm.dataColeta,
        estadioFenologico: foliarForm.estadioFenologico || undefined,
        nitrogenio: n(foliarForm.nitrogenio),
        fosforo: n(foliarForm.fosforo),
        potassio: n(foliarForm.potassio),
        calcio: n(foliarForm.calcio),
        magnesio: n(foliarForm.magnesio),
        enxofre: n(foliarForm.enxofre),
      };
      return editandoFoliarId
        ? api.patch(`/analises-foliar/${editandoFoliarId}`, body)
        : api.post("/analises-foliar", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analises-foliar", talhaoId] });
      cancelarFoliar();
    },
  });

  const excluirFoliar = useMutation({
    mutationFn: (id: string) => api.delete(`/analises-foliar/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analises-foliar", talhaoId] }),
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
          <p className="text-sm text-gray-600">{diagnostico?.mensagem}</p>
        )}
        {diagnostico?.possuiAnalise && !diagnostico.possuiPerfil && (
          <p className="text-sm text-amber-700">
            Há análise de solo cadastrada, mas nenhum perfil de correção para a cultura deste talhão. Cadastre um em
            "Perfis de correção".
          </p>
        )}
        {diagnostico?.possuiPerfil && (
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm text-gray-600">Perfil usado: {diagnostico.perfilNome}</p>
            <div className="flex flex-wrap gap-2">
              {diagnostico.parametros?.map((p) => (
                <span
                  key={p.parametro}
                  title={`Medido: ${p.valorMedido ?? "sem valor"}${p.faixaIdealMin != null ? ` · Ideal: ${p.faixaIdealMin}${p.faixaIdealMax != null ? `–${p.faixaIdealMax}` : ""}` : ""}`}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${statusCor[p.status]}`}
                >
                  {p.parametro}: {p.valorMedido ?? "-"} ({p.status.replace("_", " ").toLowerCase()})
                </span>
              ))}
            </div>
            {diagnostico.observacaoCalagem && (
              <p className="mt-3 text-sm text-gray-700">
                {diagnostico.necessidadeCalagemToneladasPorHectare != null && (
                  <strong title="Toneladas de calcário por hectare, PRNT 100%">
                    Necessidade de calagem estimada: {diagnostico.necessidadeCalagemToneladasPorHectare} t/ha.{" "}
                  </strong>
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
          <p className="mb-3 font-semibold">{editandoSoloId ? "Editar análise" : "Novo lançamento"}</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600">Data de coleta</label>
              <input
                type="date"
                value={soloForm.dataColeta}
                onChange={(e) => setSoloForm((f) => ({ ...f, dataColeta: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Profundidade (cm)</label>
              <input
                value={soloForm.profundidadeCm}
                onChange={(e) => setSoloForm((f) => ({ ...f, profundidadeCm: e.target.value }))}
                placeholder="ex.: 0-20"
                title="Profundidade da coleta, em centímetros (cm)"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Laboratório</label>
              <input
                value={soloForm.laboratorio}
                onChange={(e) => setSoloForm((f) => ({ ...f, laboratorio: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            {campoNum("pH", UNIDADE_SOLO.ph, soloForm.ph, (v) => setSoloForm((f) => ({ ...f, ph: v })))}
            {campoNum("Matéria orgânica", UNIDADE_SOLO.materiaOrganica, soloForm.materiaOrganica, (v) => setSoloForm((f) => ({ ...f, materiaOrganica: v })))}
            {campoNum("Fósforo (P)", UNIDADE_SOLO.fosforo, soloForm.fosforo, (v) => setSoloForm((f) => ({ ...f, fosforo: v })))}
            {campoNum("Enxofre (S)", UNIDADE_SOLO.enxofre, soloForm.enxofre, (v) => setSoloForm((f) => ({ ...f, enxofre: v })))}
            {campoNum("Potássio (K)", UNIDADE_SOLO.potassio, soloForm.potassio, (v) => setSoloForm((f) => ({ ...f, potassio: v })))}
            {campoNum("Cálcio (Ca)", UNIDADE_SOLO.calcio, soloForm.calcio, (v) => setSoloForm((f) => ({ ...f, calcio: v })))}
            {campoNum("Magnésio (Mg)", UNIDADE_SOLO.magnesio, soloForm.magnesio, (v) => setSoloForm((f) => ({ ...f, magnesio: v })))}
            {campoNum("Alumínio (Al)", UNIDADE_SOLO.aluminio, soloForm.aluminio, (v) => setSoloForm((f) => ({ ...f, aluminio: v })))}
            {campoNum("H+Al", UNIDADE_SOLO.hAl, soloForm.hAl, (v) => setSoloForm((f) => ({ ...f, hAl: v })))}
            {campoNum("Soma de bases (SB)", UNIDADE_SOLO.somaBases, soloForm.somaBases, (v) => setSoloForm((f) => ({ ...f, somaBases: v })))}
            {campoNum("CTC", UNIDADE_SOLO.ctc, soloForm.ctc, (v) => setSoloForm((f) => ({ ...f, ctc: v })))}
            {campoNum("Saturação por bases (V%)", UNIDADE_SOLO.saturacaoBases, soloForm.saturacaoBases, (v) => setSoloForm((f) => ({ ...f, saturacaoBases: v })))}
            {campoNum("Saturação por alumínio (m%)", UNIDADE_SOLO.saturacaoAluminio, soloForm.saturacaoAluminio, (v) => setSoloForm((f) => ({ ...f, saturacaoAluminio: v })))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => salvarSolo.mutate()}
              disabled={!soloForm.dataColeta || salvarSolo.isPending}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {editandoSoloId ? "Salvar alterações" : "Salvar análise de solo"}
            </button>
            {editandoSoloId && (
              <button onClick={cancelarSolo} className="rounded-md border px-4 py-2 text-sm">
                Cancelar
              </button>
            )}
          </div>
        </div>

        <ul className="mt-3 space-y-2">
          {analisesSolo?.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm shadow-sm">
              <span
                title={`pH em ${UNIDADE_SOLO.ph} · P/S em ${UNIDADE_SOLO.fosforo} · Ca/Mg/K em ${UNIDADE_SOLO.potassio}`}
              >
                <span className="font-medium">{new Date(a.dataColeta).toLocaleDateString("pt-BR")}</span>
                {" — "}pH {a.ph ?? "-"}, V% {a.saturacaoBases ?? "-"}, P {a.fosforo ?? "-"}, K {a.potassio ?? "-"}
                {a.laboratorio ? ` (${a.laboratorio})` : ""}
              </span>
              <span className="flex shrink-0 gap-3">
                <button onClick={() => editarSolo(a)} className="text-green-700 hover:underline">
                  Editar
                </button>
                <button
                  onClick={() => {
                    if (confirm("Excluir esta análise de solo? Não pode ser desfeito.")) excluirSolo.mutate(a.id);
                  }}
                  disabled={excluirSolo.isPending}
                  className="text-red-600 hover:underline disabled:opacity-50"
                >
                  Excluir
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-700">Análises foliares</h2>
        <div className="max-w-3xl rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-3 font-semibold">{editandoFoliarId ? "Editar análise" : "Novo lançamento"}</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600">Data de coleta</label>
              <input
                type="date"
                value={foliarForm.dataColeta}
                onChange={(e) => setFoliarForm((f) => ({ ...f, dataColeta: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Estádio fenológico</label>
              <input
                value={foliarForm.estadioFenologico}
                onChange={(e) => setFoliarForm((f) => ({ ...f, estadioFenologico: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            {campoNum("Nitrogênio (N)", UNIDADE_FOLIAR.nitrogenio, foliarForm.nitrogenio, (v) => setFoliarForm((f) => ({ ...f, nitrogenio: v })))}
            {campoNum("Fósforo (P)", UNIDADE_FOLIAR.fosforo, foliarForm.fosforo, (v) => setFoliarForm((f) => ({ ...f, fosforo: v })))}
            {campoNum("Potássio (K)", UNIDADE_FOLIAR.potassio, foliarForm.potassio, (v) => setFoliarForm((f) => ({ ...f, potassio: v })))}
            {campoNum("Cálcio (Ca)", UNIDADE_FOLIAR.calcio, foliarForm.calcio, (v) => setFoliarForm((f) => ({ ...f, calcio: v })))}
            {campoNum("Magnésio (Mg)", UNIDADE_FOLIAR.magnesio, foliarForm.magnesio, (v) => setFoliarForm((f) => ({ ...f, magnesio: v })))}
            {campoNum("Enxofre (S)", UNIDADE_FOLIAR.enxofre, foliarForm.enxofre, (v) => setFoliarForm((f) => ({ ...f, enxofre: v })))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => salvarFoliar.mutate()}
              disabled={!foliarForm.dataColeta || salvarFoliar.isPending}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {editandoFoliarId ? "Salvar alterações" : "Salvar análise foliar"}
            </button>
            {editandoFoliarId && (
              <button onClick={cancelarFoliar} className="rounded-md border px-4 py-2 text-sm">
                Cancelar
              </button>
            )}
          </div>
        </div>

        <ul className="mt-3 space-y-2">
          {analisesFoliar?.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm shadow-sm">
              <span title={`N/P/K/Ca/Mg/S em ${UNIDADE_FOLIAR.nitrogenio}`}>
                <span className="font-medium">{new Date(a.dataColeta).toLocaleDateString("pt-BR")}</span>
                {" — "}N {a.nitrogenio ?? "-"}, P {a.fosforo ?? "-"}, K {a.potassio ?? "-"}
                {a.estadioFenologico ? ` (${a.estadioFenologico})` : ""}
              </span>
              <span className="flex shrink-0 gap-3">
                <button onClick={() => editarFoliar(a)} className="text-green-700 hover:underline">
                  Editar
                </button>
                <button
                  onClick={() => {
                    if (confirm("Excluir esta análise foliar? Não pode ser desfeito.")) excluirFoliar.mutate(a.id);
                  }}
                  disabled={excluirFoliar.isPending}
                  className="text-red-600 hover:underline disabled:opacity-50"
                >
                  Excluir
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
