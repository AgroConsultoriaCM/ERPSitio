import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer, Polygon } from "react-leaflet";
import { api, ApiError } from "../../../lib/api";
import { areaEmHectares, estaDentroDe, formatarArea } from "../../../lib/geoAreas";
import CamadasBaseMapa from "../../../components/CamadasBaseMapa";
import CentralizarMapa from "../../../components/CentralizarMapa";
import DesenhoPoligono from "../../../components/DesenhoPoligono";
import type { PoligonoGeoJSON, Propriedade, SetorIrrigacao, Talhao } from "../../../lib/types";

const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];
const COR_PADRAO = "#0284c7";

export default function NovoSetor() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: propriedade, isLoading: carregandoPropriedade } = useQuery({
    queryKey: ["propriedade"],
    queryFn: () => api.get<Propriedade>("/propriedades/me"),
  });
  // Talhoes entram so como referencia visual - o setor nao precisa respeitar
  // os limites deles.
  const { data: talhoes } = useQuery({
    queryKey: ["talhoes"],
    queryFn: () => api.get<Talhao[]>("/talhoes"),
  });

  const [nome, setNome] = useState("");
  const [corMapa, setCorMapa] = useState(COR_PADRAO);
  const [observacoes, setObservacoes] = useState("");
  const [poligono, setPoligono] = useState<PoligonoGeoJSON | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const centroPropriedade =
    propriedade?.latitude != null && propriedade?.longitude != null
      ? { latitude: propriedade.latitude, longitude: propriedade.longitude }
      : null;

  const areaHa = poligono ? areaEmHectares(poligono) : null;
  const dentroDaPropriedade =
    poligono && propriedade?.poligono ? estaDentroDe(poligono, propriedade.poligono) : null;
  const podeSalvar = !!nome && !!poligono && dentroDaPropriedade === true;

  const criar = useMutation({
    mutationFn: () =>
      api.post<SetorIrrigacao>("/setores-irrigacao", {
        nome,
        poligono,
        corMapa,
        observacoes: observacoes || undefined,
      }),
    onSuccess: (setor) => {
      qc.invalidateQueries({ queryKey: ["setores-irrigacao"] });
      navigate(`/painel/cadastros/setores/${setor.id}`, { replace: true });
    },
    onError: (err) => {
      setErro(err instanceof ApiError ? err.message : "Não foi possível criar o setor");
    },
  });

  if (!carregandoPropriedade && !propriedade?.poligono) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate("/painel/cadastros/setores")} className="text-sm text-gray-500 hover:underline">
          ← Voltar para setores
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Novo setor de irrigação</h1>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          A propriedade ainda não tem contorno cadastrado. Cadastre o polígono em{" "}
          <button onClick={() => navigate("/painel/cadastros/propriedade")} className="font-semibold underline">
            Propriedade
          </button>{" "}
          antes de criar setores.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/painel/cadastros/setores")} className="text-sm text-gray-500 hover:underline">
        ← Voltar para setores
      </button>
      <h1 className="text-2xl font-bold text-gray-800">Novo setor de irrigação</h1>

      {erro && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="max-w-lg space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nome do setor</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Setor 1 - gotejo alto"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Ex: válvula 3, gotejador 4 L/h"
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

        <div className="grid grid-cols-2 gap-3 rounded-md bg-gray-50 p-3 text-sm">
          <div>
            <p className="text-gray-500">Código</p>
            <p className="font-medium text-gray-700">gerado automaticamente</p>
          </div>
          <div>
            <p className="text-gray-500">Área</p>
            <p className="font-medium text-gray-700">
              {areaHa != null ? formatarArea(areaHa) : "calculada ao desenhar"}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-500">
          O tracejado escuro é o limite da propriedade e os contornos claros são os talhões (apenas referência — o
          setor pode cruzá-los livremente). O setor precisa ficar dentro da propriedade.
        </p>

        {poligono && dentroDaPropriedade === false && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            O contorno desenhado sai do limite da propriedade. Ajuste ou apague e desenhe novamente dentro do
            tracejado.
          </div>
        )}
        {poligono && dentroDaPropriedade === true && (
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            Contorno válido, dentro da propriedade — {formatarArea(areaHa!)}.
          </div>
        )}

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
                setErro(null);
              }}
              poligonoReferencia={propriedade?.poligono}
            />
          </MapContainer>
        </div>
      </div>

      <button
        onClick={() => criar.mutate()}
        disabled={!podeSalvar || criar.isPending}
        className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {criar.isPending ? "Criando..." : "Criar setor"}
      </button>
      {!podeSalvar && (
        <p className="text-xs text-gray-500">
          {!nome
            ? "Informe o nome do setor."
            : !poligono
              ? "Desenhe o contorno do setor no mapa."
              : "Ajuste o contorno para ficar dentro da propriedade."}
        </p>
      )}
    </div>
  );
}
