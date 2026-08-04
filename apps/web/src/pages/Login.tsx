import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, Lock, Mail, WifiOff } from "lucide-react";
import LogoMarca from "../components/LogoMarca";
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-mata-800 via-mata-900 to-mata-800 px-4 py-10">
      {/* Manchas de luz ao fundo: dão profundidade sem imagem para baixar. */}
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-mata-500/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-limao-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative w-full max-w-sm animate-surgir-de-baixo">
        <div className="mb-7 flex items-center gap-3.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-terra-50 shadow-cartao-alto">
            <LogoMarca size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-white">Sítio</h1>
            <p className="text-sm text-mata-200">Gestão de fruticultura</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white p-6 shadow-cartao-alto"
        >
          {!online && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <WifiOff size={16} className="mt-0.5 shrink-0" />
              <span>Sem conexão. O primeiro acesso precisa de internet.</span>
            </div>
          )}

          {erro && (
            <div
              role="alert"
              className="mb-4 flex animate-surgir items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-terra-700">
            E-mail
          </label>
          <div className="relative mb-4">
            <Mail
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-terra-400"
              aria-hidden
            />
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-terra-300 py-2.5 pl-9 pr-3 text-base shadow-interno transition duration-200 focus:border-mata-500 focus:outline-none focus:ring-2 focus:ring-mata-500/20"
            />
          </div>

          <label htmlFor="senha" className="mb-1.5 block text-sm font-medium text-terra-700">
            Senha
          </label>
          <div className="relative mb-6">
            <Lock
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-terra-400"
              aria-hidden
            />
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-terra-300 py-2.5 pl-9 pr-3 text-base shadow-interno transition duration-200 focus:border-mata-500 focus:outline-none focus:ring-2 focus:ring-mata-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-mata-500 to-mata-700 py-3 font-semibold text-white shadow-cartao transition duration-200 ease-suave hover:-translate-y-0.5 hover:shadow-cartao-alto disabled:translate-y-0 disabled:opacity-60"
          >
            {enviando && <Loader2 size={16} className="animate-spin" />}
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-mata-300/80">
          Sítio Santo Antônio · Monte Alto, SP
        </p>
        <p className="mt-2 text-center font-num text-[11px] font-bold uppercase tracking-[0.15em] text-limao-400/70">
          Costa Mello <span className="text-mata-400/70">Agroconsultoria</span>
        </p>
      </div>
    </div>
  );
}
