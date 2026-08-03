import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { ROTAS } from "../../lib/rotas";
import { Aviso, Cartao, EstadoVazio, TituloSecao, numero } from "../../components/ui";
import { Droplets } from "lucide-react";
import type { Calda, Insumo, PerfilBomba, RegistroPulverizacao, TipoAtividade, Talhao, Executor } from "../../lib/types";

interface LinhaAdHoc {
  insumoId: string;
  dosePor100L: string;
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

export default function Pulverizacoes() {
  const qc = useQueryClient();
  const { data: registros } = useQuery({
    queryKey: ["pulverizacoes"],
    queryFn: () => api.get<RegistroPulverizacao[]>("/pulverizacoes"),
  });
  const { data: talhoes } = useQuery({ queryKey: ["talhoes"], queryFn: () => api.get<Talhao[]>("/talhoes") });
  const { data: bombas } = useQuery({ queryKey: ["perfis-bomba"], queryFn: () => api.get<PerfilBomba[]>("/perfis-bomba") });
  const { data: caldas } = useQuery({ queryKey: ["caldas"], queryFn: () => api.get<Calda[]>("/caldas") });
  const { data: insumos } = useQuery({ queryKey: ["insumos"], queryFn: () => api.get<Insumo[]>("/insumos") });
  const { data: tipos } = useQuery({ queryKey: ["tipos-atividade"], queryFn: () => api.get<TipoAtividade[]>("/tipos-atividade") });
  const { data: executores } = useQuery({ queryKey: ["executores"], queryFn: () => api.get<Executor[]>("/executores") });

  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipoAtividadeId, setTipoAtividadeId] = useState("");
  const [executorId, setExecutorId] = useState("");
  const [talhaoIds, setTalhaoIds] = useState<string[]>([]);
  const [bombaId, setBombaId] = useState("");
  const [numeroCargas, setNumeroCargas] = useState("");
  const [modoCalda, setModoCalda] = useState<"cadastrada" | "adhoc">("cadastrada");
  const [caldaId, setCaldaId] = useState("");
  const [itensAdHoc, setItensAdHoc] = useState<LinhaAdHoc[]>([{ insumoId: "", dosePor100L: "" }]);
  const [observacoes, setObservacoes] = useState("");

  const tipoPulverizacao = tipos?.find((t) => t.nome.toLowerCase().includes("pulveriz"));

  function limpar() {
    setTalhaoIds([]);
    setBombaId("");
    setNumeroCargas("");
    setCaldaId("");
    setItensAdHoc([{ insumoId: "", dosePor100L: "" }]);
    setObservacoes("");
  }

  const bomba = bombas?.find((b) => b.id === bombaId);
  const volumeTotal = bomba && numeroCargas ? bomba.capacidadeLitros * Number(numeroCargas) : null;

  const lancar = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        data,
        tipoAtividadeId: tipoAtividadeId || tipoPulverizacao?.id,
        executorId: executorId || undefined,
        talhaoIds,
        bombaId,
        numeroCargas: Number(numeroCargas),
        observacoes: observacoes || undefined,
      };
      if (modoCalda === "cadastrada") {
        body.caldaId = caldaId;
      } else {
        body.caldaAdHoc = itensAdHoc
          .filter((i) => i.insumoId && i.dosePor100L)
          .map((i) => ({ insumoId: i.insumoId, dosePor100L: Number(i.dosePor100L) }));
      }
      return api.post("/pulverizacoes", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pulverizacoes"] });
      limpar();
    },
  });

  const itensAdHocValidos = itensAdHoc.filter((i) => i.insumoId && i.dosePor100L);
  const podeLancar =
    (tipoAtividadeId || tipoPulverizacao) &&
    talhaoIds.length > 0 &&
    bombaId &&
    numeroCargas &&
    (modoCalda === "cadastrada" ? !!caldaId : itensAdHocValidos.length > 0);

  return (
    <div className="space-y-6">
      <TituloSecao icone={Droplets} descricao="Bomba, calda e rateio por metros lineares — não por área">
        Pulverizações
      </TituloSecao>

      <Cartao>
        <p className="mb-3 font-semibold text-terra-800">Novo lançamento</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-terra-600">Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full rounded-md border border-terra-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-terra-600">Tipo de operação</label>
            <select
              value={tipoAtividadeId}
              onChange={(e) => setTipoAtividadeId(e.target.value)}
              className="w-full rounded-md border border-terra-300 px-3 py-2 text-sm"
            >
              <option value="">{tipoPulverizacao ? `${tipoPulverizacao.nome} (padrão)` : "Selecione..."}</option>
              {tipos?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-terra-600">Executor (opcional)</label>
            <select value={executorId} onChange={(e) => setExecutorId(e.target.value)} className="w-full rounded-md border border-terra-300 px-3 py-2 text-sm">
              <option value="">Equipe própria</option>
              {executores?.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mb-1.5 mt-4 text-xs font-medium uppercase tracking-wide text-terra-500">
          Talhões percorridos (precisam ter área e espaçamento entre linhas cadastrados)
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {talhoes?.map((t) => (
            <label key={t.id} className="flex items-center gap-2 rounded-md border border-terra-200 px-2 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={talhaoIds.includes(t.id)}
                onChange={(e) =>
                  setTalhaoIds((ids) => (e.target.checked ? [...ids, t.id] : ids.filter((id) => id !== t.id)))
                }
              />
              <span className="flex-1">
                {t.codigo ? `${t.codigo} · ` : ""}
                {t.nome}
                {!t.espacamentoEntreLinhas && <span className="ml-1 text-amber-600">(sem espaçamento)</span>}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-terra-600">Bomba</label>
            <select value={bombaId} onChange={(e) => setBombaId(e.target.value)} className="w-full rounded-md border border-terra-300 px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              {bombas?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome} ({b.capacidadeLitros} L)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-terra-600">Número de cargas (bombas cheias)</label>
            <input
              type="number"
              step="any"
              value={numeroCargas}
              onChange={(e) => setNumeroCargas(e.target.value)}
              className="w-full rounded-md border border-terra-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        {volumeTotal != null && (
          <p className="mt-1.5 text-xs text-terra-600">Volume total: {numero(volumeTotal, 0)} L</p>
        )}

        <div className="mt-4 flex gap-1 rounded-lg bg-terra-100 p-1 text-sm">
          <button
            onClick={() => setModoCalda("cadastrada")}
            className={`flex-1 rounded-md py-1.5 font-medium ${modoCalda === "cadastrada" ? "bg-white shadow-cartao" : "text-terra-600"}`}
          >
            Calda cadastrada
          </button>
          <button
            onClick={() => setModoCalda("adhoc")}
            className={`flex-1 rounded-md py-1.5 font-medium ${modoCalda === "adhoc" ? "bg-white shadow-cartao" : "text-terra-600"}`}
          >
            Montar agora
          </button>
        </div>

        {modoCalda === "cadastrada" ? (
          <select value={caldaId} onChange={(e) => setCaldaId(e.target.value)} className="mt-2 w-full rounded-md border border-terra-300 px-3 py-2 text-sm">
            <option value="">Selecione a calda...</option>
            {caldas?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        ) : (
          <div className="mt-2 space-y-2">
            {itensAdHoc.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <select
                  value={item.insumoId}
                  onChange={(e) => setItensAdHoc((arr) => arr.map((it, i) => (i === idx ? { ...it, insumoId: e.target.value } : it)))}
                  className="flex-1 rounded-md border border-terra-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Produto...</option>
                  {insumos?.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.nome}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  placeholder="dose/100L"
                  value={item.dosePor100L}
                  onChange={(e) => setItensAdHoc((arr) => arr.map((it, i) => (i === idx ? { ...it, dosePor100L: e.target.value } : it)))}
                  className="w-28 rounded-md border border-terra-300 px-2 py-1.5 text-sm"
                />
                {itensAdHoc.length > 1 && (
                  <button onClick={() => setItensAdHoc((arr) => arr.filter((_, i) => i !== idx))} className="text-red-600">
                    ×
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => setItensAdHoc((arr) => [...arr, { insumoId: "", dosePor100L: "" }])} className="text-sm text-mata-700">
              + adicionar produto
            </button>
          </div>
        )}

        <textarea
          placeholder="Observações"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="mt-3 w-full rounded-md border border-terra-300 px-3 py-2 text-sm"
        />

        {lancar.isError && (
          <div className="mt-3">
            <Aviso tom="perigo" titulo="Não foi possível lançar">
              {lancar.error instanceof ApiError ? lancar.error.message : "Erro desconhecido"}
            </Aviso>
          </div>
        )}

        <button
          onClick={() => lancar.mutate()}
          disabled={!podeLancar || lancar.isPending}
          className="mt-4 rounded-md bg-mata-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Lançar pulverização
        </button>
      </Cartao>

      <div>
        <p className="mb-2 font-semibold text-terra-800">Histórico</p>
        {!registros || registros.length === 0 ? (
          <Cartao>
            <EstadoVazio icone={Droplets} titulo="Nenhuma pulverização lançada ainda" descricao="Os lançamentos aparecem aqui, com o rateio por talhão." />
          </Cartao>
        ) : (
          <div className="space-y-2">
            {registros.map((r) => (
              <Cartao key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-terra-800">
                      {dataCurta(r.data)} · {r.bomba?.nome} · {numero(r.volumeTotalLitros, 0)} L
                    </p>
                    <p className="text-sm text-terra-600">
                      {r.calda?.nome ?? "calda montada na hora"} ·{" "}
                      {r.talhoes.map((t) => t.talhao?.nome).join(", ")}
                    </p>
                  </div>
                  <Link to={`${ROTAS.operacoes}`} className="text-sm text-mata-700 hover:underline">
                    ver operação
                  </Link>
                </div>
              </Cartao>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
