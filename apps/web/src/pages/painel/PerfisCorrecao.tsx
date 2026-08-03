import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Cultura, PerfilCorrecaoFoliar, PerfilCorrecaoSolo } from "../../lib/types";

const MICRONUTRIENTES = [
  ["boro", "Boro ideal"],
  ["cobre", "Cobre ideal"],
  ["ferro", "Ferro ideal"],
  ["manganes", "Manganês ideal"],
  ["zinco", "Zinco ideal"],
] as const;

/** Painel padrão de micronutrientes foliares (Malavolta): B, Cu, Fe, Mn, Mo, Zn. */
const MICRONUTRIENTES_FOLIAR = [
  ["boro", "Boro ideal"],
  ["cobre", "Cobre ideal"],
  ["ferro", "Ferro ideal"],
  ["manganes", "Manganês ideal"],
  ["molibdenio", "Molibdênio ideal"],
  ["zinco", "Zinco ideal"],
] as const;

const campoNumerico = (label: string, valor: string, onChange: (v: string) => void) => (
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

const campoFaixa = (
  label: string,
  min: string,
  max: string,
  onMin: (v: string) => void,
  onMax: (v: string) => void,
) => (
  <div>
    <label className="mb-1 block text-xs text-gray-500">{label}</label>
    <div className="flex gap-1">
      <input
        type="number"
        step="any"
        placeholder="mín."
        value={min}
        onChange={(e) => onMin(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
      <input
        type="number"
        step="any"
        placeholder="máx."
        value={max}
        onChange={(e) => onMax(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
    </div>
  </div>
);

function SeletorCultura({
  nomesCultura,
  value,
  onChange,
}: {
  nomesCultura: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
    >
      <option value="">Cultura...</option>
      {nomesCultura.map((nome) => (
        <option key={nome} value={nome}>
          {nome}
        </option>
      ))}
    </select>
  );
}

const CAMPOS_SOLO_VAZIOS = {
  phIdealMin: "",
  phIdealMax: "",
  materiaOrganicaIdeal: "",
  fosforoIdeal: "",
  enxofreIdeal: "",
  potassioIdeal: "",
  calcioIdeal: "",
  magnesioIdeal: "",
  saturacaoBasesIdeal: "",
  ctcReferencia: "",
  relacaoCaMgIdeal: "",
  relacaoMgKIdeal: "",
  relacaoCaMgKIdeal: "",
};

const MICROS_VAZIOS: Record<string, string> = { boro: "", cobre: "", ferro: "", manganes: "", zinco: "" };

function PainelSolo({ nomesCultura }: { nomesCultura: string[] }) {
  const qc = useQueryClient();
  const { data: perfis } = useQuery({
    queryKey: ["perfis-correcao"],
    queryFn: () => api.get<PerfilCorrecaoSolo[]>("/perfis-correcao"),
  });

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [culturaNome, setCulturaNome] = useState("");
  const [campos, setCampos] = useState<Record<string, string>>(CAMPOS_SOLO_VAZIOS);
  const [micros, setMicros] = useState<Record<string, string>>(MICROS_VAZIOS);
  const [observacoes, setObservacoes] = useState("");

  function limpar() {
    setEditandoId(null);
    setNome("");
    setCulturaNome("");
    setCampos(CAMPOS_SOLO_VAZIOS);
    setMicros(MICROS_VAZIOS);
    setObservacoes("");
  }

  function editar(p: PerfilCorrecaoSolo) {
    setEditandoId(p.id);
    setNome(p.nome);
    setCulturaNome(p.culturaNome);
    setCampos({
      phIdealMin: p.phIdealMin?.toString() ?? "",
      phIdealMax: p.phIdealMax?.toString() ?? "",
      materiaOrganicaIdeal: p.materiaOrganicaIdeal?.toString() ?? "",
      fosforoIdeal: p.fosforoIdeal?.toString() ?? "",
      enxofreIdeal: p.enxofreIdeal?.toString() ?? "",
      potassioIdeal: p.potassioIdeal?.toString() ?? "",
      calcioIdeal: p.calcioIdeal?.toString() ?? "",
      magnesioIdeal: p.magnesioIdeal?.toString() ?? "",
      saturacaoBasesIdeal: p.saturacaoBasesIdeal?.toString() ?? "",
      ctcReferencia: p.ctcReferencia?.toString() ?? "",
      relacaoCaMgIdeal: p.relacaoCaMgIdeal?.toString() ?? "",
      relacaoMgKIdeal: p.relacaoMgKIdeal?.toString() ?? "",
      relacaoCaMgKIdeal: p.relacaoCaMgKIdeal?.toString() ?? "",
    });
    setMicros({
      boro: p.micronutrientesIdeais?.boro?.toString() ?? "",
      cobre: p.micronutrientesIdeais?.cobre?.toString() ?? "",
      ferro: p.micronutrientesIdeais?.ferro?.toString() ?? "",
      manganes: p.micronutrientesIdeais?.manganes?.toString() ?? "",
      zinco: p.micronutrientesIdeais?.zinco?.toString() ?? "",
    });
    setObservacoes(p.observacoes ?? "");
  }

  const salvar = useMutation({
    mutationFn: () => {
      const numOuNull = (v: string) => (v ? Number(v) : null);
      const micronutrientesIdeais = Object.fromEntries(
        Object.entries(micros).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]),
      );
      const body = {
        nome,
        culturaNome,
        phIdealMin: numOuNull(campos.phIdealMin),
        phIdealMax: numOuNull(campos.phIdealMax),
        materiaOrganicaIdeal: numOuNull(campos.materiaOrganicaIdeal),
        fosforoIdeal: numOuNull(campos.fosforoIdeal),
        enxofreIdeal: numOuNull(campos.enxofreIdeal),
        potassioIdeal: numOuNull(campos.potassioIdeal),
        calcioIdeal: numOuNull(campos.calcioIdeal),
        magnesioIdeal: numOuNull(campos.magnesioIdeal),
        saturacaoBasesIdeal: numOuNull(campos.saturacaoBasesIdeal),
        ctcReferencia: numOuNull(campos.ctcReferencia),
        relacaoCaMgIdeal: numOuNull(campos.relacaoCaMgIdeal),
        relacaoMgKIdeal: numOuNull(campos.relacaoMgKIdeal),
        relacaoCaMgKIdeal: numOuNull(campos.relacaoCaMgKIdeal),
        micronutrientesIdeais: Object.keys(micronutrientesIdeais).length ? micronutrientesIdeais : null,
        observacoes: observacoes || undefined,
      };
      return editandoId ? api.patch(`/perfis-correcao/${editandoId}`, body) : api.post("/perfis-correcao", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perfis-correcao"] });
      limpar();
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/perfis-correcao/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perfis-correcao"] }),
  });

  return (
    <div className="space-y-6">
      <div className="max-w-2xl rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">{editandoId ? "Editar perfil de solo" : "Novo perfil de solo"}</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Nome do perfil"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <SeletorCultura nomesCultura={nomesCultura} value={culturaNome} onChange={setCulturaNome} />
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">Macronutrientes e pH</p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {campoNumerico("pH mínimo", campos.phIdealMin, (v) => setCampos((c) => ({ ...c, phIdealMin: v })))}
          {campoNumerico("pH máximo", campos.phIdealMax, (v) => setCampos((c) => ({ ...c, phIdealMax: v })))}
          {campoNumerico("Matéria orgânica ideal", campos.materiaOrganicaIdeal, (v) =>
            setCampos((c) => ({ ...c, materiaOrganicaIdeal: v })),
          )}
          {campoNumerico("Fósforo ideal", campos.fosforoIdeal, (v) => setCampos((c) => ({ ...c, fosforoIdeal: v })))}
          {campoNumerico("Enxofre ideal", campos.enxofreIdeal, (v) => setCampos((c) => ({ ...c, enxofreIdeal: v })))}
          {campoNumerico("Potássio ideal", campos.potassioIdeal, (v) =>
            setCampos((c) => ({ ...c, potassioIdeal: v })),
          )}
          {campoNumerico("Cálcio ideal", campos.calcioIdeal, (v) => setCampos((c) => ({ ...c, calcioIdeal: v })))}
          {campoNumerico("Magnésio ideal", campos.magnesioIdeal, (v) =>
            setCampos((c) => ({ ...c, magnesioIdeal: v })),
          )}
          {campoNumerico("Saturação por bases ideal (V%)", campos.saturacaoBasesIdeal, (v) =>
            setCampos((c) => ({ ...c, saturacaoBasesIdeal: v })),
          )}
          {campoNumerico("CTC de referência", campos.ctcReferencia, (v) =>
            setCampos((c) => ({ ...c, ctcReferencia: v })),
          )}
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">
          Relações (equilíbrio catiônico)
        </p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {campoNumerico("Relação Ca/Mg ideal", campos.relacaoCaMgIdeal, (v) =>
            setCampos((c) => ({ ...c, relacaoCaMgIdeal: v })),
          )}
          {campoNumerico("Relação Mg/K ideal", campos.relacaoMgKIdeal, (v) =>
            setCampos((c) => ({ ...c, relacaoMgKIdeal: v })),
          )}
          {campoNumerico("Relação (Ca+Mg)/K ideal", campos.relacaoCaMgKIdeal, (v) =>
            setCampos((c) => ({ ...c, relacaoCaMgKIdeal: v })),
          )}
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">Micronutrientes</p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {MICRONUTRIENTES.map(([chave, label]) =>
            campoNumerico(label, micros[chave], (v) => setMicros((c) => ({ ...c, [chave]: v }))),
          )}
        </div>

        <textarea
          placeholder="Observações"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => salvar.mutate()}
            disabled={!nome || !culturaNome || salvar.isPending}
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
              <th className="px-4 py-2">Cultura</th>
              <th className="px-4 py-2">pH ideal</th>
              <th className="px-4 py-2">V% ideal</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {perfis?.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.nome}</td>
                <td className="px-4 py-2">{p.culturaNome}</td>
                <td className="px-4 py-2">
                  {p.phIdealMin ?? "-"} – {p.phIdealMax ?? "-"}
                </td>
                <td className="px-4 py-2">{p.saturacaoBasesIdeal ?? "-"}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => editar(p)} className="mr-3 text-green-700">
                    Editar
                  </button>
                  <button onClick={() => remover.mutate(p.id)} className="text-red-600">
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

const CAMPOS_FOLIAR_VAZIOS = {
  nitrogenioIdealMin: "",
  nitrogenioIdealMax: "",
  fosforoIdealMin: "",
  fosforoIdealMax: "",
  potassioIdealMin: "",
  potassioIdealMax: "",
  calcioIdealMin: "",
  calcioIdealMax: "",
  magnesioIdealMin: "",
  magnesioIdealMax: "",
  enxofreIdealMin: "",
  enxofreIdealMax: "",
  boroIdealMin: "",
  boroIdealMax: "",
  cobreIdealMin: "",
  cobreIdealMax: "",
  ferroIdealMin: "",
  ferroIdealMax: "",
  manganesIdealMin: "",
  manganesIdealMax: "",
  molibdenioIdealMin: "",
  molibdenioIdealMax: "",
  zincoIdealMin: "",
  zincoIdealMax: "",
};

function PainelFoliar({ nomesCultura }: { nomesCultura: string[] }) {
  const qc = useQueryClient();
  const { data: perfis } = useQuery({
    queryKey: ["perfis-correcao-foliar"],
    queryFn: () => api.get<PerfilCorrecaoFoliar[]>("/perfis-correcao-foliar"),
  });

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [culturaNome, setCulturaNome] = useState("");
  const [campos, setCampos] = useState<Record<string, string>>(CAMPOS_FOLIAR_VAZIOS);
  const [observacoes, setObservacoes] = useState("");

  function limpar() {
    setEditandoId(null);
    setNome("");
    setCulturaNome("");
    setCampos(CAMPOS_FOLIAR_VAZIOS);
    setObservacoes("");
  }

  function editar(p: PerfilCorrecaoFoliar) {
    setEditandoId(p.id);
    setNome(p.nome);
    setCulturaNome(p.culturaNome);
    setCampos({
      nitrogenioIdealMin: p.nitrogenioIdealMin?.toString() ?? "",
      nitrogenioIdealMax: p.nitrogenioIdealMax?.toString() ?? "",
      fosforoIdealMin: p.fosforoIdealMin?.toString() ?? "",
      fosforoIdealMax: p.fosforoIdealMax?.toString() ?? "",
      potassioIdealMin: p.potassioIdealMin?.toString() ?? "",
      potassioIdealMax: p.potassioIdealMax?.toString() ?? "",
      calcioIdealMin: p.calcioIdealMin?.toString() ?? "",
      calcioIdealMax: p.calcioIdealMax?.toString() ?? "",
      magnesioIdealMin: p.magnesioIdealMin?.toString() ?? "",
      magnesioIdealMax: p.magnesioIdealMax?.toString() ?? "",
      enxofreIdealMin: p.enxofreIdealMin?.toString() ?? "",
      enxofreIdealMax: p.enxofreIdealMax?.toString() ?? "",
      boroIdealMin: p.boroIdealMin?.toString() ?? "",
      boroIdealMax: p.boroIdealMax?.toString() ?? "",
      cobreIdealMin: p.cobreIdealMin?.toString() ?? "",
      cobreIdealMax: p.cobreIdealMax?.toString() ?? "",
      ferroIdealMin: p.ferroIdealMin?.toString() ?? "",
      ferroIdealMax: p.ferroIdealMax?.toString() ?? "",
      manganesIdealMin: p.manganesIdealMin?.toString() ?? "",
      manganesIdealMax: p.manganesIdealMax?.toString() ?? "",
      molibdenioIdealMin: p.molibdenioIdealMin?.toString() ?? "",
      molibdenioIdealMax: p.molibdenioIdealMax?.toString() ?? "",
      zincoIdealMin: p.zincoIdealMin?.toString() ?? "",
      zincoIdealMax: p.zincoIdealMax?.toString() ?? "",
    });
    setObservacoes(p.observacoes ?? "");
  }

  const salvar = useMutation({
    mutationFn: () => {
      const numOuNull = (v: string) => (v ? Number(v) : null);
      const body = {
        nome,
        culturaNome,
        nitrogenioIdealMin: numOuNull(campos.nitrogenioIdealMin),
        nitrogenioIdealMax: numOuNull(campos.nitrogenioIdealMax),
        fosforoIdealMin: numOuNull(campos.fosforoIdealMin),
        fosforoIdealMax: numOuNull(campos.fosforoIdealMax),
        potassioIdealMin: numOuNull(campos.potassioIdealMin),
        potassioIdealMax: numOuNull(campos.potassioIdealMax),
        calcioIdealMin: numOuNull(campos.calcioIdealMin),
        calcioIdealMax: numOuNull(campos.calcioIdealMax),
        magnesioIdealMin: numOuNull(campos.magnesioIdealMin),
        magnesioIdealMax: numOuNull(campos.magnesioIdealMax),
        enxofreIdealMin: numOuNull(campos.enxofreIdealMin),
        enxofreIdealMax: numOuNull(campos.enxofreIdealMax),
        boroIdealMin: numOuNull(campos.boroIdealMin),
        boroIdealMax: numOuNull(campos.boroIdealMax),
        cobreIdealMin: numOuNull(campos.cobreIdealMin),
        cobreIdealMax: numOuNull(campos.cobreIdealMax),
        ferroIdealMin: numOuNull(campos.ferroIdealMin),
        ferroIdealMax: numOuNull(campos.ferroIdealMax),
        manganesIdealMin: numOuNull(campos.manganesIdealMin),
        manganesIdealMax: numOuNull(campos.manganesIdealMax),
        molibdenioIdealMin: numOuNull(campos.molibdenioIdealMin),
        molibdenioIdealMax: numOuNull(campos.molibdenioIdealMax),
        zincoIdealMin: numOuNull(campos.zincoIdealMin),
        zincoIdealMax: numOuNull(campos.zincoIdealMax),
        observacoes: observacoes || undefined,
      };
      return editandoId
        ? api.patch(`/perfis-correcao-foliar/${editandoId}`, body)
        : api.post("/perfis-correcao-foliar", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perfis-correcao-foliar"] });
      limpar();
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/perfis-correcao-foliar/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perfis-correcao-foliar"] }),
  });

  return (
    <div className="space-y-6">
      <div className="max-w-2xl rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">{editandoId ? "Editar perfil foliar" : "Novo perfil foliar"}</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Nome do perfil"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <SeletorCultura nomesCultura={nomesCultura} value={culturaNome} onChange={setCulturaNome} />
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">
          Faixa ideal (mínimo e máximo) por nutriente
        </p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {campoFaixa(
            "Nitrogênio ideal",
            campos.nitrogenioIdealMin,
            campos.nitrogenioIdealMax,
            (v) => setCampos((c) => ({ ...c, nitrogenioIdealMin: v })),
            (v) => setCampos((c) => ({ ...c, nitrogenioIdealMax: v })),
          )}
          {campoFaixa(
            "Fósforo ideal",
            campos.fosforoIdealMin,
            campos.fosforoIdealMax,
            (v) => setCampos((c) => ({ ...c, fosforoIdealMin: v })),
            (v) => setCampos((c) => ({ ...c, fosforoIdealMax: v })),
          )}
          {campoFaixa(
            "Potássio ideal",
            campos.potassioIdealMin,
            campos.potassioIdealMax,
            (v) => setCampos((c) => ({ ...c, potassioIdealMin: v })),
            (v) => setCampos((c) => ({ ...c, potassioIdealMax: v })),
          )}
          {campoFaixa(
            "Cálcio ideal",
            campos.calcioIdealMin,
            campos.calcioIdealMax,
            (v) => setCampos((c) => ({ ...c, calcioIdealMin: v })),
            (v) => setCampos((c) => ({ ...c, calcioIdealMax: v })),
          )}
          {campoFaixa(
            "Magnésio ideal",
            campos.magnesioIdealMin,
            campos.magnesioIdealMax,
            (v) => setCampos((c) => ({ ...c, magnesioIdealMin: v })),
            (v) => setCampos((c) => ({ ...c, magnesioIdealMax: v })),
          )}
          {campoFaixa(
            "Enxofre ideal",
            campos.enxofreIdealMin,
            campos.enxofreIdealMax,
            (v) => setCampos((c) => ({ ...c, enxofreIdealMin: v })),
            (v) => setCampos((c) => ({ ...c, enxofreIdealMax: v })),
          )}
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">Micronutrientes</p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {MICRONUTRIENTES_FOLIAR.map(([chave, label]) =>
            campoFaixa(
              label,
              campos[`${chave}IdealMin`],
              campos[`${chave}IdealMax`],
              (v) => setCampos((c) => ({ ...c, [`${chave}IdealMin`]: v })),
              (v) => setCampos((c) => ({ ...c, [`${chave}IdealMax`]: v })),
            ),
          )}
        </div>

        <textarea
          placeholder="Observações"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => salvar.mutate()}
            disabled={!nome || !culturaNome || salvar.isPending}
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
              <th className="px-4 py-2">Cultura</th>
              <th className="px-4 py-2">Nitrogênio ideal</th>
              <th className="px-4 py-2">Potássio ideal</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {perfis?.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.nome}</td>
                <td className="px-4 py-2">{p.culturaNome}</td>
                <td className="px-4 py-2">
                  {p.nitrogenioIdealMin ?? "-"} – {p.nitrogenioIdealMax ?? "-"}
                </td>
                <td className="px-4 py-2">
                  {p.potassioIdealMin ?? "-"} – {p.potassioIdealMax ?? "-"}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => editar(p)} className="mr-3 text-green-700">
                    Editar
                  </button>
                  <button onClick={() => remover.mutate(p.id)} className="text-red-600">
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

export default function PerfisCorrecao() {
  const { data: culturas } = useQuery({ queryKey: ["culturas"], queryFn: () => api.get<Cultura[]>("/culturas") });
  const nomesCultura = useMemo(
    () => Array.from(new Set((culturas ?? []).map((c) => c.nome))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [culturas],
  );

  const [aba, setAba] = useState<"solo" | "foliar">("solo");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Perfis de correção</h1>
        <p className="text-sm text-gray-500">
          Valores ideais por cultura, usados para comparar automaticamente com as análises dos talhões. O perfil vale
          pela espécie (Limão, Abacate) — não por variedade, então uma variedade nova não exige perfil novo.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setAba("solo")}
          className={`px-4 py-2 text-sm font-medium ${
            aba === "solo" ? "border-b-2 border-green-700 text-green-700" : "text-gray-500"
          }`}
        >
          Análise de solo
        </button>
        <button
          onClick={() => setAba("foliar")}
          className={`px-4 py-2 text-sm font-medium ${
            aba === "foliar" ? "border-b-2 border-green-700 text-green-700" : "text-gray-500"
          }`}
        >
          Análise foliar
        </button>
      </div>

      {aba === "solo" ? (
        <>
          <p className="text-sm text-gray-500">Um valor ideal por nutriente — a análise de solo compara contra ele.</p>
          <PainelSolo nomesCultura={nomesCultura} />
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            Faixa (mínimo e máximo) por nutriente — a análise foliar é interpretada como dentro ou fora da faixa.
          </p>
          <PainelFoliar nomesCultura={nomesCultura} />
        </>
      )}
    </div>
  );
}
