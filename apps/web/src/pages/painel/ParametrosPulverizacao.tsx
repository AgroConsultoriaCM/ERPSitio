import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { ParametroPulverizacao } from "../../lib/types";
import { Aviso } from "../../components/ui";

const campoNumerico = (label: string, ajuda: string, valor: string, onChange: (v: string) => void) => (
  <div>
    <label className="mb-1 block text-xs text-gray-600">{label}</label>
    <input
      type="number"
      step="any"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
    />
    <p className="mt-0.5 text-xs text-gray-600">{ajuda}</p>
  </div>
);

export default function ParametrosPulverizacao() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["parametros-pulverizacao"],
    queryFn: () => api.get<ParametroPulverizacao>("/parametros-pulverizacao"),
  });

  const [campos, setCampos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setCampos({
      chuvaMmZero: String(data.chuvaMmZero),
      chuvaProbPctZero: String(data.chuvaProbPctZero),
      ventoIdealMinKmh: String(data.ventoIdealMinKmh),
      ventoIdealMaxKmh: String(data.ventoIdealMaxKmh),
      ventoZeroBaixoKmh: String(data.ventoZeroBaixoKmh),
      ventoZeroAltoKmh: String(data.ventoZeroAltoKmh),
      umidadeIdealMinPct: String(data.umidadeIdealMinPct),
      umidadeZeroPct: String(data.umidadeZeroPct),
      kcCultura: String(data.kcCultura),
    });
  }, [data]);

  const salvar = useMutation({
    mutationFn: () =>
      api.patch("/parametros-pulverizacao", Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, Number(v)]))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parametros-pulverizacao"] }),
  });

  if (!data || Object.keys(campos).length === 0) {
    return <p className="text-sm text-gray-600">Carregando…</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Janela de pulverização</h1>
        <p className="text-sm text-gray-600">
          Parâmetros ideais usados para calcular o score de 0 a 100% de cada dia no bloco "Clima e água" do
          painel. Ajuste conforme o conhecimento técnico da propriedade — não é literatura fechada.
        </p>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-3 font-semibold text-gray-800">Chuva</p>
        <div className="grid grid-cols-2 gap-3">
          {campoNumerico(
            "Chuva (mm) que zera o score",
            "0 mm = 100%; a partir daqui, 0%.",
            campos.chuvaMmZero,
            (v) => setCampos((c) => ({ ...c, chuvaMmZero: v })),
          )}
          {campoNumerico(
            "Probabilidade de chuva (%) que zera o score",
            "0% de chance = 100%; a partir daqui, 0%.",
            campos.chuvaProbPctZero,
            (v) => setCampos((c) => ({ ...c, chuvaProbPctZero: v })),
          )}
        </div>

        <p className="mb-3 mt-5 font-semibold text-gray-800">Vento (km/h)</p>
        <div className="grid grid-cols-2 gap-3">
          {campoNumerico(
            "Ideal mínimo",
            "Abaixo disso, risco de inversão térmica.",
            campos.ventoIdealMinKmh,
            (v) => setCampos((c) => ({ ...c, ventoIdealMinKmh: v })),
          )}
          {campoNumerico(
            "Ideal máximo",
            "Acima disso, risco de deriva.",
            campos.ventoIdealMaxKmh,
            (v) => setCampos((c) => ({ ...c, ventoIdealMaxKmh: v })),
          )}
          {campoNumerico(
            "Zera o score (abaixo)",
            "Vento fraco demais — score 0%.",
            campos.ventoZeroBaixoKmh,
            (v) => setCampos((c) => ({ ...c, ventoZeroBaixoKmh: v })),
          )}
          {campoNumerico(
            "Zera o score (acima)",
            "Vento forte demais — score 0%.",
            campos.ventoZeroAltoKmh,
            (v) => setCampos((c) => ({ ...c, ventoZeroAltoKmh: v })),
          )}
        </div>

        <p className="mb-3 mt-5 font-semibold text-gray-800">Umidade relativa (%)</p>
        <div className="grid grid-cols-2 gap-3">
          {campoNumerico(
            "Ideal mínima",
            "A partir daqui, 100%.",
            campos.umidadeIdealMinPct,
            (v) => setCampos((c) => ({ ...c, umidadeIdealMinPct: v })),
          )}
          {campoNumerico(
            "Zera o score",
            "Umidade baixa demais — score 0%.",
            campos.umidadeZeroPct,
            (v) => setCampos((c) => ({ ...c, umidadeZeroPct: v })),
          )}
        </div>

        <p className="mb-3 mt-5 font-semibold text-gray-800">Balanço hídrico</p>
        <div className="grid grid-cols-2 gap-3">
          {campoNumerico(
            "Coeficiente de cultura (Kc)",
            "Usado no saldo hídrico de 7 dias (demanda = ET0 × Kc). 0,70 é a referência para citros adulto.",
            campos.kcCultura,
            (v) => setCampos((c) => ({ ...c, kcCultura: v })),
          )}
        </div>

        {salvar.isSuccess && (
          <div className="mt-4">
            <Aviso tom="mata" titulo="Parâmetros salvos." />
          </div>
        )}
        <div className="mt-4">
          <button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
