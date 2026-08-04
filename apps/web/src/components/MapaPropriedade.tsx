import { MapContainer, Polygon, Popup, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import { Link } from "react-router-dom";
import CamadasBaseMapa from "./CamadasBaseMapa";
import CentralizarMapa from "./CentralizarMapa";
import type { Propriedade, SetorIrrigacao, Talhao } from "../lib/types";

// Visao ampla do Brasil - so usada quando a propriedade ainda nao tem
// nenhum poligono nem latitude/longitude cadastrados.
const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];

export type SelecaoMapa = { tipo: "talhao" | "setor"; id: string } | null;

/** Clique em área vazia do mapa (fora de qualquer polígono) limpa a seleção. */
function LimparSelecaoAoClicar({ aoLimpar }: { aoLimpar?: () => void }) {
  useMapEvents({ click: () => aoLimpar?.() });
  return null;
}

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
  selecao = null,
  aoSelecionar,
}: {
  propriedade?: Propriedade | null;
  talhoes?: Talhao[];
  setores?: SetorIrrigacao[];
  altura?: string;
  verTalhoes?: boolean;
  verSetores?: boolean;
  /** Chrome mais simples (uma só camada de base, sem popup) — usado no bloco do Painel. */
  compacto?: boolean;
  /** Talhão/setor com destaque visual — controlado de fora, para o painel lateral acompanhar o clique. */
  selecao?: SelecaoMapa;
  /** Clique num talhão/setor (ou null, ao clicar em área vazia, limpando a seleção). */
  aoSelecionar?: (selecao: SelecaoMapa) => void;
}) {
  const centro =
    propriedade?.latitude != null && propriedade?.longitude != null
      ? { latitude: propriedade.latitude, longitude: propriedade.longitude }
      : null;
  const selecionavel = !!aoSelecionar;

  return (
    <div className={`${altura} overflow-hidden rounded-xl`}>
      <MapContainer
        center={CENTRO_BRASIL}
        zoom={4}
        className="h-full w-full"
        zoomControl={!compacto}
        dragging={!compacto || selecionavel}
        scrollWheelZoom={!compacto}
        doubleClickZoom={!compacto}
        touchZoom={!compacto || selecionavel}
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
        {selecionavel && <LimparSelecaoAoClicar aoLimpar={() => aoSelecionar!(null)} />}

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
            .map((s) => {
              const ativo = selecao?.tipo === "setor" && selecao.id === s.id;
              return (
                <Polygon
                  key={s.id}
                  positions={s.poligono!.coordinates[0].map(([lng, lat]) => [lat, lng])}
                  pathOptions={{
                    color: s.corMapa ?? "#0284c7",
                    weight: ativo ? 4 : 2,
                    dashArray: "4 4",
                    fillOpacity: ativo ? 0.4 : 0.15,
                    // Sem isto, o clique no polígono também dispara o clique
                    // do mapa (bubbling padrão do Leaflet) — que limpa a
                    // seleção no mesmo instante em que ela é definida.
                    bubblingMouseEvents: false,
                  }}
                  interactive={!compacto || selecionavel}
                  eventHandlers={
                    selecionavel ? { click: () => aoSelecionar!({ tipo: "setor", id: s.id }) } : undefined
                  }
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
                  {compacto && selecionavel && <Tooltip sticky>{s.codigo ? `${s.codigo} · ${s.nome}` : s.nome}</Tooltip>}
                </Polygon>
              );
            })}

        {verTalhoes &&
          talhoes
            ?.filter((t) => t.poligono)
            .map((t) => {
              const ativo = selecao?.tipo === "talhao" && selecao.id === t.id;
              return (
                <Polygon
                  key={t.id}
                  positions={t.poligono!.coordinates[0].map(([lng, lat]) => [lat, lng])}
                  pathOptions={{
                    color: t.corMapa ?? "#16a34a",
                    weight: ativo ? 4 : 3,
                    fillOpacity: ativo ? 0.45 : 0.2,
                    bubblingMouseEvents: false,
                  }}
                  interactive={!compacto || selecionavel}
                  eventHandlers={
                    selecionavel ? { click: () => aoSelecionar!({ tipo: "talhao", id: t.id }) } : undefined
                  }
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
                  {compacto && selecionavel && <Tooltip sticky>{t.codigo ? `${t.codigo} · ${t.nome}` : t.nome}</Tooltip>}
                </Polygon>
              );
            })}
      </MapContainer>
    </div>
  );
}
