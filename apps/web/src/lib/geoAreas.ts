import area from "@turf/area";
import booleanWithin from "@turf/boolean-within";
import type { PoligonoGeoJSON } from "./types";

// Mesmas regras aplicadas pelo backend (apps/api/src/services/geoAreas.ts).
// Aqui servem para dar feedback imediato enquanto o usuario desenha - a
// validacao que vale e sempre a do servidor.

function comoFeature(poligono: PoligonoGeoJSON) {
  return { type: "Feature" as const, properties: {}, geometry: poligono };
}

export function areaEmHectares(poligono: PoligonoGeoJSON): number {
  const metrosQuadrados = area(comoFeature(poligono));
  return Math.round((metrosQuadrados / 10_000) * 10_000) / 10_000;
}

export function estaDentroDe(interno: PoligonoGeoJSON, externo: PoligonoGeoJSON): boolean {
  return booleanWithin(comoFeature(interno), comoFeature(externo));
}

// Estimativa de plantas a partir da area e do espacamento do plantio.
// E uma referencia de planejamento (area util / area ocupada por planta),
// nao um inventario real - o numero efetivo depende de falhas, carreadores
// e do formato do talhao.
export function estimarPlantas(
  areaHa: number | null | undefined,
  entrePlantas: number | null | undefined,
  entreLinhas: number | null | undefined,
): number | null {
  if (!areaHa || !entrePlantas || !entreLinhas) return null;
  return Math.round((areaHa * 10_000) / (entrePlantas * entreLinhas));
}

export function formatarArea(hectares: number): string {
  const alqueiresPaulistas = hectares / 2.42;
  return `${hectares.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} ha (${alqueiresPaulistas.toLocaleString(
    "pt-BR",
    { maximumFractionDigits: 2 },
  )} alq. paulista)`;
}
