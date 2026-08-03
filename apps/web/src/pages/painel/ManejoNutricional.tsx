import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CloudOff,
  FlaskConical,
  ImageOff,
  Leaf,
  Satellite,
  Sprout,
  TestTube,
} from "lucide-react";
import { api, ApiError, getAccessToken } from "../../lib/api";
import { ROTAS } from "../../lib/rotas";
import { Aviso, Cartao, EstadoVazio, Etiqueta, TituloSecao, numero } from "../../components/ui";

interface Leitura {
  data: string;
  osaviMedio: number | null;
  ndviMedio: number | null;
  pixels: number;
}

interface Adubacao {
  data: string;
  tipoAtividade: string;
  produtos: { nome: string; quantidade: number; unidade: string; foliar: boolean }[];
  temFoliar: boolean;
  temSolo: boolean;
}

interface Alerta {
  gravidade: "atencao" | "critico";
  mensagem: string;
}

type StatusGeral = "BAIXO" | "MARGEM" | "ADEQUADO" | "ALTO" | "SEM_REFERENCIA";

interface TalhaoNutricional {
  talhaoId: string;
  nome: string;
  codigo: string | null;
  areaHa: number | null;
  cultura: string | null;
  serieOsavi: Leitura[];
  osaviMedioAno: number | null;
  variacaoAnual: number | null;
  analiseSolo: Record<string, number | string | null> | null;
  analiseFoliar: Record<string, number | string | null> | null;
  variacaoSolo: Record<string, number>;
  variacaoFoliar: Record<string, number>;
  dataAnaliseSoloAnterior: string | null;
  dataAnaliseFoliarAnterior: string | null;
  statusGeralSolo: StatusGeral;
  statusGeralFoliar: StatusGeral;
  statusPorNutrienteSolo: Record<string, StatusGeral>;
  statusPorNutrienteFoliar: Record<string, StatusGeral>;
  adubacoes: Adubacao[];
  alertas: Alerta[];
}

/** Nome curto de cada nutriente/parâmetro, na grafia química correta (Mg, não MG). */
const ROTULO_NUTRIENTE: Record<string, string> = {
  ph: "pH", materiaOrganica: "M.O.", fosforo: "P", enxofre: "S", potassio: "K",
  calcio: "Ca", magnesio: "Mg", aluminio: "Al", hAl: "H+Al", somaBases: "SB",
  ctc: "CTC", saturacaoBases: "V%", saturacaoAluminio: "m%",
  boro: "B", cobre: "Cu", ferro: "Fe", manganes: "Mn", zinco: "Zn", silicio: "Si",
  molibdenio: "Mo", nitrogenio: "N",
};

/** Ordem de exibição: os medidos direto primeiro, os calculados por último. */
const CAMPOS_SOLO = [
  "ph", "materiaOrganica", "fosforo", "enxofre", "potassio", "calcio", "magnesio",
  "boro", "cobre", "ferro", "manganes", "zinco", "silicio", "molibdenio",
  "aluminio", "hAl", "somaBases", "ctc", "saturacaoBases", "saturacaoAluminio",
] as const;
const CAMPOS_FOLIAR = [
  "nitrogenio", "fosforo", "potassio", "calcio", "magnesio", "enxofre",
  "boro", "cobre", "ferro", "manganes", "zinco", "silicio", "molibdenio",
] as const;

/** Unidade de cada campo — igual à convenção Athenas usada na importação de laudos. Mostrada sempre, em tooltip. */
const UNIDADE_SOLO: Record<string, string> = {
  ph: "CaCl₂", materiaOrganica: "g/dm³", fosforo: "mg/dm³", enxofre: "mg/dm³",
  potassio: "mmolc/dm³", calcio: "mmolc/dm³", magnesio: "mmolc/dm³", aluminio: "mmolc/dm³",
  hAl: "mmolc/dm³", somaBases: "mmolc/dm³", ctc: "mmolc/dm³", saturacaoBases: "%", saturacaoAluminio: "%",
  boro: "mg/dm³", cobre: "mg/dm³", ferro: "mg/dm³", manganes: "mg/dm³", zinco: "mg/dm³",
  silicio: "mg/dm³", molibdenio: "mg/dm³",
};
const UNIDADE_FOLIAR: Record<string, string> = {
  nitrogenio: "g/kg", fosforo: "g/kg", potassio: "g/kg", calcio: "g/kg", magnesio: "g/kg", enxofre: "g/kg",
  boro: "mg/kg", cobre: "mg/kg", ferro: "mg/kg", manganes: "mg/kg", zinco: "mg/kg",
  silicio: "g/kg", molibdenio: "mg/kg",
};

const COR_STATUS_GERAL: Record<StatusGeral, string> = {
  BAIXO: "bg-red-500",
  MARGEM: "bg-amber-400",
  ADEQUADO: "bg-mata-500",
  ALTO: "bg-sky-500",
  SEM_REFERENCIA: "bg-terra-200",
};

const TITULO_STATUS: Record<StatusGeral, string> = {
  BAIXO: "faltando bastante frente ao perfil da cultura",
  MARGEM: "na margem inferior do perfil da cultura",
  ADEQUADO: "dentro ou um pouco acima do perfil da cultura",
  ALTO: "bem acima do perfil da cultura",
  SEM_REFERENCIA: "sem perfil de correção cadastrado para esta cultura ainda",
};

/** Do pior para o melhor, para combinar o status geral de solo+folha num resumo só (cards da overview). */
const PRIORIDADE: StatusGeral[] = ["BAIXO", "ALTO", "MARGEM", "ADEQUADO", "SEM_REFERENCIA"];
function piorStatus(a: StatusGeral, b: StatusGeral): StatusGeral {
  return PRIORIDADE.indexOf(a) <= PRIORIDADE.indexOf(b) ? a : b;
}

function Bolinha({ status, className = "h-2.5 w-2.5" }: { status: StatusGeral; className?: string }) {
  return (
    <span
      title={TITULO_STATUS[status]}
      className={`inline-block shrink-0 rounded-full ${COR_STATUS_GERAL[status]} ${className}`}
    />
  );
}

interface Resposta {
  talhoes: TalhaoNutricional[];
  satelite: boolean;
  ultimaSincronizacao: string | null;
  fonte: string;
}

const mesAnoLongo = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const mesCurto = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");

function Numero({
  chave,
  valor,
  variacao,
  status,
  unidade,
}: {
  chave: string;
  valor: unknown;
  /** % frente à análise anterior (a penúltima coleta). Ausente quando não há com o que comparar. */
  variacao?: number;
  /** Status deste nutriente x perfil da cultura — a bolinha do card. Omitida quando não há referência. */
  status?: StatusGeral;
  /** Unidade de medida deste valor (mg/dm³, g/kg...) — sempre em tooltip, nunca camuflada. */
  unidade?: string;
}) {
  if (valor == null || valor === "") return null;
  const nomeCompleto = ROTULO_NUTRIENTE[chave] ?? chave;
  return (
    <div
      className="relative rounded-lg bg-terra-50 px-2.5 py-1.5"
      title={unidade ? `${nomeCompleto}: ${typeof valor === "number" ? numero(valor, 2) : valor} ${unidade}` : nomeCompleto}
    >
      {status && status !== "SEM_REFERENCIA" && (
        <span className="absolute left-1.5 top-1.5">
          <Bolinha status={status} className="h-2 w-2" />
        </span>
      )}
      {variacao != null && (
        <span
          className={`absolute right-1 top-1 text-[10px] font-bold leading-none ${
            variacao < 0 ? "text-red-600" : variacao > 0 ? "text-mata-600" : "text-terra-500"
          }`}
          title="Variação frente à análise anterior (a penúltima coleta)"
        >
          {variacao > 0 ? "+" : ""}
          {numero(variacao, 0)}%
        </span>
      )}
      {/* Sem "uppercase": os rótulos já vêm na grafia química certa (Mg, Ca, H+Al) - forçar caixa alta virava "MG", "CA". */}
      <p className="text-center text-xs tracking-wide text-terra-500">{nomeCompleto}</p>
      <p className="numero text-center text-base font-semibold text-terra-800">
        {typeof valor === "number" ? numero(valor, 2) : String(valor)}
      </p>
      {unidade && <p className="text-center text-[10px] leading-none text-terra-400">{unidade}</p>}
    </div>
  );
}

/** Busca a imagem NDVI autenticada (Bearer, não cookie) como blob — <img src> puro não manda o token. */
function useImagemSatelite(talhaoId: string, ativo: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!ativo) return;
    let objectUrl: string | null = null;
    let cancelado = false;
    setCarregando(true);
    setErro(false);

    const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333/api/v1";
    fetch(`${API_URL}/talhoes/${talhaoId}/ndvi.png?dias=60&largura=640`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("falhou");
        return res.blob();
      })
      .then((blob) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelado && setErro(true))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [talhaoId, ativo]);

  return { url, erro, carregando };
}

function PainelSatelite({ talhaoId }: { talhaoId: string }) {
  const { url, erro, carregando } = useImagemSatelite(talhaoId, true);
  return (
    <div className="overflow-hidden rounded-lg bg-terra-50">
      {carregando && (
        <div className="flex h-64 items-center justify-center text-sm text-terra-500">
          Buscando imagem de satélite…
        </div>
      )}
      {!carregando && erro && (
        <div className="flex h-64 flex-col items-center justify-center gap-1.5 text-sm text-terra-500">
          <ImageOff size={20} />
          Imagem indisponível (satélite não configurado ou sem cena recente)
        </div>
      )}
      {!carregando && url && (
        <img src={url} alt="NDVI do talhão, últimos 60 dias" className="h-64 w-full object-contain" />
      )}
    </div>
  );
}

function GraficoOsavi({ t }: { t: TalhaoNutricional }) {
  const serie = t.serieOsavi
    .filter((l) => l.pixels > 0 && l.osaviMedio != null)
    .map((l) => ({
      rotulo: mesCurto(l.data),
      iso: l.data,
      osavi: Number(l.osaviMedio?.toFixed(3)),
    }));

  const marcas = t.adubacoes
    .map((a) => ({ rotulo: mesCurto(a.data), foliar: a.temFoliar }))
    .filter((m) => serie.some((s) => s.rotulo === m.rotulo));

  return (
    <div>
      <p className="mb-1.5 flex items-center justify-between text-sm font-semibold text-terra-700">
        <span className="flex items-center gap-1.5">
          <Satellite size={14} className="text-terra-500" />
          Vigor (OSAVI) — 13 meses
        </span>
        {t.variacaoAnual != null && (
          <span
            title="Frente ao mesmo mês, um ano antes"
            className={
              t.variacaoAnual <= -10 ? "text-red-700" : t.variacaoAnual < 0 ? "text-amber-700" : "text-mata-700"
            }
          >
            {t.variacaoAnual > 0 ? "+" : ""}
            {t.variacaoAnual}% vs. ano passado
          </span>
        )}
      </p>
      {serie.length < 2 ? (
        <div className="flex h-64 items-center justify-center rounded-lg bg-terra-50 text-sm text-terra-500">
          sem cenas limpas suficientes
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 5" stroke="#e7e3db" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "#7a6f59" }} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
              <YAxis tick={{ fontSize: 11, fill: "#7a6f59" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e7e3db", fontSize: 12 }} formatter={(v: number) => [numero(v, 3), "OSAVI"]} />
              {marcas.map((m, i) => (
                <ReferenceLine key={i} x={m.rotulo} stroke={m.foliar ? "#c9dd1c" : "#8fbf9e"} strokeDasharray="3 3" />
              ))}
              <Line type="monotone" dataKey="osavi" stroke="#2a6844" strokeWidth={2.5} dot={{ r: 2.5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {marcas.length > 0 && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-terra-600">
          <span className="flex items-center gap-1">
            <i className="h-2 w-3 border-t-2 border-dashed border-[#8fbf9e]" /> adubação de solo
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-3 border-t-2 border-dashed border-[#c9dd1c]" /> nutrição foliar
          </span>
        </p>
      )}
    </div>
  );
}

/** Cartão compacto de resumo, um por talhão, na overview. */
function CartaoResumo({ t }: { t: TalhaoNutricional }) {
  const status = piorStatus(t.statusGeralSolo, t.statusGeralFoliar);
  const critico = t.alertas.some((a) => a.gravidade === "critico");
  const temAlerta = t.alertas.length > 0;
  const serie = t.serieOsavi.filter((l) => l.pixels > 0 && l.osaviMedio != null).slice(-8).map((l) => ({
    rotulo: mesCurto(l.data),
    osavi: Number(l.osaviMedio?.toFixed(3)),
  }));

  return (
    <Link
      to={ROTAS.manejoNutricionalTalhao(t.talhaoId)}
      className={`group block rounded-2xl border bg-white p-4 shadow-cartao transition duration-200 ease-suave hover:-translate-y-0.5 hover:shadow-cartao-alto ${
        critico ? "border-red-200" : temAlerta ? "border-amber-200" : "border-terra-100"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-base font-semibold text-terra-900">
            <Bolinha status={status} />
            {t.codigo ? `${t.codigo} · ` : ""}
            {t.nome}
          </p>
          <p className="text-sm text-terra-600">
            {t.cultura ?? "sem cultura"}
            {t.areaHa != null && ` · ${numero(t.areaHa, 2)} ha`}
          </p>
        </div>
        <ArrowRight size={16} className="mt-1 shrink-0 text-terra-300 transition group-hover:translate-x-0.5 group-hover:text-mata-600" />
      </div>

      {serie.length >= 2 && (
        <div className="h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie}>
              <Line type="monotone" dataKey="osavi" stroke="#2a6844" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {t.alertas.slice(0, 2).map((a, i) => (
          <Etiqueta key={i} tom={a.gravidade === "critico" ? "perigo" : "alerta"}>
            {a.mensagem}
          </Etiqueta>
        ))}
        {!temAlerta && <Etiqueta tom="mata">nutrição em dia</Etiqueta>}
      </div>
    </Link>
  );
}

/** Detalhe completo de um talhão: análises com bolinha por nutriente, satélite e adubações. */
function DetalheTalhao({ t }: { t: TalhaoNutricional }) {
  return (
    <div className="escalonar space-y-4">
      <Link to={ROTAS.manejoNutricional} className="flex items-center gap-1.5 text-sm font-medium text-terra-600 hover:text-mata-700">
        <ArrowLeft size={15} />
        Voltar para todos os talhões
      </Link>

      <Cartao>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to={`${ROTAS.talhoes}/${t.talhaoId}`} className="group flex items-center gap-1.5 text-xl font-semibold text-terra-900 hover:text-mata-700">
              {t.codigo ? `${t.codigo} · ` : ""}
              {t.nome}
              <ArrowRight size={16} className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
            <p className="text-sm text-terra-600">
              {t.cultura ?? "sem cultura"}
              {t.areaHa != null && ` · ${numero(t.areaHa, 2)} ha`}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {t.alertas.map((a, i) => (
              <Etiqueta key={i} tom={a.gravidade === "critico" ? "perigo" : "alerta"}>
                {a.mensagem}
              </Etiqueta>
            ))}
            {t.alertas.length === 0 && <Etiqueta tom="mata">nutrição em dia</Etiqueta>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GraficoOsavi t={t} />
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-terra-700">
              <Satellite size={14} className="text-terra-500" />
              Imagem de satélite (NDVI, 60 dias)
            </p>
            <PainelSatelite talhaoId={t.talhaoId} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-semibold text-terra-700">
              <span className="flex items-center gap-1.5">
                <TestTube size={14} className="text-terra-500" />
                Última análise de solo
                {t.analiseSolo?.dataColeta && (
                  <span className="font-normal text-terra-500">· {dataCurta(String(t.analiseSolo.dataColeta))}</span>
                )}
              </span>
              {t.dataAnaliseSoloAnterior && (
                <span className="font-normal text-terra-500">(comparado com {dataCurta(t.dataAnaliseSoloAnterior)})</span>
              )}
            </p>
            {t.analiseSolo ? (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {CAMPOS_SOLO.map((chave) => (
                  <Numero
                    key={chave}
                    chave={chave}
                    valor={t.analiseSolo![chave]}
                    variacao={t.variacaoSolo[chave]}
                    status={t.statusPorNutrienteSolo[chave]}
                    unidade={UNIDADE_SOLO[chave]}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-terra-50 px-3 py-2 text-sm text-terra-500">nenhuma análise de solo lançada</p>
            )}
          </div>

          <div>
            <p className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-semibold text-terra-700">
              <span className="flex items-center gap-1.5">
                <Leaf size={14} className="text-terra-500" />
                Última análise foliar
                {t.analiseFoliar?.dataColeta && (
                  <span className="font-normal text-terra-500">· {dataCurta(String(t.analiseFoliar.dataColeta))}</span>
                )}
              </span>
              {t.dataAnaliseFoliarAnterior && (
                <span className="font-normal text-terra-500">(comparado com {dataCurta(t.dataAnaliseFoliarAnterior)})</span>
              )}
            </p>
            {t.analiseFoliar ? (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {CAMPOS_FOLIAR.map((chave) => (
                  <Numero
                    key={chave}
                    chave={chave}
                    valor={t.analiseFoliar![chave]}
                    variacao={t.variacaoFoliar[chave]}
                    status={t.statusPorNutrienteFoliar[chave]}
                    unidade={UNIDADE_FOLIAR[chave]}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-terra-50 px-3 py-2 text-sm text-terra-500">nenhuma análise foliar lançada</p>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-terra-100 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-terra-700">
            <Sprout size={14} className="text-terra-500" />
            Adubações nos últimos 12 meses ({t.adubacoes.length})
          </p>
          {t.adubacoes.length === 0 ? (
            <p className="rounded-lg bg-terra-50 px-3 py-2 text-sm text-terra-500">nenhuma adubação lançada no período</p>
          ) : (
            <ul className="space-y-1.5">
              {t.adubacoes.map((a, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="numero text-sm text-terra-600">{dataCurta(a.data)}</span>
                  <span className="font-medium text-terra-800">{a.tipoAtividade}</span>
                  <span className="text-terra-600">
                    {a.produtos.map((p) => `${p.nome} (${numero(p.quantidade, 2)} ${p.unidade})`).join(" · ")}
                  </span>
                  {a.temFoliar && <Etiqueta tom="limao">foliar</Etiqueta>}
                  {a.temSolo && <Etiqueta tom="mata">solo</Etiqueta>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Cartao>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-terra-50 px-3 py-2.5 text-xs text-terra-600">
        <span className="font-medium text-terra-700">Bolinha em cada nutriente — comparação com o perfil da cultura:</span>
        <span className="flex items-center gap-1.5"><Bolinha status="BAIXO" className="h-2 w-2" /> faltando</span>
        <span className="flex items-center gap-1.5"><Bolinha status="MARGEM" className="h-2 w-2" /> margem inferior</span>
        <span className="flex items-center gap-1.5"><Bolinha status="ADEQUADO" className="h-2 w-2" /> dentro do ideal</span>
        <span className="flex items-center gap-1.5"><Bolinha status="ALTO" className="h-2 w-2" /> bem acima</span>
      </div>
    </div>
  );
}

export default function ManejoNutricional() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const consulta = useQuery({
    queryKey: ["manejo-nutricional"],
    queryFn: () => api.get<Resposta>("/manejo-nutricional"),
    retry: false,
    // O relatorio so le o banco agora — nao ha motivo para refazer com
    // frequencia. Quem alimenta a leitura de satelite e o agendador semanal
    // (domingo de madrugada), nao mais um clique nesta tela.
    staleTime: 6 * 60 * 60 * 1000,
  });

  if (consulta.isLoading) {
    return (
      <div className="space-y-4">
        <TituloSecao icone={FlaskConical} descricao="Cruzando vigor, análises e adubações dos talhões">
          Manejo nutricional
        </TituloSecao>
        <Cartao>
          <p className="py-10 text-center text-sm text-terra-500">Carregando o relatório…</p>
        </Cartao>
      </div>
    );
  }

  if (consulta.isError) {
    return (
      <Aviso tom="neutro" titulo="Relatório indisponível" icone={CloudOff}>
        {consulta.error instanceof ApiError ? consulta.error.message : "Não foi possível montar o relatório."}
      </Aviso>
    );
  }

  const dados = consulta.data!;

  if (id) {
    const talhao = dados.talhoes.find((t) => t.talhaoId === id);
    if (!talhao) {
      navigate(ROTAS.manejoNutricional, { replace: true });
      return null;
    }
    return <DetalheTalhao t={talhao} />;
  }

  const comCritico = dados.talhoes.filter((t) => t.alertas.some((a) => a.gravidade === "critico")).length;
  const semAlerta = dados.talhoes.filter((t) => t.alertas.length === 0).length;
  const piorTalhao = dados.talhoes
    .filter((t) => t.osaviMedioAno != null)
    .sort((a, b) => (a.variacaoAnual ?? 0) - (b.variacaoAnual ?? 0))[0];

  return (
    <div className="escalonar space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-terra-900">Manejo nutricional</h1>
          <p className="mt-1 text-sm text-terra-600">
            Visão geral dos {dados.talhoes.length} talhões — clique num card para ver vigor por satélite,
            análises e adubações em detalhe.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-sm text-terra-500">
            {dados.ultimaSincronizacao ? `última leitura: ${mesAnoLongo(dados.ultimaSincronizacao)}` : "ainda sem leitura sincronizada"}
          </span>
          <span className="text-xs text-terra-400">atualiza sozinho, todo domingo de madrugada</span>
        </div>
      </header>

      {!dados.satelite && (
        <Aviso tom="alerta" titulo="Satélite não configurado" icone={Satellite}>
          As credenciais do Copernicus não estão no servidor, então a curva de vigor fica vazia. As análises
          e adubações continuam sendo mostradas.
        </Aviso>
      )}

      {dados.satelite && !dados.ultimaSincronizacao && (
        <Aviso tom="alerta" titulo="Nenhuma leitura sincronizada ainda" icone={Satellite}>
          O agendador ainda não rodou pela primeira vez. Na primeira sincronização o sistema busca alguns
          anos de uma vez; depois disso, atualiza sozinho toda semana.
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="cartao p-4">
          <p className="rotulo">Talhões</p>
          <p className="numero mt-1 text-2xl font-bold text-terra-800">{dados.talhoes.length}</p>
        </div>
        <div className="cartao p-4">
          <p className="rotulo">Nutrição em dia</p>
          <p className="numero mt-1 text-2xl font-bold text-mata-700">{semAlerta}</p>
        </div>
        <div className="cartao p-4">
          <p className="rotulo">Com pendência grave</p>
          <p className="numero mt-1 text-2xl font-bold text-red-700">{comCritico}</p>
        </div>
        <div className="cartao p-4">
          <p className="rotulo">{piorTalhao ? "Talhão com maior queda de vigor" : "Adubações no ano"}</p>
          {piorTalhao ? (
            <Link to={ROTAS.manejoNutricionalTalhao(piorTalhao.talhaoId)} className="mt-1 block text-lg font-bold text-terra-800 hover:text-mata-700">
              {piorTalhao.nome}
              {piorTalhao.variacaoAnual != null && (
                <span className="ml-1.5 numero text-sm font-semibold text-red-700">{piorTalhao.variacaoAnual}%</span>
              )}
            </Link>
          ) : (
            <p className="numero mt-1 text-2xl font-bold text-terra-800">
              {dados.talhoes.reduce((s, t) => s + t.adubacoes.length, 0)}
            </p>
          )}
        </div>
      </div>

      {dados.talhoes.length === 0 ? (
        <Cartao>
          <EstadoVazio icone={FlaskConical} titulo="Nenhum talhão cadastrado" descricao="Cadastre os talhões para acompanhar o manejo nutricional." />
        </Cartao>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dados.talhoes.map((t) => (
            <CartaoResumo key={t.talhaoId} t={t} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-terra-50 px-3 py-2.5 text-xs leading-relaxed text-terra-600">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          O gráfico de cada talhão marca quando houve adubação, para olhar a curva e a aplicação na mesma
          linha do tempo. <strong>Isso é correlação, não causa</strong> — entre uma adubação e uma mudança
          de vigor há chuva, colheita, poda e florada. O relatório aponta lacunas objetivas (análise
          vencida, talhão sem adubação, vigor caindo) e deixa o diagnóstico com você. · {dados.fonte}
        </span>
      </div>
    </div>
  );
}
