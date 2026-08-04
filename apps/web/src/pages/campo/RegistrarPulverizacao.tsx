import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { fetchComCache } from "../../lib/cachedFetch";
import { api, ApiError } from "../../lib/api";
import type { Calda, Insumo, PerfilBomba, Talhao, TipoAtividade } from "../../lib/types";

interface ItemAdHoc {
  insumoId: string;
  doseTotalPorCarga: string;
}

export default function RegistrarPulverizacao() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [bombas, setBombas] = useState<PerfilBomba[]>([]);
  const [caldas, setCaldas] = useState<Calda[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [tipos, setTipos] = useState<TipoAtividade[]>([]);

  const [talhaoIds, setTalhaoIds] = useState<string[]>([]);
  const [bombaId, setBombaId] = useState("");
  const [numeroCargas, setNumeroCargas] = useState("");
  const [modoCalda, setModoCalda] = useState<"cadastrada" | "adhoc">("cadastrada");
  const [caldaId, setCaldaId] = useState("");
  const [itensAdHoc, setItensAdHoc] = useState<ItemAdHoc[]>([{ insumoId: "", doseTotalPorCarga: "" }]);
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    fetchComCache<Talhao[]>("talhoes", "/talhoes").then(setTalhoes);
    fetchComCache<PerfilBomba[]>("perfis-bomba", "/perfis-bomba").then(setBombas);
    fetchComCache<Calda[]>("caldas", "/caldas").then(setCaldas);
    fetchComCache<Insumo[]>("insumos", "/insumos").then(setInsumos);
    fetchComCache<TipoAtividade[]>("tipos-atividade", "/tipos-atividade").then(setTipos);
  }, []);

  const tipoPulverizacao = tipos.find((t) => t.nome.toLowerCase().includes("pulveriz"));
  const bomba = bombas.find((b) => b.id === bombaId);
  const volumeTotal = bomba && numeroCargas ? bomba.capacidadeLitros * Number(numeroCargas) : null;

  function alternarTalhao(id: string) {
    setTalhaoIds((atual) => (atual.includes(id) ? atual.filter((t) => t !== id) : [...atual, id]));
  }

  const itensAdHocValidos = itensAdHoc.filter((i) => i.insumoId && i.doseTotalPorCarga);
  const podeLancar =
    tipoPulverizacao &&
    talhaoIds.length > 0 &&
    bombaId &&
    numeroCargas &&
    (modoCalda === "cadastrada" ? !!caldaId : itensAdHocValidos.length > 0);

  async function handleSubmit() {
    if (!podeLancar) {
      setMensagem("Selecione os talhões, a bomba, o número de cargas e a calda.");
      return;
    }
    setSalvando(true);
    setMensagem(null);

    const payload: Record<string, unknown> = {
      clientId: crypto.randomUUID(),
      data: new Date().toISOString(),
      tipoAtividadeId: tipoPulverizacao!.id,
      talhaoIds,
      bombaId,
      numeroCargas: Number(numeroCargas),
      observacoes: observacoes || undefined,
    };
    if (modoCalda === "cadastrada") {
      payload.caldaId = caldaId;
    } else {
      payload.caldaAdHoc = itensAdHocValidos.map((i) => ({
        insumoId: i.insumoId,
        doseTotalPorCarga: Number(i.doseTotalPorCarga),
      }));
    }

    try {
      await api.post("/pulverizacoes", payload);
    } catch (err) {
      setSalvando(false);
      // ponytail: sem fila offline aqui (bomba/calda calcula estoque no
      // servidor) — diferente de colheita/operação simples. Se isso for um
      // problema real no campo, criar /pulverizacoes/sync-lote e uma tabela
      // pulverizacoesPendentes espelhando o padrão de offline/db.ts.
      setMensagem(
        err instanceof ApiError
          ? err.message
          : "Sem sinal agora — pulverização precisa de conexão para calcular a calda. Tente de novo quando pegar sinal.",
      );
      return;
    }

    setSalvando(false);
    qc.invalidateQueries({ queryKey: ["pulverizacoes"] });
    navigate("/campo");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-mata-700">Pulverização</h1>

      {!tipoPulverizacao && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Nenhum tipo de operação chamado "pulverização" está cadastrado. Peça para cadastrar no painel.
        </div>
      )}
      {mensagem && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{mensagem}</div>}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Talhões percorridos</label>
        <div className="space-y-1 rounded-md border border-gray-300 bg-white p-2">
          {talhoes.map((t) => (
            <label key={t.id} className="flex items-center gap-3 rounded-md px-2 py-2.5 active:bg-green-50">
              <input
                type="checkbox"
                checked={talhaoIds.includes(t.id)}
                onChange={() => alternarTalhao(t.id)}
                className="h-5 w-5"
              />
              <span className="text-base">
                {t.codigo ? `${t.codigo} · ` : ""}
                {t.nome}
                {!t.espacamentoEntreLinhas && <span className="ml-1 text-amber-600">(sem espaçamento)</span>}
              </span>
            </label>
          ))}
          {talhoes.length === 0 && <p className="p-2 text-sm text-gray-500">Nenhum talhão.</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Bomba</label>
          <select
            value={bombaId}
            onChange={(e) => setBombaId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base"
          >
            <option value="">Selecione...</option>
            {bombas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome} ({b.capacidadeLitros} L)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nº de cargas</label>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={numeroCargas}
            onChange={(e) => setNumeroCargas(e.target.value)}
            placeholder="Ex: 2"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base"
          />
        </div>
      </div>
      {volumeTotal != null && <p className="text-sm text-gray-600">Volume total: {volumeTotal} L</p>}

      <div>
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setModoCalda("cadastrada")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              modoCalda === "cadastrada" ? "bg-green-700 text-white" : "bg-white text-gray-600 border"
            }`}
          >
            Calda cadastrada
          </button>
          <button
            type="button"
            onClick={() => setModoCalda("adhoc")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              modoCalda === "adhoc" ? "bg-green-700 text-white" : "bg-white text-gray-600 border"
            }`}
          >
            Montar agora
          </button>
        </div>

        {modoCalda === "cadastrada" ? (
          <select
            value={caldaId}
            onChange={(e) => setCaldaId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base"
          >
            <option value="">Selecione a calda...</option>
            {caldas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-600">
              Quanto do produto entra em CADA carga da bomba — o sistema multiplica pelo número de cargas.
            </p>
            {itensAdHoc.map((item, idx) => {
              const unidade = insumos.find((i) => i.id === item.insumoId)?.unidadeMedida;
              return (
                <div key={idx} className="flex items-center gap-2 rounded-md bg-white p-2">
                  <select
                    value={item.insumoId}
                    onChange={(e) =>
                      setItensAdHoc((arr) =>
                        arr.map((it, i) => (i === idx ? { ...it, insumoId: e.target.value } : it)),
                      )
                    }
                    className="flex-1 rounded-md border border-gray-300 px-2 py-2 text-sm"
                  >
                    <option value="">Produto...</option>
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    placeholder="dose/carga"
                    value={item.doseTotalPorCarga}
                    onChange={(e) =>
                      setItensAdHoc((arr) =>
                        arr.map((it, i) => (i === idx ? { ...it, doseTotalPorCarga: e.target.value } : it)),
                      )
                    }
                    className="w-24 rounded-md border border-gray-300 px-2 py-2 text-sm"
                  />
                  {unidade && <span className="w-8 text-xs text-gray-600">{unidade}</span>}
                  {itensAdHoc.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItensAdHoc((arr) => arr.filter((_, i) => i !== idx))}
                      className="text-red-500"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setItensAdHoc((arr) => [...arr, { insumoId: "", doseTotalPorCarga: "" }])}
              className="text-sm font-medium text-green-700"
            >
              + adicionar produto
            </button>
          </div>
        )}
      </div>

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
        disabled={!podeLancar || salvando}
        className="w-full rounded-md bg-mata-700 py-4 text-lg font-semibold text-white disabled:opacity-60"
      >
        {salvando ? "Salvando..." : "Salvar pulverização"}
      </button>
    </div>
  );
}
