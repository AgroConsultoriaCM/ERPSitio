import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { ROTULO_MODALIDADE_PAGAMENTO_COLHEITA, ROTULO_TIPO_EXECUTOR } from "../../lib/types";
import type { Executor, ModalidadePagamentoColheita, TipoExecutor } from "../../lib/types";

const tipos: TipoExecutor[] = ["EQUIPE_PROPRIA", "EMPREITEIRO", "PRESTADOR_SERVICO"];
const modalidades: ModalidadePagamentoColheita[] = ["POR_CAIXA", "POR_CAIXA_PESO"];

export default function Executores() {
  const qc = useQueryClient();
  const { data: executores } = useQuery({
    queryKey: ["executores", "todos"],
    queryFn: () => api.get<Executor[]>("/executores?incluirInativos=true"),
  });

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoExecutor>("EMPREITEIRO");
  const [modalidadePagamentoColheita, setModalidadePagamentoColheita] =
    useState<ModalidadePagamentoColheita>("POR_CAIXA");
  const [contato, setContato] = useState("");
  const [observacoes, setObservacoes] = useState("");

  function limpar() {
    setEditandoId(null);
    setNome("");
    setTipo("EMPREITEIRO");
    setModalidadePagamentoColheita("POR_CAIXA");
    setContato("");
    setObservacoes("");
  }

  const salvar = useMutation({
    mutationFn: () => {
      const body = {
        nome,
        tipo,
        modalidadePagamentoColheita,
        contato: contato || undefined,
        observacoes: observacoes || undefined,
      };
      return editandoId ? api.patch(`/executores/${editandoId}`, body) : api.post("/executores", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["executores"] });
      limpar();
    },
  });

  const alternarAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      api.patch(`/executores/${id}`, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["executores"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Executores</h1>
        <p className="text-sm text-gray-600">
          Quem realiza os serviços: sua própria equipe, empreiteiros de colheita e prestadores. Cadastrar aqui evita
          redigitar o nome a cada lançamento e permite ver o custo por prestador.
        </p>
      </div>

      <div className="max-w-lg rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold">{editandoId ? "Editar executor" : "Novo executor"}</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoExecutor)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {tipos.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_EXECUTOR[t]}
              </option>
            ))}
          </select>
          {tipo === "EMPREITEIRO" && (
            <select
              value={modalidadePagamentoColheita}
              onChange={(e) => setModalidadePagamentoColheita(e.target.value as ModalidadePagamentoColheita)}
              title="Como o custo da colheita deste empreiteiro é calculado"
              className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {modalidades.map((m) => (
                <option key={m} value={m}>
                  {ROTULO_MODALIDADE_PAGAMENTO_COLHEITA[m]}
                </option>
              ))}
            </select>
          )}
          {tipo === "EMPREITEIRO" && (
            <p className="col-span-2 -mt-1 text-xs text-gray-500">
              Mudar isto só vale para a próxima colheita lançada — as que já foram lançadas mantêm o
              custo que já tinham.
            </p>
          )}
          <input
            placeholder="Contato (telefone)"
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Observações"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => salvar.mutate()}
            disabled={!nome || salvar.isPending}
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
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Contato</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {executores?.map((e) => (
              <tr key={e.id} className={`border-t ${e.ativo ? "" : "text-gray-500"}`}>
                <td className="px-4 py-2">{e.nome}</td>
                <td className="px-4 py-2">
                  {ROTULO_TIPO_EXECUTOR[e.tipo]}
                  {e.tipo === "EMPREITEIRO" && (
                    <span className="block text-xs text-gray-400">
                      {e.modalidadePagamentoColheita === "POR_CAIXA_PESO" ? "por caixa-peso" : "por caixa"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{e.contato ?? "-"}</td>
                <td className="px-4 py-2">{e.ativo ? "Ativo" : "Inativo"}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right">
                  <button
                    onClick={() => {
                      setEditandoId(e.id);
                      setNome(e.nome);
                      setTipo(e.tipo);
                      setModalidadePagamentoColheita(e.modalidadePagamentoColheita ?? "POR_CAIXA");
                      setContato(e.contato ?? "");
                      setObservacoes(e.observacoes ?? "");
                    }}
                    className="mr-3 text-green-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => alternarAtivo.mutate({ id: e.id, ativo: !e.ativo })}
                    className={e.ativo ? "text-red-600" : "text-green-700"}
                  >
                    {e.ativo ? "Desativar" : "Reativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {executores?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">Nenhum executor cadastrado.</p>
        )}
      </div>
    </div>
  );
}
