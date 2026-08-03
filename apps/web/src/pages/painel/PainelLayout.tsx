import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bug,
  ChevronLeft,
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
  Users,
  WifiOff,
  X,
  FileText,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useOnline } from "../../lib/useOnline";
import { ROTAS } from "../../lib/rotas";
import type { Propriedade } from "../../lib/types";

type Icone = ComponentType<LucideProps>;

const COLAPSADO_KEY = "erpsitio_menu_colapsado";

function ItemMenu({
  para,
  icone: Ico,
  colapsado,
  children,
}: {
  para: string;
  icone: Icone;
  colapsado: boolean;
  children: string;
}) {
  return (
    <NavLink
      to={para}
      end={para === ROTAS.dashboard}
      title={colapsado ? children : undefined}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-suave ${
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
              isActive ? "" : "group-hover:scale-110"
            }`}
          />
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-suave ${
              colapsado ? "w-0 opacity-0" : "w-auto opacity-100"
            }`}
          >
            {children}
          </span>
        </>
      )}
    </NavLink>
  );
}

function GrupoMenu({ children, colapsado }: { children: string; colapsado: boolean }) {
  return (
    <p
      className={`overflow-hidden whitespace-nowrap px-3 pb-1.5 pt-5 rotulo transition-all duration-300 ease-suave ${
        colapsado ? "h-0 pb-0 pt-2 opacity-0" : "opacity-100"
      }`}
    >
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
  const [colapsado, setColapsado] = useState(() => localStorage.getItem(COLAPSADO_KEY) === "1");

  const { data: propriedade } = useQuery({
    queryKey: ["propriedade"],
    queryFn: () => api.get<Propriedade>("/propriedades/me"),
  });

  // Navegar fecha o menu do celular; sem isto o painel abre atrás da gaveta.
  useEffect(() => setMenuAberto(false), [pathname]);

  useEffect(() => {
    localStorage.setItem(COLAPSADO_KEY, colapsado ? "1" : "0");
  }, [colapsado]);

  const emCadastros = pathname.startsWith(ROTAS.cadastros);
  const veDiaADia = podeVer("colheitas") || podeVer("operacoes") || podeVer("estoque") || podeVer("notas");
  const veAcompanhamento = podeVer("pragas") || podeVer("irrigacao") || podeVer("analises");
  const veConfiguracao = podeVer("cadastros") || podeVer("propriedade") || podeVer("usuarios");

  const navegacao = (
    <nav className="space-y-1">
      {podeVer("dashboard") && (
        <ItemMenu para={ROTAS.dashboard} icone={LayoutDashboard} colapsado={colapsado}>
          Painel
        </ItemMenu>
      )}
      {podeVer("mapa") && (
        <ItemMenu para={ROTAS.mapa} icone={Map} colapsado={colapsado}>
          Mapa da propriedade
        </ItemMenu>
      )}

      {veDiaADia && (
        <>
          <GrupoMenu colapsado={colapsado}>Dia a dia</GrupoMenu>
          {podeVer("colheitas") && (
            <ItemMenu para={ROTAS.colheitas} icone={Citrus} colapsado={colapsado}>
              Colheitas
            </ItemMenu>
          )}
          {podeVer("operacoes") && (
            <ItemMenu para={ROTAS.operacoes} icone={ClipboardList} colapsado={colapsado}>
              Operações
            </ItemMenu>
          )}
          {podeVer("operacoes") && (
            <ItemMenu para={ROTAS.pulverizacoes} icone={SprayCan} colapsado={colapsado}>
              Pulverizações
            </ItemMenu>
          )}
          {podeVer("estoque") && (
            <ItemMenu para={ROTAS.estoque} icone={Package} colapsado={colapsado}>
              Estoque
            </ItemMenu>
          )}
          {podeVer("notas") && (
            <ItemMenu para={ROTAS.notas} icone={FileText} colapsado={colapsado}>
              Notas fiscais
            </ItemMenu>
          )}
        </>
      )}

      {veAcompanhamento && (
        <>
          <GrupoMenu colapsado={colapsado}>Acompanhamento</GrupoMenu>
          {podeVer("pragas") && (
            <ItemMenu para={ROTAS.pragas} icone={Bug} colapsado={colapsado}>
              Controle de pragas
            </ItemMenu>
          )}
          {podeVer("irrigacao") && (
            <ItemMenu para={ROTAS.irrigacao} icone={Droplets} colapsado={colapsado}>
              Manejo hídrico
            </ItemMenu>
          )}
          {podeVer("analises") && (
            <ItemMenu para={ROTAS.manejoNutricional} icone={FlaskConical} colapsado={colapsado}>
              Manejo nutricional
            </ItemMenu>
          )}
        </>
      )}

      {veConfiguracao && (
        <>
          <GrupoMenu colapsado={colapsado}>Configuração</GrupoMenu>
          {(podeVer("cadastros") || podeVer("propriedade")) && (
            <NavLink
              to={ROTAS.cadastros}
              title={colapsado ? "Cadastros" : undefined}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-suave ${
                emCadastros
                  ? "bg-mata-600 text-white shadow-cartao"
                  : "text-terra-700 hover:bg-mata-50 hover:text-mata-800"
              }`}
            >
              <span
                className={`absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-limao-400 transition-transform duration-300 ease-suave ${
                  emCadastros ? "scale-y-100" : "scale-y-0"
                }`}
                aria-hidden
              />
              <SlidersHorizontal size={17} strokeWidth={2} className="shrink-0" />
              <span
                className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-suave ${
                  colapsado ? "w-0 opacity-0" : "w-auto opacity-100"
                }`}
              >
                Cadastros
              </span>
            </NavLink>
          )}
          {podeVer("usuarios") && (
            <ItemMenu para={ROTAS.usuarios} icone={Users} colapsado={colapsado}>
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
      <div className={`min-w-0 overflow-hidden transition-all duration-300 ease-suave ${colapsado ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"}`}>
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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-terra-200 bg-white px-4 py-5 transition-[transform,width] duration-300 ease-suave lg:static lg:translate-x-0 ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        } ${colapsado ? "lg:w-[4.5rem] lg:px-3" : "lg:w-64"}`}
      >
        <div className="mb-6 flex items-center justify-between">
          {marca}
        </div>

        <div className="flex-1">{navegacao}</div>

        {/* Botão de colapsar: só no desktop, gaveta do celular já tem seu próprio fechar. */}
        <button
          onClick={() => setColapsado((v) => !v)}
          className="mb-2 hidden items-center justify-center gap-2 rounded-lg border border-terra-200 py-2 text-terra-500 transition duration-200 hover:border-terra-300 hover:bg-terra-50 hover:text-terra-700 lg:flex"
          aria-label={colapsado ? "Expandir menu" : "Recolher menu"}
          title={colapsado ? "Expandir menu" : "Recolher menu"}
        >
          <ChevronLeft
            size={16}
            className={`transition-transform duration-300 ease-suave ${colapsado ? "rotate-180" : ""}`}
          />
        </button>

        <div className="mt-2 space-y-2 border-t border-terra-200 pt-4">
          {!online && (
            <p
              className={`flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ${colapsado ? "lg:justify-center lg:px-2" : ""}`}
              title={colapsado ? "Sem conexão — dados salvos" : undefined}
            >
              <WifiOff size={14} className="shrink-0 animate-pulsar" />
              <span className={`overflow-hidden whitespace-nowrap ${colapsado ? "lg:hidden" : ""}`}>
                Sem conexão — dados salvos
              </span>
            </p>
          )}
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title={colapsado ? "Sair" : undefined}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-terra-300 px-3 py-2 text-sm font-medium text-terra-700 transition duration-200 hover:border-terra-400 hover:bg-terra-50`}
          >
            <LogOut size={15} />
            <span className={colapsado ? "lg:hidden" : ""}>Sair</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 pt-[4.5rem] sm:p-6 lg:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
