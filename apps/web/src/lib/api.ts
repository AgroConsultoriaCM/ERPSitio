const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333/api/v1";

const ACCESS_KEY = "erpsitio_access_token";
const REFRESH_KEY = "erpsitio_refresh_token";
const USUARIO_KEY = "erpsitio_usuario";

export type Role = "ADMIN" | "GERENTE" | "ENCARREGADO";

export interface PermissaoUsuario {
  modulo: string;
  podeVer: boolean;
  podeEditar: boolean;
}

export interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
  role: Role;
  propriedadeId: string;
  // vem do /auth/me; ausente logo após o login, até o me carregar
  permissoes?: PermissaoUsuario[];
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function getUsuarioSalvo(): UsuarioLogado | null {
  const raw = localStorage.getItem(USUARIO_KEY);
  return raw ? (JSON.parse(raw) as UsuarioLogado) : null;
}

export function salvarSessao(tokens: { accessToken: string; refreshToken: string }, usuario?: UsuarioLogado) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  if (usuario) localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
}

export function limparSessao() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USUARIO_KEY);
}

export class ApiError extends Error {
  status: number;
  issues?: unknown;

  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

let refreshEmAndamento: Promise<boolean> | null = null;

async function tentarRenovarToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshEmAndamento) {
    refreshEmAndamento = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const dados = await res.json();
        salvarSessao(dados);
        return true;
      } catch {
        return false;
      } finally {
        refreshEmAndamento = null;
      }
    })();
  }
  return refreshEmAndamento;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  _retry = true,
): Promise<T> {
  const accessToken = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && _retry && getRefreshToken()) {
    const renovou = await tentarRenovarToken();
    if (renovou) return apiFetch<T>(path, options, false);
    limparSessao();
    window.location.href = "/login";
    throw new ApiError("Sessão expirada", 401);
  }

  if (res.status === 204) return undefined as T;

  const corpo = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(corpo.message ?? "Erro na requisição", res.status, corpo.issues);
  }

  return corpo as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
