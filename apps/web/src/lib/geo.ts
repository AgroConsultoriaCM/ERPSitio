import type { PoligonoGeoJSON } from "./types";

// Centroide simples (media aritmetica dos vertices) - suficiente para
// centralizar o mapa, nao precisa ser o centroide geometrico exato.
export function centroideDoPoligono(poligono: PoligonoGeoJSON): { latitude: number; longitude: number } {
  const anel = poligono.coordinates[0];
  const somaLat = anel.reduce((acc, [, lat]) => acc + lat, 0);
  const somaLng = anel.reduce((acc, [lng]) => acc + lng, 0);
  return { latitude: somaLat / anel.length, longitude: somaLng / anel.length };
}
