import { LayersControl, TileLayer } from "react-leaflet";

// Camadas de base compartilhadas entre o mapa da propriedade e o editor de
// poligono do talhao. Satelite (Esri World Imagery, gratuito, sem chave de
// API) como padrao, com opcao de alternar para mapa de ruas (OpenStreetMap).
//
// A imagem de satelite pura nao tem nenhum texto, entao vem junto uma camada
// de rotulos (nomes de cidades/bairros, limites e estradas) por cima, ligada
// por padrao para dar referencia de onde se esta. Da para desligar no
// controle de camadas (canto superior direito) na hora de desenhar, quando os
// rotulos podem atrapalhar a visao do terreno.
export default function CamadasBaseMapa() {
  return (
    <LayersControl position="topright">
      <LayersControl.BaseLayer checked name="Satélite">
        <TileLayer
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Mapa">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </LayersControl.BaseLayer>

      <LayersControl.Overlay checked name="Nomes de cidades e limites">
        <TileLayer
          attribution="Labels &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      </LayersControl.Overlay>
      <LayersControl.Overlay checked name="Estradas">
        <TileLayer
          attribution="Transportation &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      </LayersControl.Overlay>
    </LayersControl>
  );
}
