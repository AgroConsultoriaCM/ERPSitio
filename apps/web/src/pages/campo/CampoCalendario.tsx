import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check } from "lucide-react";
import { api } from "../../lib/api";
import type { AtividadePlanejada } from "../../lib/types";

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function CampoCalendario() {
  const qc = useQueryClient();
  const { data: tarefas, isLoading } = useQuery({
    queryKey: ["atividades-planejadas"],
    queryFn: () => api.get<AtividadePlanejada[]>("/atividades-planejadas"),
  });

  const concluir = useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean }) =>
      api.patch(`/atividades-planejadas/${id}/concluir`, { concluida }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atividades-planejadas"] }),
  });

  const hoje = hojeISO();
  const abertas = (tarefas ?? []).filter((t) => !t.concluida);

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-terra-400">Carregando…</p>;
  }

  if (abertas.length === 0) {
    return (
      <div className="cartao px-5 py-9 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-terra-100 text-terra-400">
          <Calendar size={22} strokeWidth={1.75} />
        </div>
        <p className="font-semibold text-terra-700">Nada programado</p>
        <p className="mt-1.5 text-sm leading-relaxed text-terra-500">
          Quando a gestão programar uma tarefa, ela aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="escalonar space-y-2">
      {abertas.map((t) => {
        const atrasada = t.data.slice(0, 10) < hoje;
        return (
          <div key={t.id} className="cartao flex items-start gap-3 p-3.5">
            <button
              onClick={() => concluir.mutate({ id: t.id, concluida: true })}
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-terra-300 text-transparent transition active:scale-90 active:border-mata-500 active:bg-mata-500 active:text-white"
              aria-label="Marcar como feita"
            >
              <Check size={16} strokeWidth={3} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-terra-800">{t.titulo}</p>
              <p className={`mt-0.5 text-sm ${atrasada ? "font-semibold text-red-600" : "text-terra-500"}`}>
                {formatarData(t.data)}
                {t.talhao && ` · ${t.talhao.nome}`}
              </p>
              {t.descricao && <p className="mt-1 text-sm text-terra-500">{t.descricao}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
