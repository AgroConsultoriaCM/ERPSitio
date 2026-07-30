import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import type { Talhao } from "../../lib/types";

const statusLabel: Record<Talhao["status"], string> = {
  EM_FORMACAO: "Em formação",
  ATIVO: "Ativo",
  INATIVO: "Inativo",
};

export default function Talhoes() {
  const { data: talhoes } = useQuery({ queryKey: ["talhoes"], queryFn: () => api.get<Talhao[]>("/talhoes") });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Talhões</h1>
        <Link to="/painel/cadastros/talhoes/novo" className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white">
          + Novo talhão
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Cultura</th>
              <th className="px-4 py-2">Área (ha)</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {talhoes?.map((t) => (
              <tr key={t.id} className="cursor-pointer border-t hover:bg-green-50">
                <td className="px-4 py-2">
                  <Link to={`/painel/cadastros/talhoes/${t.id}`} className="text-green-800 hover:underline">
                    {t.nome}
                  </Link>
                </td>
                <td className="px-4 py-2">{t.codigo ?? "-"}</td>
                <td className="px-4 py-2">
                  {t.cultura ? `${t.cultura.nome}${t.cultura.variedade ? " - " + t.cultura.variedade : ""}` : "-"}
                </td>
                <td className="px-4 py-2">
                  {t.areaHa != null ? t.areaHa.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "-"}
                </td>
                <td className="px-4 py-2">{statusLabel[t.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {talhoes?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            Nenhum talhão cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
