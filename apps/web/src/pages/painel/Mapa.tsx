import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Polygon, Popup, Tooltip } from "react-leaflet";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import CamadasBaseMapa from "../../components/CamadasBaseMapa";
import CentralizarMapa from "../../components/CentralizarMapa";
import type { Propriedade as PropriedadeType, SetorIrrigacao, Talhao } from "../../lib/types";

// Visao ampla do Brasil - so usada quando a propriedade ainda nao tem
// nenhum poligono nem latitude/longitude cadastrados.
const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];

export default function Mapa() {
  const { data: talhoes } = useQuery({ queryKey: ["talhoes"], queryFn: () => api.get<Talhao[]>("/talhoes") });
  const { data: setores } = useQuery({
    queryKey: ["setores-irrigacao"],
    queryFn: () => api.get<SetorIrrigacao[]>("/setores-irrigacao"),
  });
  const { data: propriedade } = useQuery({
    queryKey: ["propriedade"],
    queryFn: () => api.get<PropriedadeType>("/propriedades/me"),
  });

  const [verTalhoes, setVerTalhoes] = useState(true);
  const [verSetores, setVerSetores] = useState(true);

  const centro =
    propriedade?.latitude != null && propriedade?.longitude != null
      ? { latitude: propriedade.latitude, longitude: propriedade.longitude }
      : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Mapa da propriedade</h1>
      <p className="text-sm text-gray-500">
        Clique numa área para ver detalhes. O contorno da propriedade (tracejado) é editado na tela "Propriedade";
        talhões e setores, nas telas correspondentes.
      </p>

      <div className="flex flex-wrap gap-4 rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={verTalhoes} onChange={(e) => setVerTalhoes(e.target.checked)} />
          <span className="inline-block h-3 w-3 rounded-sm bg-green-600" />
          Talhões ({talhoes?.length ?? 0})
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={verSetores} onChange={(e) => setVerSetores(e.target.checked)} />
          <span className="inline-block h-3 w-3 rounded-sm bg-sky-600" />
          Setores de irrigação ({setores?.length ?? 0})
        </label>
      </div>

      <div className="h-[70vh] overflow-hidden rounded-xl shadow-sm">
        <MapContainer center={CENTRO_BRASIL} zoom={4} className="h-full w-full">
          <CamadasBaseMapa />
          <CentralizarMapa poligono={propriedade?.poligono} centro={centro} />

          {propriedade?.poligono && (
            <Polygon
              positions={propriedade.poligono.coordinates[0].map(([lng, lat]) => [lat, lng])}
              pathOptions={{ color: "#374151", weight: 3, dashArray: "8 6", fillOpacity: 0.02 }}
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
                >
                  <Tooltip sticky>{s.codigo ? `${s.codigo} · ${s.nome}` : s.nome}</Tooltip>
                  <Popup>
                    <p className="font-semibold">{s.nome}</p>
                    <p className="text-sm text-gray-500">Setor de irrigação {s.codigo ?? ""}</p>
                    {s.areaHa != null && <p className="text-sm">{s.areaHa} ha</p>}
                    <Link to={`/painel/cadastros/setores/${s.id}`} className="text-sm text-sky-700 underline">
                      Ver setor
                    </Link>
                  </Popup>
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
                >
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
                </Polygon>
              ))}
        </MapContainer>
      </div>

      {!propriedade?.poligono && (
        <p className="text-sm text-amber-700">
          A propriedade ainda não tem contorno cadastrado.{" "}
          <Link to="/painel/cadastros/propriedade" className="underline">
            Cadastre o polígono da propriedade
          </Link>{" "}
          para o mapa centralizar automaticamente aqui.
        </p>
      )}
      {propriedade?.poligono && !talhoes?.some((t) => t.poligono) && (
        <p className="text-sm text-amber-700">
          Nenhum talhão com contorno desenhado ainda. Abra um talhão e desenhe o polígono na aba "Mapa/Polígono".
        </p>
      )}
    </div>
  );
}
