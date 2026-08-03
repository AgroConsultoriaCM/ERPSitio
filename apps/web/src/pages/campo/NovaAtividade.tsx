import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { fetchComCache } from "../../lib/cachedFetch";
import { api, ApiError } from "../../lib/api";
import { db } from "../../offline/db";
import { ROTULO_TIPO_EXECUTOR } from "../../lib/types";
import type { Executor, GrupoTalhaoResumo, Insumo, Talhao, TipoAtividade } from "../../lib/types";

interface LinhaInsumo {
  insumoId: string;
  quantidade: string;
  quantidadeLevada: string;
  quantidadeRetornada: string;
  unidade: string;
}

type ModoSelecao = "talhoes" | "grupo";

export default function NovaAtividade() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [grupos, setGrupos] = useState<GrupoTalhaoResumo[]>([]);
  const [tipos, setTipos] = useState<TipoAtividade[]>([]);
  const [executores, setExecutores] = useState<Executor[]>([]);
  const [insumosDisponiveis, setInsumosDisponiveis] = useState<Insumo[]>([]);

  const [modo, setModo] = useState<ModoSelecao>("talhoes");
  const [talhaoIds, setTalhaoIds] = useState<string[]>([]);
  const [grupoId, setGrupoId] = useState("");
  const [tipoAtividadeId, setTipoAtividadeId] = useState("");
  const [executorId, setExecutorId] = useState("");
  const [custoMaoDeObra, setCustoMaoDeObra] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [linhasInsumo, setLinhasInsumo] = useState<LinhaInsumo[]>([]);
  // modo "sobra" = declara o que levou e o que voltou; o sistema calcula o uso
  const [modoSobra, setModoSobra] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    fetchComCache<Talhao[]>("talhoes", "/talhoes").then(setTalhoes);
    fetchComCache<GrupoTalhaoResumo[]>("grupos", "/grupos").then(setGrupos);
    fetchComCache<TipoAtividade[]>("tipos-atividade", "/tipos-atividade").then(setTipos);
    fetchComCache<Executor[]>("executores", "/executores").then(setExecutores);
    fetchComCache<Insumo[]>("insumos", "/insumos").then(setInsumosDisponiveis);
  }, []);

  const executorSelecionado = executores.find((e) => e.id === executorId);
  const ehTerceiro = executorSelecionado && executorSelecionado.tipo !== "EQUIPE_PROPRIA";

  function alternarTalhao(id: string) {
    setTalhaoIds((atual) =>
      atual.includes(id) ? atual.filter((t) => t !== id) : [...atual, id],
    );
  }

  function atualizarLinha(index: number, campo: keyof LinhaInsumo, valor: string) {
    setLinhasInsumo((atual) =>
      atual.map((linha, i) => {
        if (i !== index) return linha;
        const nova = { ...linha, [campo]: valor };
        if (campo === "insumoId") {
          nova.unidade = insumosDisponiveis.find((ins) => ins.id === valor)?.unidadeMedida ?? "";
        }
        return nova;
      }),
    );
  }

  const grupoSelecionado = grupos.find((g) => g.id === grupoId);
  const selecaoValida = modo === "talhoes" ? talhaoIds.length > 0 : !!grupoId;

  async function handleSubmit() {
    if (!selecaoValida || !tipoAtividadeId) {
      setMensagem("Selecione o tipo de operação e ao menos um talhão (ou um grupo).");
      return;
    }
    setSalvando(true);
    setMensagem(null);

    const tipo = tipos.find((t) => t.id === tipoAtividadeId);
    const clientId = crypto.randomUUID();
    const agora = new Date().toISOString();

    const insumosValidos = linhasInsumo
      .filter((l) => l.insumoId && (modoSobra ? l.quantidadeLevada : l.quantidade))
      .map((l) =>
        modoSobra
          ? {
              insumoId: l.insumoId,
              quantidadeLevada: Number(l.quantidadeLevada),
              quantidadeRetornada: Number(l.quantidadeRetornada || 0),
              unidade: l.unidade,
            }
          : { insumoId: l.insumoId, quantidade: Number(l.quantidade), unidade: l.unidade },
      );

    const idsTalhao = modo === "talhoes" ? talhaoIds : [];
    const idsGrupo = modo === "grupo" ? [grupoId] : [];

    const payload = {
      clientId,
      tipoAtividadeId,
      talhaoIds: idsTalhao,
      grupoIds: idsGrupo,
      executorId: executorId || undefined,
      custoMaoDeObra: ehTerceiro && custoMaoDeObra ? Number(custoMaoDeObra) : undefined,
      data: agora,
      observacoes: observacoes || undefined,
      origem: "APP" as const,
      insumos: insumosValidos,
    };

    let salvouOnline = false;
    if (navigator.onLine) {
      try {
        await api.post("/atividades", payload);
        salvouOnline = true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) {
          setSalvando(false);
          setMensagem(err.message);
          return;
        }
        // rede instável/servidor fora: cai para a fila offline
      }
    }

    if (!salvouOnline) {
      const descricaoTalhoes =
        modo === "grupo"
          ? `Grupo: ${grupoSelecionado?.nome ?? ""}`
          : talhoes
              .filter((t) => talhaoIds.includes(t.id))
              .map((t) => t.nome)
              .join(", ");

      await db.atividadesPendentes.add({
        clientId,
        tipoAtividadeId,
        talhaoIds: idsTalhao,
        grupoIds: idsGrupo,
        executorId: executorId || null,
        custoMaoDeObra: ehTerceiro && custoMaoDeObra ? Number(custoMaoDeObra) : null,
        data: agora,
        observacoes: observacoes || undefined,
        insumos: insumosValidos,
        descricaoTalhoes,
        tipoAtividadeNome: tipo?.nome ?? "",
        status: "pendente",
        criadoEm: agora,
      });
    }

    setSalvando(false);
    qc.invalidateQueries({ queryKey: ["atividades-hoje"] });
    navigate("/campo");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-green-800">Nova operação</h1>

      {mensagem && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{mensagem}</div>}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de operação</label>
        <select
          value={tipoAtividadeId}
          onChange={(e) => setTipoAtividadeId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-3 text-base"
        >
          <option value="">Selecione...</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setModo("talhoes")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              modo === "talhoes" ? "bg-green-700 text-white" : "bg-white text-gray-600 border"
            }`}
          >
            Escolher talhões
          </button>
          <button
            type="button"
            onClick={() => setModo("grupo")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              modo === "grupo" ? "bg-green-700 text-white" : "bg-white text-gray-600 border"
            }`}
          >
            Usar grupo
          </button>
        </div>

        {modo === "talhoes" ? (
          <div className="space-y-1 rounded-md border border-gray-300 bg-white p-2">
            {talhoes.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-3 rounded-md px-2 py-2.5 active:bg-green-50"
              >
                <input
                  type="checkbox"
                  checked={talhaoIds.includes(t.id)}
                  onChange={() => alternarTalhao(t.id)}
                  className="h-5 w-5"
                />
                <span className="text-base">
                  {t.codigo ? `${t.codigo} · ` : ""}
                  {t.nome}
                </span>
                {t.areaHa != null && (
                  <span className="ml-auto text-xs text-gray-500">{t.areaHa} ha</span>
                )}
              </label>
            ))}
            {talhoes.length === 0 && <p className="p-2 text-sm text-gray-500">Nenhum talhão.</p>}
          </div>
        ) : (
          <>
            <select
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-3 text-base"
            >
              <option value="">Selecione o grupo...</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome} ({g.talhoes.length} talhões)
                </option>
              ))}
            </select>
            {grupoSelecionado && (
              <p className="mt-1 text-xs text-gray-600">
                {grupoSelecionado.talhoes.map((t) => t.nome).join(", ")}
              </p>
            )}
            {grupos.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                Nenhum grupo cadastrado. Peça para cadastrar no painel.
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Quem fez</label>
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

      {ehTerceiro && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Valor do serviço / diária (R$)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={custoMaoDeObra}
            onChange={(e) => setCustoMaoDeObra(e.target.value)}
            placeholder="Ex: 250,00"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base"
          />
          <p className="mt-1 text-xs text-gray-600">
            O valor é dividido entre os talhões proporcionalmente à área de cada um.
          </p>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Produtos usados</label>
          <button
            type="button"
            onClick={() =>
              setLinhasInsumo((a) => [
                ...a,
                { insumoId: "", quantidade: "", quantidadeLevada: "", quantidadeRetornada: "", unidade: "" },
              ])
            }
            className="text-sm font-medium text-green-700"
          >
            + adicionar
          </button>
        </div>

        {linhasInsumo.length > 0 && (
          <label className="mb-2 flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={modoSobra}
              onChange={(e) => setModoSobra(e.target.checked)}
              className="h-4 w-4"
            />
            Declarar o que levei e o que sobrou (pulverização)
          </label>
        )}

        <div className="space-y-2">
          {linhasInsumo.map((linha, index) => {
            const usado =
              modoSobra && linha.quantidadeLevada
                ? Number(linha.quantidadeLevada) - Number(linha.quantidadeRetornada || 0)
                : null;
            return (
              <div key={index} className="rounded-md bg-white p-2">
                <div className="flex items-center gap-2">
                  <select
                    value={linha.insumoId}
                    onChange={(e) => atualizarLinha(index, "insumoId", e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-2 text-sm"
                  >
                    <option value="">Produto...</option>
                    {insumosDisponiveis.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setLinhasInsumo((a) => a.filter((_, i) => i !== index))}
                    className="text-red-500"
                  >
                    ✕
                  </button>
                </div>

                {modoSobra ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-600">Levou</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={linha.quantidadeLevada}
                        onChange={(e) => atualizarLinha(index, "quantidadeLevada", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-600">Voltou</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={linha.quantidadeRetornada}
                        onChange={(e) => atualizarLinha(index, "quantidadeRetornada", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                      />
                    </div>
                    <div className="w-20 text-center">
                      <p className="text-xs text-gray-600">Usou</p>
                      <p className="text-sm font-semibold text-green-800">
                        {usado != null && usado >= 0 ? `${usado} ${linha.unidade}` : "-"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Quantidade usada"
                      value={linha.quantidade}
                      onChange={(e) => atualizarLinha(index, "quantidade", e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-2 text-sm"
                    />
                    <span className="w-10 text-xs text-gray-600">{linha.unidade}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {linhasInsumo.length > 0 && (
          <p className="mt-1 text-xs text-gray-600">
            O custo sai do preço da compra e é rateado entre os talhões por área.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-base"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={salvando}
        className="w-full rounded-md bg-green-700 py-4 text-lg font-semibold text-white disabled:opacity-60"
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
