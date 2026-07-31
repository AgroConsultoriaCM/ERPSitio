import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ExigePermissao, ProtectedRoute, SomenteGestao } from "./components/ProtectedRoute";
import { useAuth } from "./lib/auth";
import { ROTAS } from "./lib/rotas";

// Carregado de imediato: é o caminho crítico do celular no campo, muitas vezes
// em sinal ruim. Login e as três telas de lançamento têm que abrir na hora.
import Login from "./pages/Login";
import CampoLayout from "./pages/campo/CampoLayout";
import CampoHome from "./pages/campo/CampoHome";
import NovaAtividade from "./pages/campo/NovaAtividade";
import RegistrarColheita from "./pages/campo/RegistrarColheita";

// O painel só é aberto no navegador, com internet. Carregar sob demanda tira o
// mapa (Leaflet) e os gráficos (Recharts) do primeiro download de quem só vai
// lançar caixa no meio do talhão.
const PainelLayout = lazy(() => import("./pages/painel/PainelLayout"));
const Dashboard = lazy(() => import("./pages/painel/Dashboard"));
const Mapa = lazy(() => import("./pages/painel/Mapa"));
const Colheitas = lazy(() => import("./pages/painel/Colheitas"));
const Atividades = lazy(() => import("./pages/painel/Atividades"));
const Pragas = lazy(() => import("./pages/painel/Pragas"));
const Irrigacao = lazy(() => import("./pages/painel/Irrigacao"));
const Estoque = lazy(() => import("./pages/painel/Estoque"));
const Notas = lazy(() => import("./pages/painel/Notas"));
const Usuarios = lazy(() => import("./pages/painel/Usuarios"));
const CadastrosLayout = lazy(() => import("./pages/painel/CadastrosLayout"));
const Propriedade = lazy(() => import("./pages/painel/Propriedade"));
const Talhoes = lazy(() => import("./pages/painel/Talhoes"));
const TalhaoDetalhe = lazy(() => import("./pages/painel/talhao/TalhaoDetalhe"));
const NovoTalhao = lazy(() => import("./pages/painel/talhao/NovoTalhao"));
const SetoresIrrigacao = lazy(() => import("./pages/painel/setor/SetoresIrrigacao"));
const NovoSetor = lazy(() => import("./pages/painel/setor/NovoSetor"));
const SetorDetalhe = lazy(() => import("./pages/painel/setor/SetorDetalhe"));
const Grupos = lazy(() => import("./pages/painel/Grupos"));
const Culturas = lazy(() => import("./pages/painel/Culturas"));
const Executores = lazy(() => import("./pages/painel/Executores"));
const Insumos = lazy(() => import("./pages/painel/Insumos"));
const PerfisCorrecao = lazy(() => import("./pages/painel/PerfisCorrecao"));

function Carregando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-terra-100">
      <div className="flex items-center gap-3 text-sm text-terra-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-terra-300 border-t-mata-600" />
        Carregando…
      </div>
    </div>
  );
}

function Raiz() {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <Navigate to={usuario.role === "ENCARREGADO" ? "/campo" : "/painel"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Raiz />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/campo" element={<CampoLayout />}>
              <Route index element={<CampoHome />} />
              <Route path="nova" element={<NovaAtividade />} />
              <Route path="colheita" element={<RegistrarColheita />} />
            </Route>

            <Route element={<SomenteGestao />}>
              <Route path="/painel" element={<PainelLayout />}>
                <Route index element={<Dashboard />} />
                <Route element={<ExigePermissao modulo="mapa" />}>
                  <Route path="mapa" element={<Mapa />} />
                </Route>
                <Route element={<ExigePermissao modulo="colheitas" />}>
                  <Route path="colheitas" element={<Colheitas />} />
                </Route>
                <Route element={<ExigePermissao modulo="operacoes" />}>
                  <Route path="atividades" element={<Atividades />} />
                </Route>
                <Route element={<ExigePermissao modulo="pragas" />}>
                  <Route path="pragas" element={<Pragas />} />
                </Route>
                <Route element={<ExigePermissao modulo="irrigacao" />}>
                  <Route path="irrigacao" element={<Irrigacao />} />
                </Route>
                <Route element={<ExigePermissao modulo="estoque" />}>
                  <Route path="estoque" element={<Estoque />} />
                  <Route path="notas" element={<Notas />} />
                </Route>
                <Route element={<ExigePermissao modulo="usuarios" />}>
                  <Route path="usuarios" element={<Usuarios />} />
                </Route>

                <Route path="cadastros" element={<CadastrosLayout />}>
                  <Route index element={<Navigate to={ROTAS.propriedade} replace />} />
                  <Route path="propriedade" element={<Propriedade />} />
                  <Route path="talhoes" element={<Talhoes />} />
                  {/* rota literal antes da dinamica para "novo" nao cair em :id */}
                  <Route path="talhoes/novo" element={<NovoTalhao />} />
                  <Route path="talhoes/:id" element={<TalhaoDetalhe />} />
                  <Route path="setores" element={<SetoresIrrigacao />} />
                  <Route path="setores/novo" element={<NovoSetor />} />
                  <Route path="setores/:id" element={<SetorDetalhe />} />
                  <Route path="grupos" element={<Grupos />} />
                  <Route path="culturas" element={<Culturas />} />
                  <Route path="executores" element={<Executores />} />
                  <Route path="insumos" element={<Insumos />} />
                  <Route path="perfis-correcao" element={<PerfisCorrecao />} />
                </Route>

                {/* rotas antigas -> novo lugar, para links salvos continuarem valendo */}
                <Route path="propriedade" element={<Navigate to={ROTAS.propriedade} replace />} />
                <Route path="talhoes" element={<Navigate to={ROTAS.talhoes} replace />} />
                <Route path="setores" element={<Navigate to={ROTAS.setores} replace />} />
                <Route path="grupos" element={<Navigate to={ROTAS.grupos} replace />} />
                <Route path="culturas" element={<Navigate to={ROTAS.culturas} replace />} />
                <Route path="executores" element={<Navigate to={ROTAS.executores} replace />} />
                <Route path="insumos" element={<Navigate to={ROTAS.insumos} replace />} />
                <Route
                  path="perfis-correcao"
                  element={<Navigate to={ROTAS.perfisCorrecao} replace />}
                />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
