import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Atividade } from "../../lib/types";

const moeda = (v: number | null | undefined) =>
  v == null ? "-" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Atividades() {
  const qc = useQueryClient();
  const { data: atividades } = useQuery({
    queryKey: ["atividades"],
    queryFn: () => api.get<Atividade[]>("/atividades"),
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/atividades/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atividades"] }),
  });

  const custoTotal = atividades?.reduce((s, a) => s + (a.custoMaoDeObra ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Operações</h1>
        <p className="text-sm text-gray-500">
          Poda, desbrota, pulverização, fertirrigação e demais serviços lançados pelo encarregado. O custo de
          terceiros é rateado entre os talhões proporcionalmente à área.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-500">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Operação</th>
              <th className="px-3 py-2">Talhões (rateio)</th>
              <th className="px-3 py-2">Quem fez</th>
              <th className="px-3 py-2">Custo</th>
              <th className="px-3 py-2">Insumos</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {atividades?.map((a) => (
              <tr key={a.id} className="border-t align-top">
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(a.data).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-3 py-2 font-medium">{a.tipoAtividade?.nome}</td>
                <td className="px-3 py-2">
                  <ul className="space-y-0.5">
                    {a.talhoes?.map((t) => (
                      <li key={t.id} className="text-gray-600">
                        {t.talhao.codigo ? `${t.talhao.codigo} · ` : ""}
                        {t.talhao.nome}
                        {t.custoRateado != null && (
                          <span className="ml-1 text-xs text-gray-400">({moeda(t.custoRateado)})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-2">{a.executor?.nome ?? a.responsavel?.nome ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{moeda(a.custoMaoDeObra)}</td>
                <td className="px-3 py-2 text-gray-600">
                  {a.insumos.map((i) => `${i.insumo.nome} (${i.quantidade}${i.unidade})`).join(", ") || "-"}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{a.origem}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-right">
                  <button
                    onClick={() => {
                      if (confirm("Excluir esta operação?")) remover.mutate(a.id);
                    }}
                    className="text-red-600"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {!!atividades?.length && (
            <tfoot>
              <tr className="border-t bg-gray-50 font-medium">
                <td className="px-3 py-2" colSpan={4}>
                  Total ({atividades.length} operações)
                </td>
                <td className="px-3 py-2">{moeda(custoTotal)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
        {atividades?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma operação lançada ainda.</p>
        )}
      </div>
    </div>
  );
}
