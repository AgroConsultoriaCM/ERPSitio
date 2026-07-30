import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { PoligonoGeoJSON } from "../lib/types";

interface Props {
  poligono?: PoligonoGeoJSON | null;
  centro?: { latitude: number; longitude: number } | null;
}

// MapContainer do react-leaflet so aplica center/zoom na montagem inicial.
// Como os dados da propriedade chegam depois (via query assincrona), este
// componente recentraliza o mapa reativamente quando o poligono/centro fica
// disponivel - sem isso o mapa abriria sempre no fallback generico.
export default function CentralizarMapa({ poligono, centro }: Props) {
  const map = useMap();

  useEffect(() => {
    if (poligono) {
      const bounds = L.geoJSON(poligono as GeoJSON.GeoJsonObject).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { maxZoom: 18, padding: [24, 24] });
        return;
      }
    }
    if (centro) {
      map.setView([centro.latitude, centro.longitude], 16);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(poligono), centro?.latitude, centro?.longitude]);

  return null;
}
