import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { ROTAS } from "../../lib/rotas";

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? "bg-green-700 text-white" : "text-gray-700 hover:bg-green-100"
  }`;

export default function PainelLayout() {
  const { usuario, logout, podeVer } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // "Cadastros" fica marcado em qualquer uma das sub-abas
  const emCadastros = pathname.startsWith(ROTAS.cadastros);

  // um grupo do menu some quando o usuário não pode ver nada dentro dele
  const veDiaADia = podeVer("colheitas") || podeVer("operacoes") || podeVer("estoque");
  const veAcompanhamento = podeVer("pragas") || podeVer("irrigacao");
  const veConfiguracao = podeVer("cadastros") || podeVer("propriedade") || podeVer("usuarios");

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 shrink-0 border-r border-gray-200 bg-white px-3 py-4">
        <div className="mb-6 px-2">
          <p className="text-lg font-bold text-green-800">Sítio</p>
          <p className="text-xs text-gray-500">
            {usuario?.nome} · {usuario?.role}
          </p>
        </div>

        <nav className="space-y-1">
          {podeVer("dashboard") && (
            <NavLink to={ROTAS.dashboard} end className={linkClasses}>
              Dashboard
            </NavLink>
          )}
          {podeVer("mapa") && (
            <NavLink to={ROTAS.mapa} className={linkClasses}>
              Mapa da propriedade
            </NavLink>
          )}

          {veDiaADia && (
            <>
              <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Dia a dia
              </p>
              {podeVer("colheitas") && (
                <NavLink to={ROTAS.colheitas} className={linkClasses}>
                  Colheitas
                </NavLink>
              )}
              {podeVer("operacoes") && (
                <NavLink to={ROTAS.operacoes} className={linkClasses}>
                  Operações
                </NavLink>
              )}
              {podeVer("estoque") && (
                <NavLink to={ROTAS.estoque} className={linkClasses}>
                  Estoque
                </NavLink>
              )}
            </>
          )}

          {veAcompanhamento && (
            <>
              <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Acompanhamento
              </p>
              {podeVer("pragas") && (
                <NavLink to={ROTAS.pragas} className={linkClasses}>
                  Controle de pragas
                </NavLink>
              )}
              {podeVer("irrigacao") && (
                <NavLink to={ROTAS.irrigacao} className={linkClasses}>
                  Manejo hídrico
                </NavLink>
              )}
            </>
          )}

          {veConfiguracao && (
            <>
              <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Configuração
              </p>
              {(podeVer("cadastros") || podeVer("propriedade")) && (
                <NavLink to={ROTAS.cadastros} className={() => linkClasses({ isActive: emCadastros })}>
                  Cadastros
                </NavLink>
              )}
              {podeVer("usuarios") && (
                <NavLink to={ROTAS.usuarios} className={linkClasses}>
                  Usuários
                </NavLink>
              )}
            </>
          )}
        </nav>

        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="mt-8 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Sair
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
