import area from "@turf/area";
import booleanWithin from "@turf/boolean-within";
import { AppError } from "../lib/errors.js";

export interface PoligonoGeoJSON {
  type: "Polygon";
  coordinates: number[][][];
}

// Aceita o Json solto vindo do banco/request e devolve um poligono valido,
// ou null se nao for um poligono utilizavel.
export function normalizarPoligono(valor: unknown): PoligonoGeoJSON | null {
  if (!valor || typeof valor !== "object") return null;
  const p = valor as Partial<PoligonoGeoJSON>;
  if (p.type !== "Polygon" || !Array.isArray(p.coordinates)) return null;
  const anel = p.coordinates[0];
  // Um poligono fechado precisa de no minimo 4 posicoes (3 vertices + o
  // ponto de fechamento repetindo o primeiro).
  if (!Array.isArray(anel) || anel.length < 4) return null;
  return p as PoligonoGeoJSON;
}

function comoFeature(poligono: PoligonoGeoJSON) {
  return { type: "Feature" as const, properties: {}, geometry: poligono };
}

// Area geodesica em hectares, arredondada em 4 casas (1 m2 de precisao).
export function areaEmHectares(poligono: PoligonoGeoJSON): number {
  const metrosQuadrados = area(comoFeature(poligono));
  return Math.round((metrosQuadrados / 10_000) * 10_000) / 10_000;
}

export function estaDentroDe(interno: PoligonoGeoJSON, externo: PoligonoGeoJSON): boolean {
  return booleanWithin(comoFeature(interno), comoFeature(externo));
}

// Valida o poligono de uma area interna (talhao ou setor de irrigacao)
// contra o poligono da propriedade e devolve a area calculada. Lanca
// AppError com mensagem em portugues quando invalido.
export function validarPoligonoInterno(
  poligonoArea: unknown,
  poligonoPropriedade: unknown,
  rotulo: "talhão" | "setor",
): { poligono: PoligonoGeoJSON; areaHa: number } {
  const interno = normalizarPoligono(poligonoArea);
  if (!interno) {
    throw new AppError(
      `O ${rotulo} precisa de um contorno desenhado no mapa (mínimo 3 vértices).`,
      400,
    );
  }

  const propriedade = normalizarPoligono(poligonoPropriedade);
  if (!propriedade) {
    throw new AppError(
      `A propriedade ainda não tem contorno cadastrado. Cadastre o polígono da propriedade antes de criar ${
        rotulo === "talhão" ? "talhões" : "setores"
      }.`,
      400,
    );
  }

  if (!estaDentroDe(interno, propriedade)) {
    throw new AppError(
      `O contorno do ${rotulo} precisa estar inteiramente dentro do contorno da propriedade.`,
      400,
    );
  }

  return { poligono: interno, areaHa: areaEmHectares(interno) };
}

export interface AreaNomeada {
  nome: string;
  codigo: string | null;
  poligono: unknown;
}

// Ao redimensionar a propriedade, nenhuma area ja cadastrada pode ficar de
// fora. Devolve a lista de areas que sairiam do novo contorno (vazia = ok).
export function areasQueFicariamFora(
  novoPoligonoPropriedade: PoligonoGeoJSON,
  areas: AreaNomeada[],
): string[] {
  return areas
    .filter((area) => {
      const poligono = normalizarPoligono(area.poligono);
      // area sem contorno desenhado nao impede o redimensionamento
      if (!poligono) return false;
      return !estaDentroDe(poligono, novoPoligonoPropriedade);
    })
    .map((area) => (area.codigo ? `${area.codigo} - ${area.nome}` : area.nome));
}

// Codigo sequencial por propriedade (T01/T02 para talhoes, S01/S02 para
// setores). Continua a partir do maior numero ja usado - nao reaproveita
// codigo de registro apagado, para nao confundir historico.
export function proximoCodigo(codigosExistentes: (string | null)[], prefixo: "T" | "S"): string {
  const padrao = new RegExp(`^${prefixo}(\\d+)$`);
  const numeros = codigosExistentes
    .map((codigo) => codigo?.match(padrao)?.[1])
    .filter((n): n is string => !!n)
    .map(Number);
  const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
  return `${prefixo}${String(proximo).padStart(2, "0")}`;
}
