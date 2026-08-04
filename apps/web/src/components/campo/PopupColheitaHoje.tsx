import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { RespostaColheitaHoje } from "../../lib/types";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Pergunta simples do dia. Aparece em qualquer tela do campo até ser
 * respondida — não depende de push ter sido concedido, o push é só quem
 * chama atenção pra abrir o app.
 */
export default function PopupColheitaHoje() {
  const qc = useQueryClient();
  const hoje = hojeISO();

  const { data: resposta, isLoading } = useQuery({
    queryKey: ["colheita-hoje", hoje],
    queryFn: () => api.get<RespostaColheitaHoje | null>("/colheita-hoje"),
  });

  async function responder(valor: boolean) {
    await api.post("/colheita-hoje", { resposta: valor });
    qc.invalidateQueries({ queryKey: ["colheita-hoje"] });
  }

  if (isLoading || resposta) return null;

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm animate-surgir-de-baixo rounded-2xl bg-white p-5 shadow-cartao-alto">
        <p className="text-lg font-bold text-terra-800">Hoje iremos colher?</p>
        <p className="mt-1 text-sm text-terra-500">Isso ajuda a lembrar de lançar as colheitas mais tarde.</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => responder(false)}
            className="flex-1 rounded-xl border border-terra-300 py-3 text-base font-semibold text-terra-700 transition active:scale-95"
          >
            Não
          </button>
          <button
            onClick={() => responder(true)}
            className="flex-1 rounded-xl bg-limao-500 py-3 text-base font-semibold text-mata-900 transition active:scale-95"
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  );
}
