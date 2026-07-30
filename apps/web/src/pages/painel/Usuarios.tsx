import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { LinhaMatrizPermissao, RespostaPermissoes, Usuario } from "../../lib/types";

const roles = ["ADMIN", "GERENTE", "ENCARREGADO"] as const;

const ROTULO_PAPEL: Record<(typeof roles)[number], string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  ENCARREGADO: "Encarregado",
};

type Aba = "usuarios" | "permissoes";

export default function Usuarios() {
  const qc = useQueryClient();
  const { usuario: usuarioLogado } = useAuth();
  const [aba, setAba] = useState<Aba>("usuarios");

  const { data: usuarios } = useQuery({ queryKey: ["usuarios"], queryFn: () => api.get<Usuario[]>("/usuarios") });

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]>("ENCARREGADO");
  const [erro, setErro] = useState<string | null>(null);

  const criar = useMutation({
    mutationFn: () => api.post("/usuarios", { nome, email, senha, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      setNome("");
      setEmail("");
      setSenha("");
      setRole("ENCARREGADO");
      setErro(null);
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Erro ao criar usuário"),
  });

  const alternarAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => api.patch(`/usuarios/${id}`, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  const trocarPapel = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.patch(`/usuarios/${id}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Usuários e permissões</h1>
        <p className="text-sm text-gray-500">
          Cada usuário pertence a uma categoria de acesso. O que cada categoria pode ver e alterar é definido na aba
          Permissões.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            ["usuarios", "Usuários"],
            ["permissoes", "Permissões por categoria"],
          ] as [Aba, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setAba(v)}
            className={`px-4 py-2 text-sm font-medium ${
              aba === v ? "border-b-2 border-green-700 text-green-800" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === "usuarios" && (
        <>
          {erro && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

          <div className="max-w-lg rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-3 font-semibold">Novo usuário</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Senha provisória (mín. 8)"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROTULO_PAPEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => criar.mutate()}
              disabled={!nome || !email || senha.length < 8 || criar.isPending}
              className="mt-3 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Criar usuário
            </button>
          </div>

          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-500">
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">E-mail</th>
                  <th className="px-4 py-2">Categoria de acesso</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {usuarios?.map((u) => {
                  const ehVoce = u.id === usuarioLogado?.id;
                  return (
                    <tr key={u.id} className={`border-t ${u.ativo ? "" : "text-gray-400"}`}>
                      <td className="px-4 py-2">
                        {u.nome}
                        {ehVoce && <span className="ml-2 text-xs text-gray-400">(você)</span>}
                      </td>
                      <td className="px-4 py-2">{u.email}</td>
                      <td className="px-4 py-2">
                        <select
                          value={u.role}
                          disabled={ehVoce}
                          onChange={(e) => trocarPapel.mutate({ id: u.id, role: e.target.value })}
                          title={ehVoce ? "Você não pode alterar a sua própria categoria" : undefined}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {ROTULO_PAPEL[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">{u.ativo ? "Ativo" : "Inativo"}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => alternarAtivo.mutate({ id: u.id, ativo: !u.ativo })}
                          disabled={ehVoce}
                          className={`disabled:text-gray-300 ${u.ativo ? "text-red-600" : "text-green-700"}`}
                          title={ehVoce ? "Você não pode desativar a si mesmo" : undefined}
                        >
                          {u.ativo ? "Desativar" : "Reativar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === "permissoes" && <MatrizPermissoes />}
    </div>
  );
}

function MatrizPermissoes() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["permissoes"],
    queryFn: () => api.get<RespostaPermissoes>("/permissoes"),
  });

  const [matriz, setMatriz] = useState<LinhaMatrizPermissao[]>([]);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    if (data) setMatriz(data.matriz);
  }, [data]);

  function alterar(papel: string, modulo: string, campo: "podeVer" | "podeEditar", valor: boolean) {
    setMatriz((atual) =>
      atual.map((linha) =>
        linha.papel !== papel
          ? linha
          : {
              ...linha,
              permissoes: linha.permissoes.map((p) => {
                if (p.modulo !== modulo) return p;
                if (campo === "podeEditar") {
                  // quem edita precisa poder ver
                  return { ...p, podeEditar: valor, podeVer: valor ? true : p.podeVer };
                }
                // tirar o "ver" tira o "editar" junto
                return { ...p, podeVer: valor, podeEditar: valor ? p.podeEditar : false };
              }),
            },
      ),
    );
  }

  const salvar = useMutation({
    mutationFn: () => {
      const payload = matriz
        .filter((l) => !l.fixo)
        .flatMap((l) =>
          l.permissoes.map((p) => ({
            papel: l.papel,
            modulo: p.modulo,
            podeVer: p.podeVer,
            podeEditar: p.podeEditar,
          })),
        );
      return api.put("/permissoes", { permissoes: payload });
    },
    onSuccess: () => {
      setMensagem("Permissões salvas. Os usuários veem a mudança no próximo carregamento.");
      qc.invalidateQueries({ queryKey: ["permissoes"] });
    },
    onError: (e) => setMensagem(e instanceof ApiError ? e.message : "Erro ao salvar"),
  });

  const restaurar = useMutation({
    mutationFn: () => api.post("/permissoes/restaurar-padrao"),
    onSuccess: () => {
      setMensagem("Permissões restauradas para o padrão do sistema.");
      qc.invalidateQueries({ queryKey: ["permissoes"] });
    },
  });

  if (!data) return <p className="text-sm text-gray-400">Carregando...</p>;

  return (
    <div className="space-y-4">
      {mensagem && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            salvar.isError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"
          }`}
        >
          {mensagem}
        </div>
      )}

      <p className="text-sm text-gray-500">
        Marque o que cada categoria pode <strong>ver</strong> (abrir a tela) e <strong>editar</strong> (criar,
        alterar, excluir). Marcar "editar" liga o "ver" automaticamente.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {matriz.map((linha) => (
          <div key={linha.papel} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-semibold text-gray-800">
                {linha.papel === "ADMIN"
                  ? "Administrador"
                  : linha.papel === "GERENTE"
                    ? "Gerente"
                    : "Encarregado"}
              </p>
              {linha.fixo && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  acesso total
                </span>
              )}
            </div>

            {linha.fixo && (
              <p className="mb-3 text-xs text-gray-400">
                O administrador tem acesso a tudo e não pode ser limitado — assim ninguém fica trancado para fora
                do sistema.
              </p>
            )}

            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="pb-1">Área</th>
                  <th className="pb-1 text-center">Ver</th>
                  <th className="pb-1 text-center">Editar</th>
                </tr>
              </thead>
              <tbody>
                {data.modulos.map((m) => {
                  const p = linha.permissoes.find((x) => x.modulo === m.id);
                  return (
                    <tr key={m.id} className="border-t border-gray-50">
                      <td className="py-1.5" title={m.descricao}>
                        {m.rotulo}
                      </td>
                      <td className="py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!p?.podeVer}
                          disabled={linha.fixo}
                          onChange={(e) => alterar(linha.papel, m.id, "podeVer", e.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!p?.podeEditar}
                          disabled={linha.fixo}
                          onChange={(e) => alterar(linha.papel, m.id, "podeEditar", e.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Salvar permissões
        </button>
        <button
          onClick={() => {
            if (confirm("Restaurar todas as permissões para o padrão do sistema?")) restaurar.mutate();
          }}
          className="text-sm text-gray-600 hover:underline"
        >
          Restaurar padrão
        </button>
      </div>
    </div>
  );
}
