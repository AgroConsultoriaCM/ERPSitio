import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer } from "react-leaflet";
import { api, ApiError } from "../../../lib/api";
import { areaEmHectares, estaDentroDe, estimarPlantas, formatarArea } from "../../../lib/geoAreas";
import CamadasBaseMapa from "../../../components/CamadasBaseMapa";
import CentralizarMapa from "../../../components/CentralizarMapa";
import DesenhoPoligono from "../../../components/DesenhoPoligono";
import type { Cultura, PoligonoGeoJSON, Propriedade, Talhao } from "../../../lib/types";

const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];

export default function NovoTalhao() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: propriedade, isLoading: carregandoPropriedade } = useQuery({
    queryKey: ["propriedade"],
    queryFn: () => api.get<Propriedade>("/propriedades/me"),
  });
  const { data: culturas } = useQuery({
    queryKey: ["culturas"],
    queryFn: () => api.get<Cultura[]>("/culturas"),
  });

  const [nome, setNome] = useState("");
  const [culturaId, setCulturaId] = useState("");
  const [dataPlantio, setDataPlantio] = useState("");
  const [entrePlantas, setEntrePlantas] = useState("");
  const [entreLinhas, setEntreLinhas] = useState("");
  const [poligono, setPoligono] = useState<PoligonoGeoJSON | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const centroPropriedade =
    propriedade?.latitude != null && propriedade?.longitude != null
      ? { latitude: propriedade.latitude, longitude: propriedade.longitude }
      : null;

  const areaHa = poligono ? areaEmHectares(poligono) : null;
  const plantasEstimadas = estimarPlantas(
    areaHa,
    entrePlantas ? Number(entrePlantas) : null,
    entreLinhas ? Number(entreLinhas) : null,
  );
  const dentroDaPropriedade =
    poligono && propriedade?.poligono ? estaDentroDe(poligono, propriedade.poligono) : null;

  const podeSalvar = !!nome && !!poligono && dentroDaPropriedade === true;

  const criar = useMutation({
    mutationFn: () =>
      api.post<Talhao>("/talhoes", {
        nome,
        poligono,
        culturaId: culturaId || null,
        dataPlantio: dataPlantio || undefined,
        espacamentoEntrePlantas: entrePlantas ? Number(entrePlantas) : null,
        espacamentoEntreLinhas: entreLinhas ? Number(entreLinhas) : null,
      }),
    onSuccess: (talhao) => {
      qc.invalidateQueries({ queryKey: ["talhoes"] });
      navigate(`/painel/cadastros/talhoes/${talhao.id}`, { replace: true });
    },
    onError: (err) => {
      setErro(err instanceof ApiError ? err.message : "Não foi possível criar o talhão");
    },
  });

  if (!carregandoPropriedade && !propriedade?.poligono) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate("/painel/cadastros/talhoes")} className="text-sm text-gray-600 hover:underline">
          ← Voltar para talhões
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Novo talhão</h1>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          A propriedade ainda não tem contorno cadastrado. Como o talhão precisa ficar dentro dela, cadastre primeiro
          o polígono em{" "}
          <button onClick={() => navigate("/painel/cadastros/propriedade")} className="font-semibold underline">
            Propriedade
          </button>
          .
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/painel/cadastros/talhoes")} className="text-sm text-gray-600 hover:underline">
        ← Voltar para talhões
      </button>
      <h1 className="text-2xl font-bold text-gray-800">Novo talhão</h1>

      {erro && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="max-w-lg space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nome do talhão</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Talhão da sede"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
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
          {culturas?.length === 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              Nenhuma cultura cadastrada ainda — cadastre em "Culturas" para poder vincular aqui.
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              Necessária para o diagnóstico de solo comparar com o perfil de correção da cultura.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Data de plantio</label>
          <input
            type="date"
            value={dataPlantio}
            onChange={(e) => setDataPlantio(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
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
              placeholder="Ex: 2,5"
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
              placeholder="Ex: 6"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-md bg-gray-50 p-3 text-sm">
          <div>
            <p className="text-gray-600">Código</p>
            <p className="font-medium text-gray-700">gerado automaticamente</p>
          </div>
          <div>
            <p className="text-gray-600">Área</p>
            <p className="font-medium text-gray-700">
              {areaHa != null ? formatarArea(areaHa) : "calculada ao desenhar"}
            </p>
          </div>
          {plantasEstimadas != null && (
            <div className="col-span-2">
              <p className="text-gray-600">Plantas estimadas</p>
              <p className="font-medium text-gray-700">
                ~{plantasEstimadas.toLocaleString("pt-BR")} plantas
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          O contorno tracejado é o limite da propriedade. Desenhe o contorno do talhão dentro dele usando o ícone de
          polígono — a área é calculada sozinha a partir do desenho.
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
        className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {criar.isPending ? "Criando..." : "Criar talhão"}
      </button>
      {!podeSalvar && (
        <p className="text-xs text-gray-600">
          {!nome
            ? "Informe o nome do talhão."
            : !poligono
              ? "Desenhe o contorno do talhão no mapa."
              : "Ajuste o contorno para ficar dentro da propriedade."}
        </p>
      )}
    </div>
  );
}
