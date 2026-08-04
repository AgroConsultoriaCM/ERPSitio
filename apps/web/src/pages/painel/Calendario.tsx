import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Cartao, TituloSecao, EstadoVazio, Etiqueta } from "../../components/ui";
import type { AtividadePlanejada, Talhao } from "../../lib/types";

interface TipoAtividade {
  id: string;
  nome: string;
}
interface Executor {
  id: string;
  nome: string;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export default function Calendario() {
  const qc = useQueryClient();
  const { data: tarefas, isLoading } = useQuery({
    queryKey: ["atividades-planejadas"],
    queryFn: () => api.get<AtividadePlanejada[]>("/atividades-planejadas"),
  });
  const { data: talhoes } = useQuery({ queryKey: ["talhoes"], queryFn: () => api.get<Talhao[]>("/talhoes") });
  const { data: tiposAtividade } = useQuery({
    queryKey: ["tipos-atividade"],
    queryFn: () => api.get<TipoAtividade[]>("/tipos-atividade"),
  });
  const { data: executores } = useQuery({
    queryKey: ["executores"],
    queryFn: () => api.get<Executor[]>("/executores"),
  });

  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(hojeISO());
  const [talhaoId, setTalhaoId] = useState("");
  const [tipoAtividadeId, setTipoAtividadeId] = useState("");
  const [executorId, setExecutorId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);

  function limpar() {
    setTitulo("");
    setData(hojeISO());
    setTalhaoId("");
    setTipoAtividadeId("");
    setExecutorId("");
    setDescricao("");
  }

  const criar = useMutation({
    mutationFn: () =>
      api.post("/atividades-planejadas", {
        titulo,
        data,
        talhaoId: talhaoId || undefined,
        tipoAtividadeId: tipoAtividadeId || undefined,
        executorId: executorId || undefined,
        descricao: descricao || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atividades-planejadas"] });
      limpar();
    },
  });

  const concluir = useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean }) =>
      api.patch(`/atividades-planejadas/${id}/concluir`, { concluida }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atividades-planejadas"] }),
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/atividades-planejadas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atividades-planejadas"] }),
  });

  const visiveis = (tarefas ?? []).filter((t) => mostrarConcluidas || !t.concluida);
  const hoje = hojeISO();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-terra-900">Calendário</h1>
        <p className="mt-1 text-sm text-terra-500">
          Programe o que precisa ser feito — o encarregado vê isto como lista de tarefas no celular.
        </p>
      </div>

      <Cartao className="max-w-2xl">
        <TituloSecao icone={Plus}>Nova tarefa</TituloSecao>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            placeholder="O que precisa ser feito"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-terra-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded-lg border border-terra-300 px-3 py-2 text-sm"
          />
          <select
            value={talhaoId}
            onChange={(e) => setTalhaoId(e.target.value)}
            className="rounded-lg border border-terra-300 px-3 py-2 text-sm"
          >
            <option value="">Talhão (opcional)</option>
            {talhoes?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          <select
            value={tipoAtividadeId}
            onChange={(e) => setTipoAtividadeId(e.target.value)}
            className="rounded-lg border border-terra-300 px-3 py-2 text-sm"
          >
            <option value="">Tipo de manejo (opcional)</option>
            {tiposAtividade?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          <select
            value={executorId}
            onChange={(e) => setExecutorId(e.target.value)}
            className="rounded-lg border border-terra-300 px-3 py-2 text-sm"
          >
            <option value="">Responsável (opcional)</option>
            {executores?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Detalhes (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            className="sm:col-span-2 rounded-lg border border-terra-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => criar.mutate()}
          disabled={!titulo || !data || criar.isPending}
          className="mt-3 rounded-lg bg-mata-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mata-700 disabled:opacity-60"
        >
          Programar
        </button>
      </Cartao>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight text-terra-900">Tarefas</h2>
          <label className="flex items-center gap-2 text-sm text-terra-600">
            <input
              type="checkbox"
              checked={mostrarConcluidas}
              onChange={(e) => setMostrarConcluidas(e.target.checked)}
            />
            Mostrar concluídas
          </label>
        </div>

        {!isLoading && visiveis.length === 0 && (
          <EstadoVazio
            icone={CalendarClock}
            titulo="Nada programado"
            descricao="Use o formulário acima para agendar a próxima operação, pulverização ou colheita."
          />
        )}

        <ul className="space-y-2">
          {visiveis.map((t) => {
            const atrasada = !t.concluida && t.data.slice(0, 10) < hoje;
            return (
              <li
                key={t.id}
                className={`cartao flex items-start gap-3 p-3.5 ${t.concluida ? "opacity-60" : ""}`}
              >
                <button
                  onClick={() => concluir.mutate({ id: t.id, concluida: !t.concluida })}
                  title={t.concluida ? "Reabrir" : "Marcar como feita"}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    t.concluida
                      ? "border-mata-500 bg-mata-500 text-white"
                      : "border-terra-300 text-transparent hover:border-mata-400"
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-semibold text-terra-800 ${t.concluida ? "line-through" : ""}`}>
                      {t.titulo}
                    </p>
                    <Etiqueta tom={atrasada ? "perigo" : "neutro"}>{formatarData(t.data)}</Etiqueta>
                    {t.talhao && <Etiqueta tom="mata">{t.talhao.nome}</Etiqueta>}
                    {t.tipoAtividade && <Etiqueta>{t.tipoAtividade.nome}</Etiqueta>}
                  </div>
                  {t.descricao && <p className="mt-1 text-sm text-terra-500">{t.descricao}</p>}
                  {t.executor && <p className="mt-0.5 text-xs text-terra-400">{t.executor.nome}</p>}
                </div>
                <button
                  onClick={() => remover.mutate(t.id)}
                  className="shrink-0 text-terra-400 transition hover:text-red-600"
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
