import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { useOnline } from "../lib/useOnline";

export default function Login() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) {
    return <Navigate to={usuario.role === "ENCARREGADO" ? "/campo" : "/painel"} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login(email, senha);
      navigate("/", { replace: true });
    } catch (err) {
      // O status 0 vem da camada de API quando a requisição nem saiu: no campo
      // isso é muito mais comum que senha errada, e a mensagem precisa dizer
      // isso em vez de sugerir que o operador digitou errado.
      if (err instanceof ApiError && err.status === 0) {
        setErro("Sem conexão com o servidor. Verifique o sinal e tente de novo.");
      } else {
        setErro(err instanceof ApiError ? err.message : "Não foi possível entrar");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-mata-800 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-limao-400 text-xl font-bold text-mata-900">
            S
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight text-white">Sítio</h1>
            <p className="text-sm text-mata-200">Gestão de fruticultura</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-cartao-alto">
          {!online && (
            <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Sem conexão. O primeiro acesso precisa de internet.
            </div>
          )}

          {erro && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {erro}
            </div>
          )}

          <label htmlFor="email" className="mb-1 block text-sm font-medium text-terra-700">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-terra-300 px-3 py-2.5 text-base transition focus:border-mata-500 focus:outline-none"
          />

          <label htmlFor="senha" className="mb-1 block text-sm font-medium text-terra-700">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mb-6 w-full rounded-lg border border-terra-300 px-3 py-2.5 text-base transition focus:border-mata-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-mata-600 py-3 font-semibold text-white transition hover:bg-mata-700 disabled:opacity-60"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-mata-300">
          Sítio Santo Antônio · Monte Alto, SP
        </p>
      </div>
    </div>
  );
}
