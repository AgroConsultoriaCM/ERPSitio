import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { ABAS_CADASTRO } from "../../lib/rotas";
import type { Propriedade } from "../../lib/types";

export default function CadastrosLayout() {
  const { pathname } = useLocation();
  const { data: propriedade } = useQuery({
    queryKey: ["propriedade"],
    queryFn: () => api.get<Propriedade>("/propriedades/me"),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Cadastros</h1>
        <p className="text-sm text-gray-600">
          {propriedade?.nome ? (
            <>
              Tudo aqui pertence a <span className="font-medium text-gray-700">{propriedade.nome}</span>
              {propriedade.localizacao ? ` · ${propriedade.localizacao}` : ""}.
            </>
          ) : (
            "Cadastros da propriedade."
          )}
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-gray-200">
        {ABAS_CADASTRO.map((aba) => {
          // sub-rotas (ex: talhoes/novo) mantêm a aba pai marcada
          const ativa = pathname === aba.rota || pathname.startsWith(`${aba.rota}/`);
          return (
            <NavLink
              key={aba.rota}
              to={aba.rota}
              title={aba.descricao}
              className={`px-3 py-2 text-sm font-medium ${
                ativa
                  ? "border-b-2 border-green-700 text-green-800"
                  : "text-gray-600 hover:text-gray-700"
              }`}
            >
              {aba.rotula}
            </NavLink>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
