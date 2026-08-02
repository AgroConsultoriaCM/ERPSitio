import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CloudOff, Leaf, Satellite, TrendingUp, Grid3x3, Info } from "lucide-react";
import { api, ApiError, getAccessToken } from "../../../lib/api";
import { Aviso, Cartao, EstadoVazio, TituloSecao, numero } from "../../../components/ui";

type Faixa = "bom" | "atencao" | "critico" | "sem_dados";

interface Componente {
  faixa: Faixa;
  valor: number | null;
  explicacao: string;
}

interface Leitura {
  data: string;
  ndviMedio: number | null;
  osaviMedio: number | null;
  desvio: number | null;
  pixels: number;
}

interface RespostaSatelite {
  talhao: { id: string; nome: string; codigo?: string | null };
  nota: {
    faixa: Faixa;
    vigor: Componente;
    uniformidade: Componente;
    tendencia: Componente;
    leiturasUsadas: number;
    atualizadoEm: string | null;
  };
  recentes: Leitura[];
  historicoMesmoMes: Leitura[];
  fonte: string;
}

const ESTILO: Record<Faixa, { caixa: string; texto: string; ponto: string; rotulo: string }> = {
  bom: { caixa: "border-mata-200 bg-mata-50", texto: "text-mata-800", ponto: "bg-mata-500", rotulo: "Bom" },
  atencao: {
    caixa: "border-amber-200 bg-amber-50",
    texto: "text-amber-800",
    ponto: "bg-amber-500",
    rotulo: "Atenção",
  },
  critico: { caixa: "border-red-200 bg-red-50", texto: "text-red-800", ponto: "bg-red-500", rotulo: "Crítico" },
  sem_dados: {
    caixa: "border-terra-200 bg-terra-50",
    texto: "text-terra-600",
    ponto: "bg-terra-400",
    rotulo: "Sem dados",
  },
};

/**
 * A imagem vem da nossa API e exige token, e `<img src>` não manda cabeçalho.
 * Por isso baixamos como blob e criamos uma URL local.
 */
function useImagemNdvi(talhaoId: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    let objeto: string | null = null;
    const base = import.meta.env.VITE_API_URL ?? "http://localhost:3333/api/v1";

    setCarregando(true);
    setErro(null);
    fetch(`${base}/talhoes/${talhaoId}/ndvi.png?largura=512`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          const corpo = await r.json().catch(() => ({}));
          throw new Error(corpo.message ?? `Erro ${r.status}`);
        }
        return r.blob();
      })
      .then((blob) => {
        if (!vivo) return;
        objeto = URL.createObjectURL(blob);
        setUrl(objeto);
      })
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Falha ao carregar a imagem"))
      .finally(() => vivo && setCarregando(false));

    return () => {
      vivo = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [talhaoId]);

  return { url, erro, carregando };
}

function CartaoComponente({
  titulo,
  icone: Ico,
  componente,
}: {
  titulo: string;
  icone: typeof Leaf;
  componente: Componente;
}) {
  const e = ESTILO[componente.faixa];
  return (
    <div className={`rounded-xl border p-4 ${e.caixa}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className={`flex items-center gap-1.5 text-sm font-semibold ${e.texto}`}>
          <Ico size={15} strokeWidth={2.25} />
          {titulo}
        </p>
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${e.texto}`}>
          <i className={`h-2 w-2 rounded-full ${e.ponto}`} />
          {e.rotulo}
        </span>
      </div>
      <p className={`text-sm leading-snug ${e.texto} opacity-90`}>{componente.explicacao}</p>
    </div>
  );
}

export default function AbaSatelite({ talhaoId }: { talhaoId: string }) {
  const consulta = useQuery({
    queryKey: ["satelite", talhaoId],
    queryFn: () => api.get<RespostaSatelite>(`/talhoes/${talhaoId}/satelite`),
    retry: false,
    // Cena nova a cada ~5 dias: não faz sentido refazer a conta a toda visita.
    staleTime: 6 * 60 * 60 * 1000,
  });
  const imagem = useImagemNdvi(talhaoId);

  if (consulta.isLoading) {
    return (
      <Cartao>
        <p className="py-8 text-center text-sm text-terra-500">Consultando o satélite…</p>
      </Cartao>
    );
  }

  if (consulta.isError) {
    const erro = consulta.error;
    const mensagem = erro instanceof ApiError ? erro.message : "Não foi possível consultar o satélite.";
    return (
      <Aviso tom={mensagem.includes("contorno") ? "alerta" : "neutro"} titulo="Satélite indisponível" icone={CloudOff}>
        {mensagem}
      </Aviso>
    );
  }

  const dados = consulta.data!;
  const { nota } = dados;
  const estilo = ESTILO[nota.faixa];

  const serie = dados.recentes
    .filter((l) => l.pixels > 0 && l.osaviMedio != null)
    .map((l) => ({
      rotulo: new Date(l.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      osavi: Number(l.osaviMedio?.toFixed(3)),
      ndvi: Number(l.ndviMedio?.toFixed(3)),
    }));

  const semCena = dados.recentes.filter((l) => l.pixels === 0).length;

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${estilo.caixa}`}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
            <Satellite size={20} className={estilo.texto} strokeWidth={2} />
          </span>
          <div>
            <p className="rotulo">Situação do talhão pelo satélite</p>
            <p className={`text-xl font-bold ${estilo.texto}`}>{estilo.rotulo}</p>
          </div>
        </div>
        <p className="text-xs text-terra-500">
          {nota.leiturasUsadas} cena{nota.leiturasUsadas === 1 ? "" : "s"} limpa
          {nota.leiturasUsadas === 1 ? "" : "s"}
          {nota.atualizadoEm &&
            ` · última em ${new Date(nota.atualizadoEm).toLocaleDateString("pt-BR")}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <CartaoComponente titulo="Vigor" icone={Leaf} componente={nota.vigor} />
        <CartaoComponente titulo="Uniformidade" icone={Grid3x3} componente={nota.uniformidade} />
        <CartaoComponente titulo="Tendência" icone={TrendingUp} componente={nota.tendencia} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Cartao>
          <TituloSecao icone={Satellite} descricao="Cena menos nublada dos últimos 60 dias, recortada no contorno">
            Mapa NDVI
          </TituloSecao>
          {imagem.carregando && (
            <div className="esqueleto aspect-square w-full rounded-lg" />
          )}
          {imagem.erro && !imagem.carregando && (
            <EstadoVazio icone={CloudOff} titulo="Imagem indisponível" descricao={imagem.erro} />
          )}
          {imagem.url && (
            <>
              <img
                src={imagem.url}
                alt="Mapa NDVI do talhão"
                className="w-full rounded-lg border border-terra-200"
              />
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-terra-500">
                <span className="h-2.5 w-6 rounded-sm bg-[#a69980]" />
                solo
                <span className="ml-1 h-2.5 w-6 rounded-sm bg-[#e6d95a]" />
                fraco
                <span className="ml-1 h-2.5 w-6 rounded-sm bg-[#8cc72e]" />
                médio
                <span className="ml-1 h-2.5 w-6 rounded-sm bg-[#146627]" />
                vigoroso
              </div>
            </>
          )}
        </Cartao>

        <Cartao>
          <TituloSecao icone={TrendingUp} descricao="OSAVI desconta o solo exposto entre as ruas — é o mais fiel para citros">
            Evolução do vigor
          </TituloSecao>
          {serie.length === 0 ? (
            <EstadoVazio
              icone={CloudOff}
              titulo="Nenhuma cena limpa no período"
              descricao="Em época chuvosa é comum passar semanas sem imagem aproveitável."
            />
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 5" stroke="#e7e3db" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "#94886f" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94886f" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e7e3db", fontSize: 13 }}
                    formatter={(v: number, nome) => [numero(v, 3), nome === "osavi" ? "OSAVI" : "NDVI"]}
                  />
                  <Line type="monotone" dataKey="osavi" stroke="#2a6844" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="ndvi" stroke="#c9dd1c" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {semCena > 0 && (
            <p className="mt-2 text-xs text-terra-500">
              {semCena} período{semCena === 1 ? "" : "s"} sem cena limpa, descartado
              {semCena === 1 ? "" : "s"} do cálculo.
            </p>
          )}
        </Cartao>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-terra-50 px-3 py-2.5 text-xs leading-relaxed text-terra-500">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Cada talhão é comparado <strong>com ele mesmo</strong>, no mesmo mês de anos anteriores —
          comparar talhões entre si seria injusto quando idade e espaçamento diferem. O pixel de 10 m
          mistura copa, solo e rua, e o NDVI satura em dossel muito denso: por isso a tendência vale
          mais que o valor absoluto. Orientação de manejo, não laudo. · {dados.fonte}
        </span>
      </div>
    </div>
  );
}
