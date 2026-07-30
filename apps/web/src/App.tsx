import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ExigePermissao, ProtectedRoute, SomenteGestao } from "./components/ProtectedRoute";
import { useAuth } from "./lib/auth";
import { ROTAS } from "./lib/rotas";
import Login from "./pages/Login";
import CampoLayout from "./pages/campo/CampoLayout";
import CampoHome from "./pages/campo/CampoHome";
import NovaAtividade from "./pages/campo/NovaAtividade";
import RegistrarColheita from "./pages/campo/RegistrarColheita";
import PainelLayout from "./pages/painel/PainelLayout";
import Dashboard from "./pages/painel/Dashboard";
import Mapa from "./pages/painel/Mapa";
import Colheitas from "./pages/painel/Colheitas";
import Atividades from "./pages/painel/Atividades";
import Pragas from "./pages/painel/Pragas";
import Irrigacao from "./pages/painel/Irrigacao";
import Estoque from "./pages/painel/Estoque";
import Usuarios from "./pages/painel/Usuarios";
// cadastros
import CadastrosLayout from "./pages/painel/CadastrosLayout";
import Propriedade from "./pages/painel/Propriedade";
import Talhoes from "./pages/painel/Talhoes";
import TalhaoDetalhe from "./pages/painel/talhao/TalhaoDetalhe";
import NovoTalhao from "./pages/painel/talhao/NovoTalhao";
import SetoresIrrigacao from "./pages/painel/setor/SetoresIrrigacao";
import NovoSetor from "./pages/painel/setor/NovoSetor";
import SetorDetalhe from "./pages/painel/setor/SetorDetalhe";
import Grupos from "./pages/painel/Grupos";
import Culturas from "./pages/painel/Culturas";
import Executores from "./pages/painel/Executores";
import Insumos from "./pages/painel/Insumos";
import PerfisCorrecao from "./pages/painel/PerfisCorrecao";

function Raiz() {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <Navigate to={usuario.role === "ENCARREGADO" ? "/campo" : "/painel"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
