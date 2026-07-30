import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { fetchComCache } from "../../lib/cachedFetch";
import { api, ApiError } from "../../lib/api";
import { db } from "../../offline/db";
import { ROTULO_TIPO_EXECUTOR } from "../../lib/types";
import type { Executor, Talhao } from "../../lib/types";

export default function RegistrarColheita() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [executores, setExecutores] = useState<Executor[]>([]);

  const [talhaoId, setTalhaoId] = useState("");
  const [quantidadeCaixas, setQuantidadeCaixas] = useState("");
  const [executorId, setExecutorId] = useState("");
  const [valorPorCaixa, setValorPorCaixa] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    fetchComCache<Talhao[]>("talhoes", "/talhoes").then(setTalhoes);
    fetchComCache<Executor[]>("executores", "/executores").then(setExecutores);
  }, []);

  const executorSelecionado = executores.find((e) => e.id === executorId);
  const ehEmpreiteiro = executorSelecionado && executorSelecionado.tipo !== "EQUIPE_PROPRIA";

  const caixas = Number(quantidadeCaixas) || 0;
  const valorCx = Number(valorPorCaixa) || 0;
  const custoPrevisto = ehEmpreiteiro && caixas > 0 && valorCx > 0 ? caixas * valorCx : null;

  async function handleSubmit() {
    if (!talhaoId || !quantidadeCaixas) {
      setMensagem("Selecione o talhão e informe a quantidade de caixas.");
      return;
    }
    setSalvando(true);
    setMensagem(null);

    const clientId = crypto.randomUUID();
    const agora = new Date().toISOString();
    const talhao = talhoes.find((t) => t.id === talhaoId);

    const payload = {
      clientId,
      talhaoId,
      data: agora,
      quantidadeCaixas: Number(quantidadeCaixas),
      executorId: executorId || undefined,
      valorPorCaixa: ehEmpreiteiro && valorPorCaixa ? Number(valorPorCaixa) : undefined,
      observacoes: observacoes || undefined,
      origem: "APP" as const,
    };

    let salvouOnline = false;
    if (navigator.onLine) {
      try {
        await api.post("/colheitas", payload);
        salvouOnline = true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) {
          setSalvando(false);
          setMensagem(err.message);
          return;
        }
        // demais falhas caem para a fila offline
      }
    }

    if (!salvouOnline) {
      await db.colheitasPendentes.add({
        clientId,
        talhaoId,
        data: agora,
        quantidadeCaixas: Number(quantidadeCaixas),
        executorId: executorId || null,
        valorPorCaixa: ehEmpreiteiro && valorPorCaixa ? Number(valorPorCaixa) : null,
        observacoes: observacoes || undefined,
        talhaoNome: talhao?.nome ?? "",
        executorNome: executorSelecionado?.nome,
        status: "pendente",
        criadoEm: agora,
      });
    }

    setSalvando(false);
    qc.invalidateQueries({ queryKey: ["colheitas-hoje"] });
    navigate("/campo");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-amber-700">Registrar colheita</h1>

      {mensagem && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{mensagem}</div>}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Talhão colhido</label>
        <select
          value={talhaoId}
          onChange={(e) => setTalhaoId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-3 text-base"
        >
          <option value="">Selecione...</option>
          {talhoes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo ? `${t.codigo} · ` : ""}
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Caixas colhidas</label>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={quantidadeCaixas}
          onChange={(e) => setQuantidadeCaixas(e.target.value)}
          placeholder="Ex: 120"
          className="w-full rounded-md border border-gray-300 px-3 py-3 text-lg"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Quem colheu</label>
        <select
          value={executorId}
          onChange={(e) => setExecutorId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-3 text-base"
        >
          <option value="">Selecione...</option>
          {executores.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome} ({ROTULO_TIPO_EXECUTOR[e.tipo]})
            </option>
          ))}
        </select>
      </div>

      {ehEmpreiteiro && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Valor por caixa (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={valorPorCaixa}
            onChange={(e) => setValorPorCaixa(e.target.value)}
            placeholder="Ex: 3,50"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-lg"
          />
          {custoPrevisto != null && (
            <p className="mt-1 text-sm font-medium text-amber-800">
              Custo da colheita: R${" "}
              {custoPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={salvando}
        className="w-full rounded-md bg-amber-600 py-4 text-lg font-semibold text-white disabled:opacity-60"
      >
        {salvando ? "Salvando..." : "Salvar colheita"}
      </button>

      <p className="text-center text-xs text-gray-500">
        Pode lançar várias vezes no mesmo dia, em talhões diferentes ou com outro empreiteiro.
      </p>
    </div>
  );
}
