import { MapContainer, Polygon, Popup, TileLayer, Tooltip } from "react-leaflet";
import { Link } from "react-router-dom";
import CamadasBaseMapa from "./CamadasBaseMapa";
import CentralizarMapa from "./CentralizarMapa";
import type { Propriedade, SetorIrrigacao, Talhao } from "../lib/types";

// Visao ampla do Brasil - so usada quando a propriedade ainda nao tem
// nenhum poligono nem latitude/longitude cadastrados.
const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];

/**
 * Mapa da propriedade (contorno + talhões + setores), compartilhado entre a
 * tela cheia (Mapa.tsx, com controles de camada e checkboxes) e o bloco
 * compacto do Painel (Dashboard.tsx) - mesmo desenho, tamanho e interatividade
 * diferentes.
 */
export default function MapaPropriedade({
  propriedade,
  talhoes,
  setores,
  altura = "h-[70vh]",
  verTalhoes = true,
  verSetores = true,
  compacto = false,
}: {
  propriedade?: Propriedade | null;
  talhoes?: Talhao[];
  setores?: SetorIrrigacao[];
  altura?: string;
  verTalhoes?: boolean;
  verSetores?: boolean;
  /** Sem controle de camadas nem popup clicável — só um retrato pequeno. */
  compacto?: boolean;
}) {
  const centro =
    propriedade?.latitude != null && propriedade?.longitude != null
      ? { latitude: propriedade.latitude, longitude: propriedade.longitude }
      : null;

  return (
    <div className={`${altura} overflow-hidden rounded-xl`}>
      <MapContainer
        center={CENTRO_BRASIL}
        zoom={4}
        className="h-full w-full"
        zoomControl={!compacto}
        dragging={!compacto}
        scrollWheelZoom={!compacto}
        doubleClickZoom={!compacto}
        touchZoom={!compacto}
        attributionControl={!compacto}
      >
        {compacto ? (
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        ) : (
          <CamadasBaseMapa />
        )}
        <CentralizarMapa poligono={propriedade?.poligono} centro={centro} />

        {propriedade?.poligono && (
          <Polygon
            positions={propriedade.poligono.coordinates[0].map(([lng, lat]) => [lat, lng])}
            pathOptions={{ color: "#374151", weight: compacto ? 2 : 3, dashArray: "8 6", fillOpacity: 0.02 }}
            interactive={false}
          />
        )}

        {/* setores primeiro, para os talhoes ficarem clicaveis por cima */}
        {verSetores &&
          setores
            ?.filter((s) => s.poligono)
            .map((s) => (
              <Polygon
                key={s.id}
                positions={s.poligono!.coordinates[0].map(([lng, lat]) => [lat, lng])}
                pathOptions={{
                  color: s.corMapa ?? "#0284c7",
                  weight: 2,
                  dashArray: "4 4",
                  fillOpacity: 0.15,
                }}
                interactive={!compacto}
              >
                {!compacto && (
                  <>
                    <Tooltip sticky>{s.codigo ? `${s.codigo} · ${s.nome}` : s.nome}</Tooltip>
                    <Popup>
                      <p className="font-semibold">{s.nome}</p>
                      <p className="text-sm text-gray-600">Setor de irrigação {s.codigo ?? ""}</p>
                      {s.areaHa != null && <p className="text-sm">{s.areaHa} ha</p>}
                      <Link to={`/painel/cadastros/setores/${s.id}`} className="text-sm text-sky-700 underline">
                        Ver setor
                      </Link>
                    </Popup>
                  </>
                )}
              </Polygon>
            ))}

        {verTalhoes &&
          talhoes
            ?.filter((t) => t.poligono)
            .map((t) => (
              <Polygon
                key={t.id}
                positions={t.poligono!.coordinates[0].map(([lng, lat]) => [lat, lng])}
                pathOptions={{ color: t.corMapa ?? "#16a34a", fillOpacity: 0.2 }}
                interactive={!compacto}
              >
                {!compacto && (
                  <>
                    <Tooltip sticky>{t.codigo ? `${t.codigo} · ${t.nome}` : t.nome}</Tooltip>
                    <Popup>
                      <p className="font-semibold">{t.nome}</p>
                      <p className="text-sm">
                        {t.cultura?.nome} {t.cultura?.variedade ? `- ${t.cultura.variedade}` : ""}
                      </p>
                      {t.areaHa && <p className="text-sm">{t.areaHa} ha</p>}
                      <Link to={`/painel/cadastros/talhoes/${t.id}`} className="text-sm text-green-700 underline">
                        Ver talhão
                      </Link>
                    </Popup>
                  </>
                )}
              </Polygon>
            ))}
      </MapContainer>
    </div>
  );
}
