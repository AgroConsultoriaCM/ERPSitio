import { useQuery } from "@tanstack/react-query";
import { MapContainer } from "react-leaflet";
import { api } from "../../../lib/api";
import DesenhoPoligono from "../../../components/DesenhoPoligono";
import CamadasBaseMapa from "../../../components/CamadasBaseMapa";
import CentralizarMapa from "../../../components/CentralizarMapa";
import type { PoligonoGeoJSON, Propriedade } from "../../../lib/types";

interface Props {
  poligono: PoligonoGeoJSON | null;
  onChange: (poligono: PoligonoGeoJSON | null) => void;
}

const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];

export default function AbaMapa({ poligono, onChange }: Props) {
  const { data: propriedade } = useQuery({
    queryKey: ["propriedade"],
    queryFn: () => api.get<Propriedade>("/propriedades/me"),
  });

  const centroPropriedade =
    propriedade?.latitude != null && propriedade?.longitude != null
      ? { latitude: propriedade.latitude, longitude: propriedade.longitude }
      : null;

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">
        O contorno tracejado é o limite da propriedade. Use o ícone de polígono na barra de ferramentas para desenhar
        o contorno deste talhão dentro dele — sem limite de vértices, editável ou removível depois.
      </p>
      <div className="h-[60vh] overflow-hidden rounded-xl shadow-sm">
        <MapContainer center={CENTRO_BRASIL} zoom={4} className="h-full w-full">
          <CamadasBaseMapa />
          {!poligono && <CentralizarMapa poligono={propriedade?.poligono} centro={centroPropriedade} />}
          <DesenhoPoligono valor={poligono} onChange={onChange} poligonoReferencia={propriedade?.poligono} />
        </MapContainer>
      </div>
      {!propriedade?.poligono && (
        <p className="text-sm text-amber-700">
          A propriedade ainda não tem contorno cadastrado — o mapa abriu numa visão ampla do Brasil. Cadastre o
          contorno em "Propriedade" para os mapas de talhão já abrirem centralizados no local certo.
        </p>
      )}
    </div>
  );
}
