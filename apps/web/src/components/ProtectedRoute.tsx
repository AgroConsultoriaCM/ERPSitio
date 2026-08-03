import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function ProtectedRoute() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return <div className="flex h-screen items-center justify-center text-gray-600">Carregando...</div>;
  }

  if (!usuario) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export function SomenteGestao() {
  const { usuario } = useAuth();
  if (usuario && usuario.role === "ENCARREGADO") {
    return <Navigate to="/campo" replace />;
  }
  return <Outlet />;
}

/**
 * Bloqueia uma área para quem não tem permissão de ver, inclusive quando a
 * URL é digitada direto. O servidor também valida - isto é conveniência de
 * navegação, não a barreira de segurança.
 */
export function ExigePermissao({ modulo }: { modulo: string }) {
  const { podeVer, carregando } = useAuth();

  if (carregando) {
    return <p className="text-sm text-gray-500">Carregando...</p>;
  }

  if (!podeVer(modulo)) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <p className="font-semibold text-amber-900">Acesso não liberado</p>
        <p className="mt-1 text-sm text-amber-800">
          Seu perfil de acesso não inclui esta área. Peça a um administrador para liberá-la em
          Usuários → Permissões por categoria.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
