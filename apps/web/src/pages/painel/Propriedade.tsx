import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer } from "react-leaflet";
import { api, ApiError } from "../../lib/api";
import { centroideDoPoligono } from "../../lib/geo";
import CamadasBaseMapa from "../../components/CamadasBaseMapa";
import DesenhoPoligono from "../../components/DesenhoPoligono";
import type { PoligonoGeoJSON, Propriedade as PropriedadeType } from "../../lib/types";

// Centro geografico aproximado do Brasil - usado so quando a propriedade
// ainda nao tem localizacao nenhuma cadastrada, para o mapa abrir numa visao
// ampla e o usuario navegar ate o local certo (em vez de fingir uma cidade
// especifica que provavelmente nao e a da propriedade).
const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];

export default function Propriedade() {
  const qc = useQueryClient();
  const { data: propriedade } = useQuery({
    queryKey: ["propriedade"],
    queryFn: () => api.get<PropriedadeType>("/propriedades/me"),
  });

  const [nome, setNome] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [poligono, setPoligono] = useState<PoligonoGeoJSON | null>(null);
  const [mensagemDados, setMensagemDados] = useState<string | null>(null);
  const [erroPoligono, setErroPoligono] = useState<string | null>(null);

  useEffect(() => {
    if (propriedade) {
      setNome(propriedade.nome);
      setLocalizacao(propriedade.localizacao ?? "");
      setPoligono(propriedade.poligono ?? null);
    }
  }, [propriedade]);

  // Só nome/localizacao - o contorno tem o seu próprio salvamento automático,
  // então mandar o polígono aqui junto poderia sobrescrever o que está no
  // servidor com um estado local desatualizado.
  const salvar = useMutation({
    mutationFn: () =>
      api.patch("/propriedades/me", {
        nome,
        localizacao: localizacao || undefined,
      }),
    onSuccess: () => {
      setMensagemDados("Dados da propriedade salvos.");
      qc.invalidateQueries({ queryKey: ["propriedade"] });
    },
    onError: (err) => {
      setMensagemDados(err instanceof ApiError ? err.message : "Não foi possível salvar os dados");
    },
  });

  const salvarPoligono = useMutation({
    mutationFn: (novoPoligono: PoligonoGeoJSON | null) => {
      const centro = novoPoligono ? centroideDoPoligono(novoPoligono) : null;
      return api.patch("/propriedades/me", {
        poligono: novoPoligono,
        latitude: centro?.latitude,
        longitude: centro?.longitude,
      });
    },
    onSuccess: () => {
      setErroPoligono(null);
      qc.invalidateQueries({ queryKey: ["propriedade"] });
      // talhoes/setores nao mudam, mas o mapa deles usa o contorno novo
      qc.invalidateQueries({ queryKey: ["talhoes"] });
      qc.invalidateQueries({ queryKey: ["setores-irrigacao"] });
    },
    onError: (err) => {
      setErroPoligono(
        err instanceof ApiError ? err.message : "Não foi possível salvar o contorno da propriedade",
      );
      // desfaz o desenho na tela, voltando ao contorno que está salvo
      setPoligono(propriedade?.poligono ?? null);
    },
  });

  const centroInicial: [number, number] = propriedade?.poligono
    ? [propriedade.poligono.coordinates[0][0][1], propriedade.poligono.coordinates[0][0][0]]
    : propriedade?.latitude != null && propriedade?.longitude != null
      ? [propriedade.latitude, propriedade.longitude]
      : CENTRO_BRASIL;
  const zoomInicial = propriedade?.poligono || (propriedade?.latitude != null) ? 16 : 4;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Propriedade</h1>
        <p className="text-sm text-gray-500">
          Cadastre o contorno da propriedade primeiro — os talhões serão desenhados dentro dele, e todos os mapas do
          sistema vão centralizar automaticamente aqui.
        </p>
      </div>

      <div className="max-w-lg space-y-3 rounded-xl bg-white p-4 shadow-sm">
        {mensagemDados && (
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              salvar.isError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"
            }`}
          >
            {mensagemDados}
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
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Localização (cidade/região)</label>
          <input
            value={localizacao}
            onChange={(e) => setLocalizacao(e.target.value)}
            placeholder="Ex: Monte Alto - SP"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => salvar.mutate()}
          disabled={!nome || salvar.isPending}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Salvar dados
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-500">
          Use o ícone de polígono para desenhar, ou o de edição para arrastar os vértices e ajustar os limites. Sem
          limite de vértices. <strong>O contorno salva sozinho</strong> a cada alteração — não precisa do botão
          acima, que é só para nome e localização.
        </p>
        {erroPoligono && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroPoligono}</div>
        )}
        <div className="h-[65vh] overflow-hidden rounded-xl shadow-sm">
          <MapContainer center={centroInicial} zoom={zoomInicial} className="h-full w-full">
            <CamadasBaseMapa />
            <DesenhoPoligono
              valor={poligono}
              onChange={(p) => {
                setPoligono(p);
                salvarPoligono.mutate(p);
              }}
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
