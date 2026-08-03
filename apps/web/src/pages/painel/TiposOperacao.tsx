import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, X } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import type { TipoAtividade } from "../../lib/types";
import { Aviso, Cartao, EstadoVazio, TituloSecao } from "../../components/ui";

export default function TiposOperacao() {
  const qc = useQueryClient();
  const { data: tipos, isLoading } = useQuery({
    queryKey: ["tipos-atividade"],
    queryFn: () => api.get<TipoAtividade[]>("/tipos-atividade"),
  });

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function limpar() {
    setEditandoId(null);
    setNome("");
    setDescricao("");
  }

  const salvar = useMutation({
    mutationFn: () => {
      const body = { nome, descricao: descricao || undefined };
      return editandoId
        ? api.patch(`/tipos-atividade/${editandoId}`, body)
        : api.post("/tipos-atividade", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos-atividade"] });
      limpar();
      setErro(null);
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Não consegui salvar."),
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/tipos-atividade/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tipos-atividade"] }),
    onError: (e) =>
      setErro(
        e instanceof ApiError
          ? e.message
          : "Não consegui remover — talvez já exista alguma operação lançada com este tipo.",
      ),
  });

  return (
    <div className="space-y-5">
      <TituloSecao descricao="Os tipos de manejo que aparecem para escolher ao lançar uma operação — poda, roçada, calagem, o que fizer sentido mapear no sítio.">
        Cadastrar operações
      </TituloSecao>

      {erro && (
        <Aviso tom="perigo" titulo="Não deu certo">
          {erro}
        </Aviso>
      )}

      <Cartao className="max-w-lg">
        <p className="mb-3 font-semibold text-terra-800">
          {editandoId ? "Editar tipo de operação" : "Novo tipo de operação"}
        </p>
        <div className="space-y-2">
          <input
            placeholder="Nome — ex.: Poda, Roçada, Calagem"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-md border border-terra-300 px-3 py-2 text-sm focus:border-mata-500 focus:outline-none"
          />
          <input
            placeholder="Descrição (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded-md border border-terra-300 px-3 py-2 text-sm focus:border-mata-500 focus:outline-none"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => salvar.mutate()}
            disabled={!nome.trim() || salvar.isPending}
            className="rounded-lg bg-mata-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mata-700 disabled:opacity-60"
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </button>
          {editandoId && (
            <button
              onClick={limpar}
              className="flex items-center gap-1.5 rounded-lg border border-terra-300 px-4 py-2 text-sm font-medium text-terra-600 transition hover:bg-terra-50"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
          )}
        </div>
      </Cartao>

      {isLoading ? (
        <Cartao>
          <p className="py-8 text-center text-sm text-terra-500">Carregando…</p>
        </Cartao>
      ) : !tipos?.length ? (
        <Cartao>
          <EstadoVazio
            titulo="Nenhum tipo cadastrado"
            descricao="Cadastre o primeiro tipo de operação acima."
          />
        </Cartao>
      ) : (
        <Cartao className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-terra-50 text-xs uppercase tracking-wide text-terra-500">
              <tr>
                <th className="px-4 py-2.5">Nome</th>
                <th className="px-4 py-2.5">Descrição</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.id} className="border-t border-terra-100">
                  <td className="px-4 py-2.5 font-medium text-terra-800">{t.nome}</td>
                  <td className="px-4 py-2.5 text-terra-500">{t.descricao ?? "-"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => {
                        setEditandoId(t.id);
                        setNome(t.nome);
                        setDescricao(t.descricao ?? "");
                      }}
                      className="mr-3 inline-flex items-center gap-1 text-mata-700 hover:text-mata-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remover o tipo "${t.nome}"?`)) remover.mutate(t.id);
                      }}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      )}
    </div>
  );
}
