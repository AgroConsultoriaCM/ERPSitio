import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import MapaPropriedade from "../../components/MapaPropriedade";
import type { Propriedade as PropriedadeType, SetorIrrigacao, Talhao } from "../../lib/types";

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Mapa da propriedade</h1>
      <p className="text-sm text-gray-600">
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

      <div className="overflow-hidden rounded-xl shadow-sm">
        <MapaPropriedade
          propriedade={propriedade}
          talhoes={talhoes}
          setores={setores}
          verTalhoes={verTalhoes}
          verSetores={verSetores}
          altura="h-[70vh]"
        />
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
