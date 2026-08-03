import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../../lib/api";
import { estimarPlantas, formatarArea } from "../../../lib/geoAreas";
import type { Cultura, PoligonoGeoJSON, Talhao } from "../../../lib/types";
import AbaMapa from "./AbaMapa";
import AbaSafras from "./AbaSafras";
import AbaAnalises from "./AbaAnalises";
import AbaSatelite from "./AbaSatelite";

type Aba = "dados" | "mapa" | "safras" | "analises" | "satelite";

export default function TalhaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: talhao } = useQuery({
    queryKey: ["talhao", id],
    queryFn: () => api.get<Talhao>(`/talhoes/${id}`),
  });
  const { data: culturas } = useQuery({ queryKey: ["culturas"], queryFn: () => api.get<Cultura[]>("/culturas") });

  const [aba, setAba] = useState<Aba>("dados");
  const [nome, setNome] = useState("");
  const [culturaId, setCulturaId] = useState("");
  const [dataPlantio, setDataPlantio] = useState("");
  const [entrePlantas, setEntrePlantas] = useState("");
  const [entreLinhas, setEntreLinhas] = useState("");
  const [status, setStatus] = useState<Talhao["status"]>("ATIVO");
  const [corMapa, setCorMapa] = useState("#16a34a");
  const [poligono, setPoligono] = useState<PoligonoGeoJSON | null>(null);
  const [erroPoligono, setErroPoligono] = useState<string | null>(null);

  const plantasEstimadas = estimarPlantas(
    talhao?.areaHa,
    entrePlantas ? Number(entrePlantas) : null,
    entreLinhas ? Number(entreLinhas) : null,
  );

  useEffect(() => {
    if (talhao) {
      setNome(talhao.nome);
      setCulturaId(talhao.culturaId ?? "");
      setDataPlantio(talhao.dataPlantio ? talhao.dataPlantio.slice(0, 10) : "");
      setEntrePlantas(talhao.espacamentoEntrePlantas?.toString() ?? "");
      setEntreLinhas(talhao.espacamentoEntreLinhas?.toString() ?? "");
      setStatus(talhao.status);
      setCorMapa(talhao.corMapa ?? "#16a34a");
      setPoligono(talhao.poligono ?? null);
    }
  }, [talhao]);

  const salvar = useMutation({
    mutationFn: () =>
      api.patch<Talhao>(`/talhoes/${id}`, {
        nome,
        culturaId: culturaId || null,
        dataPlantio: dataPlantio || undefined,
        espacamentoEntrePlantas: entrePlantas ? Number(entrePlantas) : null,
        espacamentoEntreLinhas: entreLinhas ? Number(entreLinhas) : null,
        status,
        corMapa,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["talhoes"] });
      qc.invalidateQueries({ queryKey: ["talhao", id] });
    },
  });

  // Redesenhar o contorno recalcula a area no servidor, entao a resposta
  // atualiza tanto o poligono quanto a area exibida.
  const salvarPoligono = useMutation({
    mutationFn: (novoPoligono: PoligonoGeoJSON | null) =>
      api.patch<Talhao>(`/talhoes/${id}`, { poligono: novoPoligono }),
    onSuccess: () => {
      setErroPoligono(null);
      qc.invalidateQueries({ queryKey: ["talhao", id] });
      qc.invalidateQueries({ queryKey: ["talhoes"] });
    },
    onError: (err) => {
      setErroPoligono(err instanceof ApiError ? err.message : "Não foi possível salvar o contorno");
      // volta para o contorno que esta salvo no servidor
      setPoligono(talhao?.poligono ?? null);
    },
  });

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/painel/cadastros/talhoes")} className="text-sm text-gray-600 hover:underline">
        ← Voltar para talhões
      </button>
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold text-gray-800">{talhao?.nome ?? "..."}</h1>
        {talhao?.codigo && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
            {talhao.codigo}
          </span>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            ["dados", "Dados"],
            ["mapa", "Mapa / Polígono"],
            ["safras", "Safras"],
            ["analises", "Análises de solo/folha"],
            ["satelite", "Satélite"],
          ] as [Aba, string][]
        ).map(([valor, label]) => (
          <button
            key={valor}
            onClick={() => setAba(valor)}
            className={`px-4 py-2 text-sm font-medium ${
              aba === valor ? "border-b-2 border-green-700 text-green-800" : "text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === "dados" && (
        <div className="max-w-lg space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-md bg-gray-50 p-3 text-sm">
            <div>
              <p className="text-gray-600">Código</p>
              <p className="font-medium text-gray-700">{talhao?.codigo ?? "-"}</p>
            </div>
            <div>
              <p className="text-gray-600">Área (do contorno)</p>
              <p className="font-medium text-gray-700">
                {talhao?.areaHa != null ? formatarArea(talhao.areaHa) : "-"}
              </p>
            </div>
            {plantasEstimadas != null && (
              <div className="col-span-2">
                <p className="text-gray-600">Plantas estimadas</p>
                <p className="font-medium text-gray-700">~{plantasEstimadas.toLocaleString("pt-BR")} plantas</p>
              </div>
            )}
            <p className="col-span-2 text-xs text-gray-500">
              Gerados automaticamente. A área é recalculada quando o contorno é redesenhado na aba Mapa/Polígono.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Cultura</label>
            <select
              value={culturaId}
              onChange={(e) => setCulturaId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {culturas?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c.variedade ? `- ${c.variedade}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Necessária para o diagnóstico de solo comparar com o perfil de correção da cultura.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Entre plantas (m)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={entrePlantas}
                onChange={(e) => setEntrePlantas(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Entre linhas (m)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={entreLinhas}
                onChange={(e) => setEntreLinhas(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Data de plantio</label>
              <input
                type="date"
                value={dataPlantio}
                onChange={(e) => setDataPlantio(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Talhao["status"])}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="EM_FORMACAO">Em formação</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Cor no mapa</label>
            <input
              type="color"
              value={corMapa}
              onChange={(e) => setCorMapa(e.target.value)}
              className="h-9 w-16 rounded-md border border-gray-300"
            />
          </div>
          <button
            onClick={() => salvar.mutate()}
            disabled={!nome || salvar.isPending}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Salvar alterações
          </button>
        </div>
      )}

      {aba === "mapa" && (
        <>
          {erroPoligono && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroPoligono}</div>
          )}
          <AbaMapa
            poligono={poligono}
            onChange={(p) => {
              setPoligono(p);
              salvarPoligono.mutate(p);
            }}
          />
        </>
      )}

      {aba === "safras" && <AbaSafras talhaoId={id!} />}

      {aba === "analises" && <AbaAnalises talhaoId={id!} />}

      {aba === "satelite" && <AbaSatelite talhaoId={id!} />}
    </div>
  );
}
