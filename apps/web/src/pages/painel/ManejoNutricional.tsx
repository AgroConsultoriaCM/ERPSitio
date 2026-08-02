import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
  ArrowRight,
  CloudOff,
  FlaskConical,
  Leaf,
  Loader2,
  RefreshCw,
  Satellite,
  Sprout,
  TestTube,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
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
  adubacoes: Adubacao[];
  alertas: Alerta[];
}

interface Resposta {
  talhoes: TalhaoNutricional[];
  satelite: boolean;
  ultimaSincronizacao: string | null;
  fonte: string;
}

interface ResultadoSincronizacao {
  talhaoId: string;
  nome: string;
  status: "backfill" | "gravado" | "ja_tinha" | "sem_cena_limpa" | "sem_poligono" | "erro";
  leiturasGravadas?: number;
  osaviMedio?: number | null;
  mensagem?: string;
}

const mesAnoLongo = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const mesCurto = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");

function Numero({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  if (valor == null || valor === "") return null;
  return (
    <div className="rounded-lg bg-terra-50 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-terra-400">{rotulo}</p>
      <p className="numero text-sm font-semibold text-terra-800">
        {typeof valor === "number" ? numero(valor, 2) : String(valor)}
      </p>
    </div>
  );
}

function CartaoTalhao({ t }: { t: TalhaoNutricional }) {
  const serie = t.serieOsavi
    .filter((l) => l.pixels > 0 && l.osaviMedio != null)
    .map((l) => ({
      rotulo: mesCurto(l.data),
      iso: l.data,
      osavi: Number(l.osaviMedio?.toFixed(3)),
    }));

  // Marca no gráfico quando houve adubação: é o que permite olhar a curva e a
  // aplicação na mesma linha do tempo. Correlação para o agrônomo julgar —
  // entre uma coisa e outra há chuva, colheita e poda.
  const marcas = t.adubacoes
    .map((a) => ({ rotulo: mesCurto(a.data), foliar: a.temFoliar }))
    .filter((m) => serie.some((s) => s.rotulo === m.rotulo));

  const critico = t.alertas.some((a) => a.gravidade === "critico");
  const temAlerta = t.alertas.length > 0;

  return (
    <Cartao className={critico ? "border-red-200" : temAlerta ? "border-amber-200" : ""}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={`${ROTAS.talhoes}/${t.talhaoId}`}
            className="group flex items-center gap-1.5 text-base font-semibold text-terra-900 hover:text-mata-700"
          >
            {t.codigo ? `${t.codigo} · ` : ""}
            {t.nome}
            <ArrowRight
              size={14}
              className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
            />
          </Link>
          <p className="text-xs text-terra-500">
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
          {!temAlerta && <Etiqueta tom="mata">nutrição em dia</Etiqueta>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-1.5 flex items-center justify-between text-xs font-semibold text-terra-600">
            <span className="flex items-center gap-1.5">
              <Satellite size={13} className="text-terra-400" />
              Vigor (OSAVI) — 12 meses
            </span>
            {t.variacaoAnual != null && (
              <span
                className={
                  t.variacaoAnual <= -10
                    ? "text-red-700"
                    : t.variacaoAnual < 0
                      ? "text-amber-700"
                      : "text-mata-700"
                }
              >
                {t.variacaoAnual > 0 ? "+" : ""}
                {t.variacaoAnual}% no período
              </span>
            )}
          </p>
          {serie.length < 2 ? (
            <div className="flex h-36 items-center justify-center rounded-lg bg-terra-50 text-xs text-terra-400">
              sem cenas limpas suficientes
            </div>
          ) : (
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie} margin={{ top: 6, right: 6, left: -26, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 5" stroke="#e7e3db" vertical={false} />
                  <XAxis
                    dataKey="rotulo"
                    tick={{ fontSize: 10, fill: "#94886f" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={14}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#94886f" }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid #e7e3db", fontSize: 12 }}
                    formatter={(v: number) => [numero(v, 3), "OSAVI"]}
                  />
                  {marcas.map((m, i) => (
                    <ReferenceLine
                      key={i}
                      x={m.rotulo}
                      stroke={m.foliar ? "#c9dd1c" : "#8fbf9e"}
                      strokeDasharray="3 3"
                    />
                  ))}
                  <Line type="monotone" dataKey="osavi" stroke="#2a6844" strokeWidth={2.5} dot={{ r: 2.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {marcas.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[10px] text-terra-500">
              <span className="flex items-center gap-1">
                <i className="h-2 w-3 border-t-2 border-dashed border-[#8fbf9e]" /> adubação de solo
              </span>
              <span className="flex items-center gap-1">
                <i className="h-2 w-3 border-t-2 border-dashed border-[#c9dd1c]" /> nutrição foliar
              </span>
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-terra-600">
              <TestTube size={13} className="text-terra-400" />
              Última análise de solo
              {t.analiseSolo?.dataColeta && (
                <span className="font-normal text-terra-400">
                  · {dataCurta(String(t.analiseSolo.dataColeta))}
                </span>
              )}
            </p>
            {t.analiseSolo ? (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                <Numero rotulo="pH" valor={t.analiseSolo.ph} />
                <Numero rotulo="M.O." valor={t.analiseSolo.materiaOrganica} />
                <Numero rotulo="P" valor={t.analiseSolo.fosforo} />
                <Numero rotulo="K" valor={t.analiseSolo.potassio} />
                <Numero rotulo="Ca" valor={t.analiseSolo.calcio} />
                <Numero rotulo="Mg" valor={t.analiseSolo.magnesio} />
                <Numero rotulo="CTC" valor={t.analiseSolo.ctc} />
                <Numero rotulo="V%" valor={t.analiseSolo.saturacaoBases} />
              </div>
            ) : (
              <p className="rounded-lg bg-terra-50 px-3 py-2 text-xs text-terra-400">
                nenhuma análise de solo lançada
              </p>
            )}
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-terra-600">
              <Leaf size={13} className="text-terra-400" />
              Última análise foliar
              {t.analiseFoliar?.dataColeta && (
                <span className="font-normal text-terra-400">
                  · {dataCurta(String(t.analiseFoliar.dataColeta))}
                </span>
              )}
            </p>
            {t.analiseFoliar ? (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                <Numero rotulo="N" valor={t.analiseFoliar.nitrogenio} />
                <Numero rotulo="P" valor={t.analiseFoliar.fosforo} />
                <Numero rotulo="K" valor={t.analiseFoliar.potassio} />
                <Numero rotulo="Ca" valor={t.analiseFoliar.calcio} />
                <Numero rotulo="Mg" valor={t.analiseFoliar.magnesio} />
                <Numero rotulo="S" valor={t.analiseFoliar.enxofre} />
              </div>
            ) : (
              <p className="rounded-lg bg-terra-50 px-3 py-2 text-xs text-terra-400">
                nenhuma análise foliar lançada
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-terra-100 pt-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-terra-600">
          <Sprout size={13} className="text-terra-400" />
          Adubações nos últimos 12 meses ({t.adubacoes.length})
        </p>
        {t.adubacoes.length === 0 ? (
          <p className="rounded-lg bg-terra-50 px-3 py-2 text-xs text-terra-400">
            nenhuma adubação lançada no período
          </p>
        ) : (
          <ul className="space-y-1.5">
            {t.adubacoes.slice(0, 6).map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="numero text-xs text-terra-500">{dataCurta(a.data)}</span>
                <span className="font-medium text-terra-800">{a.tipoAtividade}</span>
                <span className="text-terra-500">
                  {a.produtos
                    .map((p) => `${p.nome} (${numero(p.quantidade, 2)} ${p.unidade})`)
                    .join(" · ")}
                </span>
                {a.temFoliar && <Etiqueta tom="limao">foliar</Etiqueta>}
                {a.temSolo && <Etiqueta tom="mata">solo</Etiqueta>}
              </li>
            ))}
            {t.adubacoes.length > 6 && (
              <li className="text-xs text-terra-400">e mais {t.adubacoes.length - 6}…</li>
            )}
          </ul>
        )}
      </div>
    </Cartao>
  );
}

export default function ManejoNutricional() {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: ["manejo-nutricional"],
    queryFn: () => api.get<Resposta>("/manejo-nutricional"),
    retry: false,
    // O relatorio so le o banco agora — nao ha motivo para refazer com
    // frequencia, ja que a leitura de satelite so muda quando alguem
    // sincroniza (uma vez por mes, tipicamente).
    staleTime: 6 * 60 * 60 * 1000,
  });

  // Dispara POST /satelite/sincronizar. E a UNICA chamada ao Copernicus desta
  // tela inteira — abrir a pagina em si e so leitura de banco, instantanea.
  const sincronizar = useMutation({
    mutationFn: () => api.post<{ resultados: ResultadoSincronizacao[] }>("/satelite/sincronizar"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manejo-nutricional"] });
    },
  });

  if (consulta.isLoading) {
    return (
      <div className="space-y-4">
        <TituloSecao icone={FlaskConical} descricao="Cruzando vigor, análises e adubações dos 7 talhões">
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
        {consulta.error instanceof ApiError
          ? consulta.error.message
          : "Não foi possível montar o relatório."}
      </Aviso>
    );
  }

  const dados = consulta.data!;
  const comCritico = dados.talhoes.filter((t) =>
    t.alertas.some((a) => a.gravidade === "critico"),
  ).length;
  const semAlerta = dados.talhoes.filter((t) => t.alertas.length === 0).length;

  const r = sincronizar.data?.resultados;
  const novas = r?.filter((x) => x.status === "backfill" || x.status === "gravado").length ?? 0;
  const jaTinha = r?.filter((x) => x.status === "ja_tinha").length ?? 0;
  const semCena = r?.filter((x) => x.status === "sem_cena_limpa").length ?? 0;
  const semPoligono = r?.filter((x) => x.status === "sem_poligono").length ?? 0;

  return (
    <div className="escalonar space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-terra-900">Manejo nutricional</h1>
          <p className="mt-1 text-sm text-terra-500">
            Um ano de vigor por satélite, as últimas análises de solo e folha e as adubações do
            período — solo e foliar — na mesma linha do tempo, talhão a talhão.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => sincronizar.mutate()}
            disabled={!dados.satelite || sincronizar.isPending}
            title={!dados.satelite ? "Satélite não configurado no servidor" : undefined}
            className="flex items-center gap-2 rounded-lg border border-terra-300 bg-white px-3.5 py-2 text-sm font-medium text-terra-700 shadow-cartao transition hover:bg-terra-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sincronizar.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            {sincronizar.isPending ? "Sincronizando…" : "Sincronizar agora"}
          </button>
          <span className="text-xs text-terra-400">
            {dados.ultimaSincronizacao
              ? `última leitura: ${mesAnoLongo(dados.ultimaSincronizacao)}`
              : "ainda sem leitura sincronizada"}
          </span>
        </div>
      </header>

      {sincronizar.isError && (
        <Aviso tom="perigo" titulo="Falha ao sincronizar" icone={CloudOff}>
          {sincronizar.error instanceof ApiError
            ? sincronizar.error.message
            : "Não foi possível falar com o satélite agora."}
        </Aviso>
      )}

      {r && (
        <Aviso tom="mata" titulo="Sincronização concluída" icone={RefreshCw}>
          {novas > 0 && `${novas} talhão${novas > 1 ? "ões" : ""} atualizado${novas > 1 ? "s" : ""}. `}
          {jaTinha > 0 && `${jaTinha} já tinha leitura deste mês. `}
          {semCena > 0 && `${semCena} sem cena limpa no momento. `}
          {semPoligono > 0 && `${semPoligono} sem contorno desenhado.`}
          {novas === 0 && jaTinha === 0 && semCena === 0 && semPoligono === 0 && "nada para atualizar."}
        </Aviso>
      )}

      {!dados.satelite && (
        <Aviso tom="alerta" titulo="Satélite não configurado" icone={Satellite}>
          As credenciais do Copernicus não estão no servidor, então a curva de vigor fica vazia. As
          análises e adubações continuam sendo mostradas.
        </Aviso>
      )}

      {dados.satelite && !dados.ultimaSincronizacao && (
        <Aviso tom="alerta" titulo="Nenhuma leitura sincronizada ainda" icone={RefreshCw}>
          Clique em "Sincronizar agora" para trazer o histórico de vigor de cada talhão. Na primeira
          vez, o sistema busca alguns anos de uma vez — nas próximas, só o mês atual.
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
          <p className="rotulo">Adubações no ano</p>
          <p className="numero mt-1 text-2xl font-bold text-terra-800">
            {dados.talhoes.reduce((s, t) => s + t.adubacoes.length, 0)}
          </p>
        </div>
      </div>

      {dados.talhoes.length === 0 ? (
        <Cartao>
          <EstadoVazio
            icone={FlaskConical}
            titulo="Nenhum talhão cadastrado"
            descricao="Cadastre os talhões para acompanhar o manejo nutricional."
          />
        </Cartao>
      ) : (
        <div className="space-y-4">
          {dados.talhoes.map((t) => (
            <CartaoTalhao key={t.talhaoId} t={t} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-terra-50 px-3 py-2.5 text-xs leading-relaxed text-terra-500">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          As linhas tracejadas marcam quando houve adubação, para você olhar a curva e a aplicação na
          mesma linha do tempo. <strong>Isso é correlação, não causa</strong> — entre uma adubação e
          uma mudança de vigor há chuva, colheita, poda e florada. O relatório aponta lacunas
          objetivas (análise vencida, talhão sem adubação, vigor caindo) e deixa o diagnóstico com
          você. · {dados.fonte}
        </span>
      </div>
    </div>
  );
}
