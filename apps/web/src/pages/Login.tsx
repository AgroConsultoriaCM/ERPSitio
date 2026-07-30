import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export default function Login() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
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
      setErro(err instanceof ApiError ? err.message : "Não foi possível entrar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-green-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-1 text-2xl font-bold text-green-800">Sítio</h1>
        <p className="mb-6 text-sm text-gray-500">Gestão de fruticultura</p>

        {erro && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>
        )}

        <label className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:border-green-600 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">Senha</label>
        <input
          type="password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mb-6 w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:border-green-600 focus:outline-none"
        />

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-md bg-green-700 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
