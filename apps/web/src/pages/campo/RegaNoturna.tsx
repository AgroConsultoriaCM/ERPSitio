import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { fetchComCache } from "../../lib/cachedFetch";
import { api, ApiError } from "../../lib/api";
import type { RegaNoturnaConfig, SetorIrrigacao } from "../../lib/types";

function duracaoHoras(horaInicio: string, horaFim: string): number {
  const [hIni, mIni] = horaInicio.split(":").map(Number);
  const [hFim, mFim] = horaFim.split(":").map(Number);
  const inicio = hIni * 60 + mIni;
  let fim = hFim * 60 + mFim;
  if (fim <= inicio) fim += 24 * 60; // vira o dia (ex: 21:00 -> 05:00)
  return Math.round(((fim - inicio) / 60) * 100) / 100;
}

export default function RegaNoturna() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [config, setConfig] = useState<RegaNoturnaConfig | null>(null);
  const [setores, setSetores] = useState<SetorIrrigacao[]>([]);
  const [horaInicio, setHoraInicio] = useState("21:00");
  const [horaFim, setHoraFim] = useState("05:00");
  const [setorIds, setSetorIds] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    fetchComCache<RegaNoturnaConfig>("rega-noturna-config", "/rega-noturna/config").then((c) => {
      setConfig(c);
      setHoraInicio(c.horaInicio);
      setHoraFim(c.horaFim);
    });
    fetchComCache<SetorIrrigacao[]>("setores-irrigacao", "/setores-irrigacao").then(setSetores);
  }, []);

  function alternarSetor(id: string) {
    setSetorIds((atual) => (atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]));
  }

  async function handleSubmit() {
    if (setorIds.length === 0) {
      setMensagem("Marque ao menos um setor.");
      return;
    }
    setSalvando(true);
    setMensagem(null);

    try {
      if (config && (horaInicio !== config.horaInicio || horaFim !== config.horaFim)) {
        await api.patch("/rega-noturna/config", { horaInicio, horaFim });
      }
      const horas = duracaoHoras(horaInicio, horaFim);
      const agora = new Date().toISOString();
      for (const setorId of setorIds) {
        await api.post("/irrigacoes", {
          clientId: crypto.randomUUID(),
          setorId,
          data: agora,
          duracaoHoras: horas,
          origem: "APP",
        });
      }
    } catch (err) {
      setSalvando(false);
      setMensagem(
        err instanceof ApiError ? err.message : "Sem sinal agora. Tente de novo quando pegar sinal.",
      );
      return;
    }

    setSalvando(false);
    qc.invalidateQueries({ queryKey: ["irrigacoes"] });
    navigate("/campo");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-sky-700">Rega noturna</h1>

      {mensagem && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{mensagem}</div>}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Início</label>
          <input
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fim (dia seguinte)</label>
          <input
            type="time"
            value={horaFim}
            onChange={(e) => setHoraFim(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base"
          />
        </div>
      </div>
      <p className="text-sm text-gray-600">Duração: {duracaoHoras(horaInicio, horaFim)} horas</p>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Setores que recebem água hoje</label>
        <div className="space-y-1 rounded-md border border-gray-300 bg-white p-2">
          {setores.map((s) => (
            <label key={s.id} className="flex items-center gap-3 rounded-md px-2 py-2.5 active:bg-sky-50">
              <input
                type="checkbox"
                checked={setorIds.includes(s.id)}
                onChange={() => alternarSetor(s.id)}
                className="h-5 w-5"
              />
              <span className="text-base">
                {s.codigo ? `${s.codigo} · ` : ""}
                {s.nome}
              </span>
            </label>
          ))}
          {setores.length === 0 && <p className="p-2 text-sm text-gray-500">Nenhum setor cadastrado.</p>}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={salvando}
        className="w-full rounded-md bg-sky-700 py-4 text-lg font-semibold text-white disabled:opacity-60"
      >
        {salvando ? "Salvando..." : "Salvar rega de hoje"}
      </button>
    </div>
  );
}
