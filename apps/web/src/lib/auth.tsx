import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  api,
  getUsuarioSalvo,
  getAccessToken,
  limparSessao,
  salvarSessao,
  type UsuarioLogado,
} from "./api";

interface AuthContextValue {
  usuario: UsuarioLogado | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  /** o usuário pode abrir esta área? */
  podeVer: (modulo: string) => boolean;
  /** o usuário pode alterar dados desta área? */
  podeEditar: (modulo: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(getUsuarioSalvo());
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function validar() {
      if (getAccessToken()) {
        try {
          const atual = await api.get<UsuarioLogado>("/auth/me");
          setUsuario(atual);
          salvarSessaoUsuario(atual);
        } catch {
          limparSessao();
          setUsuario(null);
        }
      }
      setCarregando(false);
    }
    validar();
  }, []);

  function salvarSessaoUsuario(u: UsuarioLogado) {
    localStorage.setItem("erpsitio_usuario", JSON.stringify(u));
  }

  async function login(email: string, senha: string) {
    const dados = await api.post<{
      accessToken: string;
      refreshToken: string;
      usuario: UsuarioLogado;
    }>("/auth/login", { email, senha });
    salvarSessao(dados, dados.usuario);
    setUsuario(dados.usuario);
    // o login não traz permissões; busca em seguida para o menu já sair certo
    try {
      const atual = await api.get<UsuarioLogado>("/auth/me");
      setUsuario(atual);
      salvarSessaoUsuario(atual);
    } catch {
      // segue com o que veio do login; o /auth/me roda de novo no próximo load
    }
  }

  function logout() {
    limparSessao();
    setUsuario(null);
  }

  // Enquanto as permissões não chegaram, ADMIN vê tudo e os demais só o que já
  // era liberado pelo papel — evita menu piscando ou tela em branco.
  function buscar(modulo: string) {
    return usuario?.permissoes?.find((p) => p.modulo === modulo);
  }

  function podeVer(modulo: string) {
    if (!usuario) return false;
    if (usuario.role === "ADMIN") return true;
    const p = buscar(modulo);
    if (!p) return usuario.role === "GERENTE" && modulo !== "usuarios";
    return p.podeVer || p.podeEditar;
  }

  function podeEditar(modulo: string) {
    if (!usuario) return false;
    if (usuario.role === "ADMIN") return true;
    const p = buscar(modulo);
    if (!p) return usuario.role === "GERENTE" && modulo !== "usuarios";
    return p.podeEditar;
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout, podeVer, podeEditar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
