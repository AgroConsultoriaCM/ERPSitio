import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bug,
  Citrus,
  ClipboardList,
  Droplets,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Package,
  SlidersHorizontal,
  Users,
  WifiOff,
  X,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useOnline } from "../../lib/useOnline";
import { ROTAS } from "../../lib/rotas";
import type { Propriedade } from "../../lib/types";

type Icone = ComponentType<LucideProps>;

function ItemMenu({ para, icone: Ico, children }: { para: string; icone: Icone; children: string }) {
  return (
    <NavLink
      to={para}
      end={para === ROTAS.dashboard}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-suave ${
          isActive
            ? "bg-mata-600 text-white shadow-cartao"
            : "text-terra-600 hover:bg-mata-50 hover:text-mata-800"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Marca de seleção à esquerda: cresce a partir do centro quando o
              item vira o ativo, em vez de simplesmente aparecer. */}
          <span
            className={`absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-limao-400 transition-transform duration-300 ease-suave ${
              isActive ? "scale-y-100" : "scale-y-0"
            }`}
            aria-hidden
          />
          <Ico
            size={17}
            strokeWidth={2}
            className={`shrink-0 transition-transform duration-200 ease-suave ${
              isActive ? "" : "group-hover:scale-110"
            }`}
          />
          {children}
        </>
      )}
    </NavLink>
  );
}

function GrupoMenu({ children }: { children: string }) {
  return <p className="px-3 pb-1.5 pt-5 rotulo">{children}</p>;
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
        <ItemMenu para={ROTAS.dashboard} icone={LayoutDashboard}>
          Painel
        </ItemMenu>
      )}
      {podeVer("mapa") && (
        <ItemMenu para={ROTAS.mapa} icone={Map}>
          Mapa da propriedade
        </ItemMenu>
      )}

      {veDiaADia && (
        <>
          <GrupoMenu>Dia a dia</GrupoMenu>
          {podeVer("colheitas") && (
            <ItemMenu para={ROTAS.colheitas} icone={Citrus}>
              Colheitas
            </ItemMenu>
          )}
          {podeVer("operacoes") && (
            <ItemMenu para={ROTAS.operacoes} icone={ClipboardList}>
              Operações
            </ItemMenu>
          )}
          {podeVer("estoque") && (
            <ItemMenu para={ROTAS.estoque} icone={Package}>
              Estoque
            </ItemMenu>
          )}
        </>
      )}

      {veAcompanhamento && (
        <>
          <GrupoMenu>Acompanhamento</GrupoMenu>
          {podeVer("pragas") && (
            <ItemMenu para={ROTAS.pragas} icone={Bug}>
              Controle de pragas
            </ItemMenu>
          )}
          {podeVer("irrigacao") && (
            <ItemMenu para={ROTAS.irrigacao} icone={Droplets}>
              Manejo hídrico
            </ItemMenu>
          )}
        </>
      )}

      {veConfiguracao && (
        <>
          <GrupoMenu>Configuração</GrupoMenu>
          {(podeVer("cadastros") || podeVer("propriedade")) && (
            <NavLink
              to={ROTAS.cadastros}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-suave ${
                emCadastros
                  ? "bg-mata-600 text-white shadow-cartao"
                  : "text-terra-600 hover:bg-mata-50 hover:text-mata-800"
              }`}
            >
              <span
                className={`absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-limao-400 transition-transform duration-300 ease-suave ${
                  emCadastros ? "scale-y-100" : "scale-y-0"
                }`}
                aria-hidden
              />
              <SlidersHorizontal size={17} strokeWidth={2} className="shrink-0" />
              Cadastros
            </NavLink>
          )}
          {podeVer("usuarios") && (
            <ItemMenu para={ROTAS.usuarios} icone={Users}>
              Usuários
            </ItemMenu>
          )}
        </>
      )}
    </nav>
  );

  const marca = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-mata-500 to-mata-700 text-white shadow-cartao">
        <Citrus size={20} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold leading-tight tracking-tight text-terra-900">
          {propriedade?.nome ?? "Sítio"}
        </p>
        <p className="truncate text-xs text-terra-500">
          {usuario?.nome} · {usuario?.role.toLowerCase()}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-terra-100">
      {/* Barra superior só no celular */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-terra-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-mata-500 to-mata-700 text-white">
            <Citrus size={16} strokeWidth={2} />
          </div>
          <span className="font-semibold tracking-tight text-terra-900">
            {propriedade?.nome ?? "Sítio"}
          </span>
        </div>
        <button
          onClick={() => setMenuAberto((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-terra-300 text-terra-700 transition active:scale-95"
          aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuAberto}
        >
          {menuAberto ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {menuAberto && (
        <div
          className="fixed inset-0 z-30 animate-surgir bg-terra-900/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-terra-200 bg-white px-4 py-5 transition-transform duration-300 ease-suave lg:static lg:translate-x-0 ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6">{marca}</div>

        <div className="flex-1">{navegacao}</div>

        <div className="mt-6 space-y-2 border-t border-terra-200 pt-4">
          {!online && (
            <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <WifiOff size={14} className="shrink-0 animate-pulsar" />
              Sem conexão — dados salvos
            </p>
          )}
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-terra-300 px-3 py-2 text-sm font-medium text-terra-600 transition duration-200 hover:border-terra-400 hover:bg-terra-50"
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 pt-[4.5rem] sm:p-6 lg:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
