import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../../lib/api";
import type { SetorIrrigacao } from "../../../lib/types";

export default function SetoresIrrigacao() {
  const { data: setores } = useQuery({
    queryKey: ["setores-irrigacao"],
    queryFn: () => api.get<SetorIrrigacao[]>("/setores-irrigacao"),
  });

  const areaTotal = setores?.reduce((soma, s) => soma + (s.areaHa ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Setores de irrigação</h1>
          <p className="text-sm text-gray-500">
            Camada independente dos talhões — um setor pode cobrir partes de vários talhões. Base para o manejo
            hídrico.
          </p>
        </div>
        <Link
          to="/painel/cadastros/setores/novo"
          className="shrink-0 rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white"
        >
          + Novo setor
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Área (ha)</th>
              <th className="px-4 py-2">Observações</th>
            </tr>
          </thead>
          <tbody>
            {setores?.map((s) => (
              <tr key={s.id} className="border-t hover:bg-sky-50">
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: s.corMapa ?? "#0284c7" }}
                    />
                    <Link to={`/painel/cadastros/setores/${s.id}`} className="text-sky-800 hover:underline">
                      {s.nome}
                    </Link>
                  </span>
                </td>
                <td className="px-4 py-2">{s.codigo ?? "-"}</td>
                <td className="px-4 py-2">
                  {s.areaHa != null ? s.areaHa.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "-"}
                </td>
                <td className="px-4 py-2 text-gray-500">{s.observacoes ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {setores?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            Nenhum setor de irrigação cadastrado ainda.
          </p>
        )}
        {!!setores?.length && (
          <p className="border-t bg-gray-50 px-4 py-2 text-sm text-gray-600">
            {setores.length} setor{setores.length > 1 ? "es" : ""} · área somada{" "}
            {areaTotal.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} ha
          </p>
        )}
      </div>
    </div>
  );
}
