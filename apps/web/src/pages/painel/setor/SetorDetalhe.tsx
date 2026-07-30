import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer, Polygon } from "react-leaflet";
import { api, ApiError } from "../../../lib/api";
import { formatarArea } from "../../../lib/geoAreas";
import CamadasBaseMapa from "../../../components/CamadasBaseMapa";
import CentralizarMapa from "../../../components/CentralizarMapa";
import DesenhoPoligono from "../../../components/DesenhoPoligono";
import type { PoligonoGeoJSON, Propriedade, SetorIrrigacao, Talhao } from "../../../lib/types";

const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];

type Aba = "dados" | "mapa";

export default function SetorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: setor } = useQuery({
    queryKey: ["setor", id],
    queryFn: () => api.get<SetorIrrigacao>(`/setores-irrigacao/${id}`),
  });
  const { data: propriedade } = useQuery({
    queryKey: ["propriedade"],
    queryFn: () => api.get<Propriedade>("/propriedades/me"),
  });
  const { data: talhoes } = useQuery({
    queryKey: ["talhoes"],
    queryFn: () => api.get<Talhao[]>("/talhoes"),
  });

  const [aba, setAba] = useState<Aba>("dados");
  const [nome, setNome] = useState("");
  const [corMapa, setCorMapa] = useState("#0284c7");
  const [observacoes, setObservacoes] = useState("");
  const [poligono, setPoligono] = useState<PoligonoGeoJSON | null>(null);
  const [erroPoligono, setErroPoligono] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    if (setor) {
      setNome(setor.nome);
      setCorMapa(setor.corMapa ?? "#0284c7");
      setObservacoes(setor.observacoes ?? "");
      setPoligono(setor.poligono ?? null);
    }
  }, [setor]);

  const centroPropriedade =
    propriedade?.latitude != null && propriedade?.longitude != null
      ? { latitude: propriedade.latitude, longitude: propriedade.longitude }
      : null;

  const salvar = useMutation({
    mutationFn: () =>
      api.patch<SetorIrrigacao>(`/setores-irrigacao/${id}`, {
        nome,
        corMapa,
        observacoes: observacoes || undefined,
      }),
    onSuccess: () => {
      setMensagem("Alterações salvas.");
      qc.invalidateQueries({ queryKey: ["setores-irrigacao"] });
      qc.invalidateQueries({ queryKey: ["setor", id] });
    },
    onError: (err) => {
      setMensagem(err instanceof ApiError ? err.message : "Não foi possível salvar");
    },
  });

  const salvarPoligono = useMutation({
    mutationFn: (novo: PoligonoGeoJSON | null) =>
      api.patch<SetorIrrigacao>(`/setores-irrigacao/${id}`, { poligono: novo }),
    onSuccess: () => {
      setErroPoligono(null);
      qc.invalidateQueries({ queryKey: ["setor", id] });
      qc.invalidateQueries({ queryKey: ["setores-irrigacao"] });
    },
    onError: (err) => {
      setErroPoligono(err instanceof ApiError ? err.message : "Não foi possível salvar o contorno");
      setPoligono(setor?.poligono ?? null);
    },
  });

  const remover = useMutation({
    mutationFn: () => api.delete(`/setores-irrigacao/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["setores-irrigacao"] });
      navigate("/painel/cadastros/setores");
    },
  });

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/painel/cadastros/setores")} className="text-sm text-gray-500 hover:underline">
        ← Voltar para setores
      </button>
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold text-gray-800">{setor?.nome ?? "..."}</h1>
        {setor?.codigo && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">{setor.codigo}</span>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            ["dados", "Dados"],
            ["mapa", "Mapa / Polígono"],
          ] as [Aba, string][]
        ).map(([valor, label]) => (
          <button
            key={valor}
            onClick={() => setAba(valor)}
            className={`px-4 py-2 text-sm font-medium ${
              aba === valor ? "border-b-2 border-sky-700 text-sky-800" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === "dados" && (
        <div className="max-w-lg space-y-3 rounded-xl bg-white p-4 shadow-sm">
          {mensagem && (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                salvar.isError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"
              }`}
            >
              {mensagem}
            </div>
          )}

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
              <p className="text-gray-500">Código</p>
              <p className="font-medium text-gray-700">{setor?.codigo ?? "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Área (do contorno)</p>
              <p className="font-medium text-gray-700">
                {setor?.areaHa != null ? formatarArea(setor.areaHa) : "-"}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
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

          <div className="flex items-center gap-3">
            <button
              onClick={() => salvar.mutate()}
              disabled={!nome || salvar.isPending}
              className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Salvar alterações
            </button>
            <button
              onClick={() => {
                if (confirm(`Excluir o setor "${setor?.nome}"? Esta ação não pode ser desfeita.`)) {
                  remover.mutate();
                }
              }}
              className="text-sm text-red-600 hover:underline"
            >
              Excluir setor
            </button>
          </div>
        </div>
      )}

      {aba === "mapa" && (
        <div className="space-y-2">
          {erroPoligono && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroPoligono}</div>
          )}
          <p className="text-sm text-gray-500">
            Tracejado escuro = limite da propriedade. Contornos claros = talhões (referência apenas). Redesenhar o
            contorno recalcula a área automaticamente.
          </p>
          <div className="h-[60vh] overflow-hidden rounded-xl shadow-sm">
            <MapContainer center={CENTRO_BRASIL} zoom={4} className="h-full w-full">
              <CamadasBaseMapa />
              {!poligono && <CentralizarMapa poligono={propriedade?.poligono} centro={centroPropriedade} />}
              {talhoes
                ?.filter((t) => t.poligono)
                .map((t) => (
                  <Polygon
                    key={t.id}
                    positions={t.poligono!.coordinates[0].map(([lng, lat]) => [lat, lng])}
                    pathOptions={{
                      color: t.corMapa ?? "#16a34a",
                      weight: 1,
                      opacity: 0.5,
                      fillOpacity: 0.05,
                    }}
                    interactive={false}
                  />
                ))}
              <DesenhoPoligono
                valor={poligono}
                onChange={(p) => {
                  setPoligono(p);
                  salvarPoligono.mutate(p);
                }}
                poligonoReferencia={propriedade?.poligono}
              />
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}
