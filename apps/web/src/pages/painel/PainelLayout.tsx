import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useOnline } from "../../lib/useOnline";
import { ROTAS } from "../../lib/rotas";
import type { Propriedade } from "../../lib/types";

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-mata-600 text-white shadow-cartao"
      : "text-terra-700 hover:bg-mata-50 hover:text-mata-800"
  }`;

/** Ícones em SVG inline: sem dependência nova e sem requisição extra. */
function Icone({ nome }: { nome: string }) {
  const d: Record<string, string> = {
    painel: "M3 12h7V3H3v9Zm0 9h7v-6H3v6Zm11 0h7V12h-7v9Zm0-18v6h7V3h-7Z",
    mapa: "M9 3 3 5.5v16L9 19l6 2.5 6-2.5v-16L15 5.5 9 3Zm0 0v16m6-13.5v16",
    colheita: "M12 21c-4 0-7-3-7-7 0-4 3-8 7-11 4 3 7 7 7 11 0 4-3 7-7 7Z",
    operacao: "M4 7h16M4 12h16M4 17h10",
    estoque: "M3 7l9-4 9 4v10l-9 4-9-4V7Zm9-4v18M3 7l9 4 9-4",
    praga: "M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2m0-12-2 2M8 16l-2 2M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z",
    agua: "M12 3c3.5 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-6 6-10Z",
    cadastro: "M4 5h16v14H4V5Zm0 5h16M9 10v9",
    usuarios: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19v-1a4 4 0 0 0-3-3.9",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0 opacity-90"
      aria-hidden
    >
      <path d={d[nome] ?? d.painel} />
    </svg>
  );
}

export default function PainelLayout() {
  const { usuario, logout, podeVer } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const online = useOnline();
  const [menuAberto, setMenuAberto] = useState(false);

  const { data: propriedade } = useQuery({
    queryKey: ["propriedade"],
    queryFn: () => api.get<Propriedade>("/propriedades/me"),
  });

  // Navegar fecha o menu do celular; sem isto o painel abre atrás da gaveta.
  useEffect(() => setMenuAberto(false), [pathname]);

  const emCadastros = pathname.startsWith(ROTAS.cadastros);
  const veDiaADia = podeVer("colheitas") || podeVer("operacoes") || podeVer("estoque");
  const veAcompanhamento = podeVer("pragas") || podeVer("irrigacao");
  const veConfiguracao = podeVer("cadastros") || podeVer("propriedade") || podeVer("usuarios");

  const navegacao = (
    <nav className="space-y-1">
      {podeVer("dashboard") && (
        <NavLink to={ROTAS.dashboard} end className={linkClasses}>
          <Icone nome="painel" />
          Painel
        </NavLink>
      )}
      {podeVer("mapa") && (
        <NavLink to={ROTAS.mapa} className={linkClasses}>
          <Icone nome="mapa" />
          Mapa da propriedade
        </NavLink>
      )}

      {veDiaADia && (
        <>
          <p className="px-3 pb-1 pt-4 rotulo">Dia a dia</p>
          {podeVer("colheitas") && (
            <NavLink to={ROTAS.colheitas} className={linkClasses}>
              <Icone nome="colheita" />
              Colheitas
            </NavLink>
          )}
          {podeVer("operacoes") && (
            <NavLink to={ROTAS.operacoes} className={linkClasses}>
              <Icone nome="operacao" />
              Operações
            </NavLink>
          )}
          {podeVer("estoque") && (
            <NavLink to={ROTAS.estoque} className={linkClasses}>
              <Icone nome="estoque" />
              Estoque
            </NavLink>
          )}
        </>
      )}

      {veAcompanhamento && (
        <>
          <p className="px-3 pb-1 pt-4 rotulo">Acompanhamento</p>
          {podeVer("pragas") && (
            <NavLink to={ROTAS.pragas} className={linkClasses}>
              <Icone nome="praga" />
              Controle de pragas
            </NavLink>
          )}
          {podeVer("irrigacao") && (
            <NavLink to={ROTAS.irrigacao} className={linkClasses}>
              <Icone nome="agua" />
              Manejo hídrico
            </NavLink>
          )}
        </>
      )}

      {veConfiguracao && (
        <>
          <p className="px-3 pb-1 pt-4 rotulo">Configuração</p>
          {(podeVer("cadastros") || podeVer("propriedade")) && (
            <NavLink to={ROTAS.cadastros} className={() => linkClasses({ isActive: emCadastros })}>
              <Icone nome="cadastro" />
              Cadastros
            </NavLink>
          )}
          {podeVer("usuarios") && (
            <NavLink to={ROTAS.usuarios} className={linkClasses}>
              <Icone nome="usuarios" />
              Usuários
            </NavLink>
          )}
        </>
      )}
    </nav>
  );

  const identidade = (
    <div className="mb-5 flex items-center gap-3 px-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mata-600 text-lg font-bold text-white shadow-cartao">
        S
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold leading-tight text-terra-900">
          {propriedade?.nome ?? "Sítio"}
        </p>
        <p className="truncate text-xs text-terra-500">
          {usuario?.nome} · {usuario?.role.toLowerCase()}
        </p>
      </div>
    </div>
  );

  const rodape = (
    <div className="mt-6 space-y-2 border-t border-terra-200 pt-4">
      {!online && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          Sem conexão — mostrando dados salvos
        </p>
      )}
      <button
        onClick={() => {
          logout();
          navigate("/login");
        }}
        className="w-full rounded-lg border border-terra-300 px-3 py-2 text-sm font-medium text-terra-600 transition hover:bg-terra-50"
      >
        Sair
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-terra-100">
      {/* Barra superior só no celular */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-terra-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mata-600 text-sm font-bold text-white">
            S
          </div>
          <span className="font-semibold text-terra-900">{propriedade?.nome ?? "Sítio"}</span>
        </div>
        <button
          onClick={() => setMenuAberto((v) => !v)}
          className="rounded-lg border border-terra-300 px-3 py-1.5 text-sm font-medium text-terra-700"
          aria-expanded={menuAberto}
        >
          {menuAberto ? "Fechar" : "Menu"}
        </button>
      </header>

      {menuAberto && (
        <div
          className="fixed inset-0 z-30 bg-terra-900/30 lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-terra-200 bg-white px-3 py-4 transition-transform lg:static lg:translate-x-0 ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {identidade}
        {navegacao}
        {rodape}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 pt-20 sm:p-6 lg:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
