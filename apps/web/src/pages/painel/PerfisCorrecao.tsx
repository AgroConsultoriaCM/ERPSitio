import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Cultura, PerfilCorrecaoSolo } from "../../lib/types";

const campoNumerico = (
  label: string,
  valor: string,
  onChange: (v: string) => void,
) => (
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

export default function PerfisCorrecao() {
  const qc = useQueryClient();
  const { data: perfis } = useQuery({
    queryKey: ["perfis-correcao"],
    queryFn: () => api.get<PerfilCorrecaoSolo[]>("/perfis-correcao"),
  });
  const { data: culturas } = useQuery({ queryKey: ["culturas"], queryFn: () => api.get<Cultura[]>("/culturas") });

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [culturaId, setCulturaId] = useState("");
  const [campos, setCampos] = useState<Record<string, string>>({
    phIdealMin: "",
    phIdealMax: "",
    materiaOrganicaIdeal: "",
    fosforoIdeal: "",
    potassioIdeal: "",
    calcioIdeal: "",
    magnesioIdeal: "",
    saturacaoBasesIdeal: "",
    ctcReferencia: "",
  });
  const [observacoes, setObservacoes] = useState("");

  function limpar() {
    setEditandoId(null);
    setNome("");
    setCulturaId("");
    setCampos({
      phIdealMin: "",
      phIdealMax: "",
      materiaOrganicaIdeal: "",
      fosforoIdeal: "",
      potassioIdeal: "",
      calcioIdeal: "",
      magnesioIdeal: "",
      saturacaoBasesIdeal: "",
      ctcReferencia: "",
    });
    setObservacoes("");
  }

  function editar(p: PerfilCorrecaoSolo) {
    setEditandoId(p.id);
    setNome(p.nome);
    setCulturaId(p.culturaId);
    setCampos({
      phIdealMin: p.phIdealMin?.toString() ?? "",
      phIdealMax: p.phIdealMax?.toString() ?? "",
      materiaOrganicaIdeal: p.materiaOrganicaIdeal?.toString() ?? "",
      fosforoIdeal: p.fosforoIdeal?.toString() ?? "",
      potassioIdeal: p.potassioIdeal?.toString() ?? "",
      calcioIdeal: p.calcioIdeal?.toString() ?? "",
      magnesioIdeal: p.magnesioIdeal?.toString() ?? "",
      saturacaoBasesIdeal: p.saturacaoBasesIdeal?.toString() ?? "",
      ctcReferencia: p.ctcReferencia?.toString() ?? "",
    });
    setObservacoes(p.observacoes ?? "");
  }

  const salvar = useMutation({
    mutationFn: () => {
      const numOuNull = (v: string) => (v ? Number(v) : null);
      const body = {
        nome,
        culturaId,
        phIdealMin: numOuNull(campos.phIdealMin),
        phIdealMax: numOuNull(campos.phIdealMax),
        materiaOrganicaIdeal: numOuNull(campos.materiaOrganicaIdeal),
        fosforoIdeal: numOuNull(campos.fosforoIdeal),
        potassioIdeal: numOuNull(campos.potassioIdeal),
        calcioIdeal: numOuNull(campos.calcioIdeal),
        magnesioIdeal: numOuNull(campos.magnesioIdeal),
        saturacaoBasesIdeal: numOuNull(campos.saturacaoBasesIdeal),
        ctcReferencia: numOuNull(campos.ctcReferencia),
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
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Perfis de correção de solo</h1>
        <p className="text-sm text-gray-500">
          Faixas ideais por cultura, usadas para comparar automaticamente com as análises de solo dos talhões. Ajuste
          livremente conforme o conhecimento técnico da propriedade.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">{editandoId ? "Editar perfil" : "Novo perfil"}</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Nome do perfil"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={culturaId}
            onChange={(e) => setCulturaId(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Cultura...</option>
            {culturas?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} {c.variedade ? `- ${c.variedade}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {campoNumerico("pH mínimo", campos.phIdealMin, (v) => setCampos((c) => ({ ...c, phIdealMin: v })))}
          {campoNumerico("pH máximo", campos.phIdealMax, (v) => setCampos((c) => ({ ...c, phIdealMax: v })))}
          {campoNumerico("Matéria orgânica ideal", campos.materiaOrganicaIdeal, (v) =>
            setCampos((c) => ({ ...c, materiaOrganicaIdeal: v })),
          )}
          {campoNumerico("Fósforo ideal", campos.fosforoIdeal, (v) => setCampos((c) => ({ ...c, fosforoIdeal: v })))}
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
            disabled={!nome || !culturaId || salvar.isPending}
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
                <td className="px-4 py-2">
                  {p.cultura?.nome} {p.cultura?.variedade ? `- ${p.cultura.variedade}` : ""}
                </td>
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
