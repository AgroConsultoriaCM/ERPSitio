import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bug,
  ChevronRight,
  Citrus,
  ClipboardList,
  Droplets,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Package,
  SlidersHorizontal,
  SprayCan,
  WifiOff,
  X,
  FileText,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import LogoMarca from "../../components/LogoMarca";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useOnline } from "../../lib/useOnline";
import { ROTAS } from "../../lib/rotas";
import type { Propriedade } from "../../lib/types";

type Icone = ComponentType<LucideProps>;

function ItemMenu({
  para,
  icone: Ico,
  children,
}: {
  para: string;
  icone: Icone;
  children: string;
}) {
  return (
    <NavLink
      to={para}
      end={para === ROTAS.dashboard}
      title={children}
      className={({ isActive }) =>
        `group/item relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-suave ${
          isActive
            ? "bg-mata-600 text-white shadow-cartao"
            : "text-terra-700 hover:bg-mata-50 hover:text-mata-800"
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
              isActive ? "" : "group-hover/item:scale-110"
            }`}
          />
          <span className="overflow-hidden whitespace-nowrap opacity-100 transition-all duration-300 ease-suave lg:w-0 lg:opacity-0 lg:group-hover:w-auto lg:group-hover:opacity-100">
            {children}
          </span>
        </>
      )}
    </NavLink>
  );
}

function ItemSubmenu({ para, children }: { para: string; children: string }) {
  return (
    <NavLink
      to={para}
      className={({ isActive }) =>
        `block rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ease-suave ${
          isActive
            ? "font-medium text-mata-700"
            : "text-terra-600 hover:bg-mata-50 hover:text-mata-800"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function GrupoMenu({ children }: { children: string }) {
  return (
    <p className="overflow-hidden whitespace-nowrap px-3 pb-1.5 pt-5 rotulo opacity-100 transition-all duration-300 ease-suave lg:h-0 lg:pb-0 lg:pt-2 lg:opacity-0 lg:group-hover:h-auto lg:group-hover:pb-1.5 lg:group-hover:pt-5 lg:group-hover:opacity-100">
      {children}
    </p>
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
  const emConfiguracao = emCadastros || pathname.startsWith(ROTAS.usuarios);
  const veDiaADia = podeVer("colheitas") || podeVer("operacoes") || podeVer("estoque") || podeVer("notas");
  const veAcompanhamento = podeVer("pragas") || podeVer("irrigacao") || podeVer("analises");
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
          {podeVer("operacoes") && (
            <ItemMenu para={ROTAS.pulverizacoes} icone={SprayCan}>
              Pulverizações
            </ItemMenu>
          )}
          {podeVer("estoque") && (
            <ItemMenu para={ROTAS.estoque} icone={Package}>
              Estoque
            </ItemMenu>
          )}
          {podeVer("notas") && (
            <ItemMenu para={ROTAS.notas} icone={FileText}>
              Notas fiscais
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
          {podeVer("analises") && (
            <ItemMenu para={ROTAS.manejoNutricional} icone={FlaskConical}>
              Manejo nutricional
            </ItemMenu>
          )}
        </>
      )}

      {veConfiguracao && (
        <>
          <div className="group/config pt-5">
            <button
              type="button"
              title="Configurações"
              className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-suave ${
                emConfiguracao
                  ? "bg-mata-600 text-white shadow-cartao"
                  : "text-terra-700 hover:bg-mata-50 hover:text-mata-800"
              }`}
            >
              <span
                className={`absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-limao-400 transition-transform duration-300 ease-suave ${
                  emConfiguracao ? "scale-y-100" : "scale-y-0"
                }`}
                aria-hidden
              />
              <SlidersHorizontal size={17} strokeWidth={2} className="shrink-0" />
              <span className="flex-1 overflow-hidden whitespace-nowrap text-left opacity-100 transition-all duration-300 ease-suave lg:w-0 lg:opacity-0 lg:group-hover:w-auto lg:group-hover:opacity-100">
                Configurações
              </span>
              <ChevronRight
                size={14}
                className="shrink-0 rotate-90 opacity-100 transition-transform duration-300 ease-suave lg:rotate-0 lg:opacity-0 lg:group-hover:opacity-100 lg:group-hover/config:rotate-90"
              />
            </button>
            <div className="grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-suave lg:grid-rows-[0fr] lg:group-hover/config:grid-rows-[1fr]">
              <div className="overflow-hidden">
                <div className="ml-4 mt-1 space-y-0.5 border-l border-terra-200 py-1 pl-3">
                  {(podeVer("cadastros") || podeVer("propriedade")) && (
                    <ItemSubmenu para={ROTAS.cadastros}>Cadastros</ItemSubmenu>
                  )}
                  {podeVer("usuarios") && <ItemSubmenu para={ROTAS.usuarios}>Usuários</ItemSubmenu>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );

  const marca = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terra-50 shadow-cartao">
        <LogoMarca size={24} />
      </div>
      <div className="min-w-0 overflow-hidden opacity-100 transition-all duration-300 ease-suave lg:w-0 lg:opacity-0 lg:group-hover:w-auto lg:group-hover:opacity-100">
        <p className="truncate font-semibold leading-tight tracking-tight text-terra-900">
          {propriedade?.nome ?? "Sítio"}
        </p>
        <p className="truncate text-sm text-terra-600">
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-terra-50 shadow-cartao">
            <LogoMarca size={18} />
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
        className={`group fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-terra-200 bg-white px-4 py-5 transition-[transform,width,box-shadow] duration-300 ease-suave lg:w-[4.5rem] lg:translate-x-0 lg:px-3 lg:hover:w-64 lg:hover:px-4 lg:hover:shadow-2xl ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          {marca}
        </div>

        <div className="flex-1">{navegacao}</div>

        <div className="mt-2 space-y-2 border-t border-terra-200 pt-4">
          {!online && (
            <p
              className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 lg:justify-center lg:px-2 lg:group-hover:justify-start lg:group-hover:px-3"
              title="Sem conexão — dados salvos"
            >
              <WifiOff size={14} className="shrink-0 animate-pulsar" />
              <span className="overflow-hidden whitespace-nowrap lg:hidden lg:group-hover:inline">
                Sem conexão — dados salvos
              </span>
            </p>
          )}
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title="Sair"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-terra-300 px-3 py-2 text-sm font-medium text-terra-700 transition duration-200 hover:border-terra-400 hover:bg-terra-50"
          >
            <LogOut size={15} />
            <span className="lg:hidden lg:group-hover:inline">Sair</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 pt-[4.5rem] sm:p-6 lg:ml-[4.5rem] lg:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
