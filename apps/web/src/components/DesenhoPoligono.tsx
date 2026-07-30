import { useEffect, useRef } from "react";
import { FeatureGroup, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import type { PoligonoGeoJSON } from "../lib/types";

interface Props {
  valor: PoligonoGeoJSON | null;
  onChange: (valor: PoligonoGeoJSON | null) => void;
  // Poligono de referencia (ex: contorno da propriedade) exibido como guia
  // nao editavel por baixo do poligono que esta sendo desenhado/editado.
  poligonoReferencia?: PoligonoGeoJSON | null;
}

// Editor de poligono de um talhao, setor ou da propriedade sobre o mapa.
// Numero de vertices e ilimitado - sem allowIntersection (que no leaflet-draw
// tem falsos positivos conhecidos e chega a bloquear novos vertices em
// poligonos simples) e sem React.StrictMode (que duplicaria o controle em
// dev, ver main.tsx).
export default function DesenhoPoligono({ valor, onChange, poligonoReferencia }: Props) {
  const grupoRef = useRef<L.FeatureGroup | null>(null);
  const map = useMap();
  // Ultimo contorno que este componente desenhou/emitiu. Serve para saber se
  // uma mudanca no `valor` veio de fora (dado carregado do servidor) ou e o
  // eco do que o proprio usuario acabou de desenhar - sem isso, redesenhar a
  // camada a cada render apagaria o desenho em andamento.
  const ultimoAplicado = useRef<string | null>(null);
  // onChange guardado em ref para o efeito do controle nao depender dele
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Efeito 1: monta o controle de desenho uma unica vez por mapa.
  useEffect(() => {
    const grupo = grupoRef.current;
    if (!grupo) return;

    const controleDesenho = new L.Control.Draw({
      draw: {
        polygon: { allowIntersection: true, showArea: true },
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: grupo, remove: true },
    });
    map.addControl(controleDesenho);

    function extrairEEnviar() {
      const dados = grupo!.toGeoJSON() as GeoJSON.FeatureCollection;
      const geometria = dados.features[0]?.geometry as PoligonoGeoJSON | undefined;
      ultimoAplicado.current = geometria ? JSON.stringify(geometria) : null;
      onChangeRef.current(geometria ?? null);
    }

    function aoCriar(e: L.LeafletEvent) {
      grupo!.clearLayers();
      grupo!.addLayer((e as unknown as { layer: L.Layer }).layer);
      extrairEEnviar();
    }

    map.on(L.Draw.Event.CREATED, aoCriar);
    map.on(L.Draw.Event.EDITED, extrairEEnviar);
    map.on(L.Draw.Event.DELETED, extrairEEnviar);

    return () => {
      map.removeControl(controleDesenho);
      map.off(L.Draw.Event.CREATED, aoCriar);
      map.off(L.Draw.Event.EDITED, extrairEEnviar);
      map.off(L.Draw.Event.DELETED, extrairEEnviar);
    };
  }, [map]);

  // Efeito 2: sincroniza o contorno vindo de fora com a camada do mapa.
  // Roda quando `valor` muda - inclusive quando o dado chega da API depois da
  // montagem, que era o caso em que o contorno salvo nao aparecia.
  useEffect(() => {
    const grupo = grupoRef.current;
    if (!grupo) return;

    const serializado = valor ? JSON.stringify(valor) : null;
    if (serializado === ultimoAplicado.current) return;

    grupo.clearLayers();
    if (valor) {
      L.geoJSON(valor as GeoJSON.GeoJsonObject).eachLayer((camada) => grupo.addLayer(camada));
      const bounds = grupo.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { maxZoom: 18 });
    }
    ultimoAplicado.current = serializado;
  }, [map, valor]);

  return (
    <>
      {poligonoReferencia && (
        <Polygon
          positions={poligonoReferencia.coordinates[0].map(([lng, lat]) => [lat, lng])}
          pathOptions={{ color: "#6b7280", weight: 2, dashArray: "6 6", fillOpacity: 0.03 }}
          interactive={false}
        />
      )}
      <FeatureGroup ref={grupoRef} />
    </>
  );
}
