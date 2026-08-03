import { useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  EyeOff,
  FileSpreadsheet,
  FlaskConical,
  Loader2,
  RotateCcw,
  Upload,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { Aviso, Cartao, EstadoVazio, Etiqueta, numero } from "../../components/ui";
import type { Talhao } from "../../lib/types";

type TipoLaudo = "QUIMICA" | "FISICA" | "MICRO" | "FOLIAR" | "ORGANICO";
type Situacao = "PENDENTE" | "IMPORTADO" | "IGNORADO";

interface Amostra {
  id: string;
  codigoLaboratorio: string | null;
  identificacao: string | null;
  profundidade: string | null;
  valores: Record<string, number>;
  naoReconhecidas: string[];
  avisosUnidade: string[];
  /** Unidade de cada valor (mg/dm³, mmolc/dm³...), para mostrar na tela. */
  unidades: Record<string, string>;
  /** Calculados a partir de outros valores (V%, CTC...) — não vêm pré-preenchidos. */
  camposDerivados: string[];
  /** Uma coleta pode valer para mais de um talhão. */
  talhaoIds: string[];
  loteCompostoId: string | null;
  sugestao: { talhaoId: string; nome: string; confianca: number } | null;
}

interface Laudo {
  id: string;
  nomeArquivo: string;
  tipo: TipoLaudo;
  situacao: Situacao;
  cliente: string | null;
  dataColeta: string | null;
  digitacaoManual: boolean;
  textoExtraido: string | null;
  amostras: Amostra[];
}

interface LoteComposto {
  id: string;
  nome: string;
}

const ROTULO_TIPO: Record<TipoLaudo, string> = {
  QUIMICA: "Química do solo",
  FISICA: "Física do solo",
  MICRO: "Micronutrientes",
  FOLIAR: "Foliar (folha)",
  ORGANICO: "Composto orgânico",
};

const TOM_TIPO: Record<TipoLaudo, "mata" | "agua" | "limao" | "alerta" | "neutro"> = {
  QUIMICA: "mata",
  FISICA: "neutro",
  MICRO: "agua",
  FOLIAR: "limao",
  ORGANICO: "alerta",
};

/** Nome bonito de cada valor, para a tabela de conferência. */
const ROTULO_VALOR: Record<string, string> = {
  ph: "pH", materiaOrganica: "M.O.", fosforo: "P", enxofre: "S", calcio: "Ca",
  magnesio: "Mg", sodio: "Na", potassio: "K", aluminio: "Al", hAl: "H+Al",
  somaBases: "S.B.", ctc: "CTC", saturacaoBases: "V%", saturacaoAluminio: "m%",
  argila: "Argila", silte: "Silte", areiaTotal: "Areia total",
  areiaMuitoGrossa: "AMG", areiaGrossa: "AG", areiaMedia: "AM", areiaFina: "AF",
  areiaMuitoFina: "AMF", argilaDispersaAgua: "Argila disp.",
  grauFloculacao: "Grau flocul.", grauDispersao: "Grau disp.",
  boro: "B", cobre: "Cu", ferro: "Fe", manganes: "Mn", zinco: "Zn", silicio: "Si",
  nitrogenio: "N", carbonoOrganico: "C.O.", p2o5Total: "P₂O₅", k2o: "K₂O",
  umidade: "Umidade", relacaoCN: "C/N",
};

const ABAS: { id: Situacao; rotulo: string }[] = [
  { id: "PENDENTE", rotulo: "Pendentes" },
  { id: "IMPORTADO", rotulo: "Importados" },
  { id: "IGNORADO", rotulo: "Ignorados" },
];

/** Abre a planilha no navegador. O arquivo não sobe — só os números sobem. */
async function lerPlanilha(arquivo: File): Promise<(string | number | null)[][]> {
  const buffer = await arquivo.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  // Datas viram texto para atravessar o JSON sem perder o dia.
  return (matriz as unknown[][]).map((linha) =>
    linha.map((c) => {
      if (c == null) return null;
      if (c instanceof Date) return c.toISOString();
      return typeof c === "number" || typeof c === "string" ? c : String(c);
    }),
  );
}

/**
 * PDF em base64, para o servidor mandar ao OCR. O arquivo passa pela nossa
 * API (nunca fica salvo em disco nem no banco - só o texto que volta do OCR
 * é guardado), diferente da planilha, que é lida inteira no navegador.
 */
async function lerPdfComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(leitor.error ?? new Error("falha ao ler o arquivo"));
    leitor.readAsDataURL(arquivo);
  });
}

interface Destino {
  /** Uma coleta pode valer para mais de um talhão. */
  talhaoIds: string[];
  loteCompostoId: string;
}

/** Valores prontos para edição: campos derivados (V%, CTC...) começam em branco. */
function valoresIniciais(amostra: Amostra): Record<string, number> {
  const v = { ...amostra.valores };
  for (const c of amostra.camposDerivados) delete v[c];
  return v;
}

function LinhaAmostra({
  amostra,
  laudo,
  talhoes,
  lotes,
  destino,
  valores,
  onDestino,
  onValor,
}: {
  amostra: Amostra;
  laudo: Laudo;
  talhoes: Talhao[];
  lotes: LoteComposto[];
  destino: Destino;
  valores: Record<string, number>;
  onDestino: (v: Destino) => void;
  onValor: (chave: string, v: number) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const chaves = Object.keys(amostra.valores);
  const ehComposto = laudo.tipo === "ORGANICO";

  function alternarTalhao(talhaoId: string) {
    const marcado = destino.talhaoIds.includes(talhaoId);
    onDestino({
      loteCompostoId: "",
      talhaoIds: marcado
        ? destino.talhaoIds.filter((id) => id !== talhaoId)
        : [...destino.talhaoIds, talhaoId],
    });
  }

  function alternarLote(loteId: string) {
    onDestino({
      talhaoIds: [],
      loteCompostoId: destino.loteCompostoId === loteId ? "" : loteId,
    });
  }

  const talhoesConfirmados = talhoes.filter((t) => amostra.talhaoIds.includes(t.id));

  return (
    <div className="border-t border-terra-100">
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        <button
          onClick={() => setAberta((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {aberta ? (
            <ChevronDown size={15} className="shrink-0 text-terra-400" />
          ) : (
            <ChevronRight size={15} className="shrink-0 text-terra-400" />
          )}
          <span className="min-w-0">
            <span className="block truncate font-medium text-terra-800">
              {amostra.identificacao ?? "sem identificação"}
            </span>
            <span className="block text-xs text-terra-500">
              {amostra.codigoLaboratorio ?? "—"}
              {amostra.profundidade && ` · ${amostra.profundidade}`}
              {` · ${chaves.length} valores`}
            </span>
          </span>
        </button>

        {laudo.situacao === "PENDENTE" ? (
          <div className="flex max-w-md flex-wrap justify-end gap-1.5">
            {!ehComposto &&
              talhoes.map((t) => {
                const marcado = destino.talhaoIds.includes(t.id);
                const sugerido = amostra.sugestao?.talhaoId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => alternarTalhao(t.id)}
                    title={sugerido ? "Sugerido pelo sistema" : undefined}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      marcado
                        ? "border-mata-500 bg-mata-600 text-white"
                        : sugerido
                          ? "border-mata-400 bg-mata-50 text-mata-700"
                          : "border-terra-300 text-terra-600 hover:bg-terra-50"
                    }`}
                  >
                    {t.codigo ? `${t.codigo} · ` : ""}
                    {t.nome}
                  </button>
                );
              })}
            {lotes.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => alternarLote(l.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  destino.loteCompostoId === l.id
                    ? "border-mata-500 bg-mata-600 text-white"
                    : "border-terra-300 text-terra-600 hover:bg-terra-50"
                }`}
              >
                Composto: {l.nome}
              </button>
            ))}
            {destino.talhaoIds.length === 0 && !destino.loteCompostoId && (
              <span className="self-center text-xs text-terra-400">arquivar (não usar)</span>
            )}
          </div>
        ) : (
          <Etiqueta tom={talhoesConfirmados.length > 0 || amostra.loteCompostoId ? "mata" : "neutro"}>
            {talhoesConfirmados.length > 0
              ? talhoesConfirmados.map((t) => t.nome).join(", ")
              : amostra.loteCompostoId
                ? "composto"
                : "arquivada"}
          </Etiqueta>
        )}
      </div>

      {aberta && (
        <div className="bg-terra-50/60 px-4 pb-4">
          {chaves.length === 0 ? (
            <p className="py-3 text-sm text-terra-500">
              Nenhum valor foi lido — digite conferindo o laudo original.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 py-3 sm:grid-cols-5 lg:grid-cols-7">
              {chaves.map((c) => {
                const derivado = amostra.camposDerivados.includes(c);
                return (
                  <label key={c} className="block">
                    <span className="flex items-baseline justify-between gap-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-terra-500">
                        {ROTULO_VALOR[c] ?? c}
                      </span>
                      {amostra.unidades[c] && (
                        <span className="text-[9px] text-terra-400">{amostra.unidades[c]}</span>
                      )}
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={valores[c] ?? ""}
                      placeholder={derivado ? "digite conferindo" : undefined}
                      disabled={laudo.situacao !== "PENDENTE"}
                      onChange={(e) => onValor(c, Number(e.target.value))}
                      className={`numero w-full rounded-md border px-2 py-1 text-sm disabled:bg-terra-100 ${
                        derivado
                          ? "border-amber-300 bg-amber-50/60 placeholder:text-[10px] placeholder:text-amber-500"
                          : "border-terra-300"
                      }`}
                    />
                  </label>
                );
              })}
            </div>
          )}
          {amostra.camposDerivados.length > 0 && (
            <p className="mb-1 text-xs text-amber-700">
              Campos em amarelo são calculados (V%, CTC...) — digite olhando o laudo em papel; é a
              sua conferência de que os outros valores foram lidos certo.
            </p>
          )}
          {amostra.avisosUnidade.length > 0 && (
            <p className="mb-1 text-xs text-amber-700">
              Unidade: {amostra.avisosUnidade.join(" · ")}
            </p>
          )}
          {amostra.naoReconhecidas.length > 0 && (
            <p className="text-xs text-amber-700">
              Colunas que não reconheci neste laudo: {amostra.naoReconhecidas.join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdicionarAnalise() {
  const qc = useQueryClient();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [aba, setAba] = useState<Situacao>("PENDENTE");
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  // destino e valores editados, por amostra
  const [destinos, setDestinos] = useState<Record<string, Destino>>({});
  const [edicoes, setEdicoes] = useState<Record<string, Record<string, number>>>({});
  const [textoAberto, setTextoAberto] = useState<Record<string, boolean>>({});

  const { data: laudos, isLoading } = useQuery({
    queryKey: ["laudos", aba],
    queryFn: () => api.get<Laudo[]>(`/laudos?situacao=${aba}`),
  });
  const { data: talhoes } = useQuery({
    queryKey: ["talhoes"],
    queryFn: () => api.get<Talhao[]>("/talhoes"),
  });
  const { data: lotes } = useQuery({
    queryKey: ["lotes-composto"],
    queryFn: () => api.get<LoteComposto[]>("/lotes-composto"),
  });

  function atualizar() {
    qc.invalidateQueries({ queryKey: ["laudos"] });
  }

  const enviar = useMutation({
    mutationFn: async (arquivos: FileList | File[]) => {
      // "~$nome.xlsx" é o arquivo de bloqueio que o Excel cria enquanto a
      // planilha está aberta. Tem extensão .xlsx e viria junto se o usuário
      // arrastasse a pasta inteira — descartar em silêncio é melhor que
      // devolver um erro que ele não causou.
      const lista = Array.from(arquivos).filter((a) => !a.name.startsWith("~$"));
      let ok = 0;
      const problemas: string[] = [];
      for (const arquivo of lista) {
        try {
          const ehPlanilha = /\.(xlsx|xls)$/i.test(arquivo.name);
          if (ehPlanilha) {
            const planilha = await lerPlanilha(arquivo);
            await api.post("/laudos", { nomeArquivo: arquivo.name, planilha });
          } else {
            // PDF: o servidor manda para o OCR e volta com o texto (quando
            // configurado) — o usuário digita os valores conferindo, o
            // sistema não extrai número de PDF sozinho.
            const pdfBase64 = await lerPdfComoBase64(arquivo);
            await api.post("/laudos", { nomeArquivo: arquivo.name, pdfBase64 });
          }
          ok++;
        } catch (e) {
          problemas.push(`${arquivo.name}: ${e instanceof ApiError ? e.message : "falha ao ler"}`);
        }
      }
      return { ok, problemas };
    },
    onSuccess: ({ ok, problemas }) => {
      atualizar();
      setRecado(ok > 0 ? `${ok} laudo(s) lido(s) e aguardando conferência.` : null);
      setErro(problemas.length > 0 ? problemas.join(" | ") : null);
      setAba("PENDENTE");
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Falha ao enviar"),
  });

  const confirmar = useMutation({
    mutationFn: (laudo: Laudo) =>
      api.post<{ gravadas: number; arquivadas: number }>(`/laudos/${laudo.id}/confirmar`, {
        amostras: laudo.amostras.map((a) => {
          const padrao: Destino = {
            talhaoIds: a.sugestao ? [a.sugestao.talhaoId] : [],
            loteCompostoId: "",
          };
          const destino = destinos[a.id] ?? padrao;
          return {
            amostraId: a.id,
            talhaoIds: destino.talhaoIds,
            loteCompostoId: destino.loteCompostoId || null,
            valores: edicoes[a.id] ?? valoresIniciais(a),
          };
        }),
      }),
    onSuccess: (r) => {
      atualizar();
      setRecado(`${r.gravadas} análise(s) gravada(s), ${r.arquivadas} arquivada(s).`);
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Falha ao confirmar"),
  });

  const ignorar = useMutation({
    mutationFn: (id: string) => api.patch(`/laudos/${id}/ignorar`, {}),
    onSuccess: atualizar,
  });
  const reabrir = useMutation({
    mutationFn: (id: string) => api.patch(`/laudos/${id}/reabrir`, {}),
    onSuccess: atualizar,
  });

  function aoSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    if (e.dataTransfer.files?.length) enviar.mutate(e.dataTransfer.files);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-terra-900">Adicionar análise</h2>
        <p className="mt-1 text-sm text-terra-500">
          Arraste os laudos do laboratório. O sistema lê cada amostra e deixa esperando — nada entra
          no talhão sem você conferir os números e dizer a quem pertence.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        onClick={() => arquivoRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
          arrastando
            ? "border-mata-500 bg-mata-50"
            : "border-terra-300 bg-white hover:border-mata-400 hover:bg-mata-50/40"
        }`}
      >
        <input
          ref={arquivoRef}
          type="file"
          accept=".xlsx,.xls,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) enviar.mutate(e.target.files);
            e.target.value = "";
          }}
        />
        {enviar.isPending ? (
          <Loader2 size={30} className="mb-3 animate-spin text-mata-600" />
        ) : (
          <Upload size={30} className="mb-3 text-terra-400" />
        )}
        <p className="text-base font-semibold text-terra-800">
          {enviar.isPending ? "Lendo os laudos…" : "Arraste os laudos aqui"}
        </p>
        <p className="mt-1 text-sm text-terra-500">
          Uma ou várias de uma vez. Planilha do laboratório (.xlsx) ou PDF.
        </p>
        <p className="mt-2 text-xs text-terra-400">
          A planilha é lida no seu navegador — o arquivo não sobe para o servidor, só os números.
        </p>
      </div>

      {recado && <Aviso tom="mata" titulo={recado} icone={CheckCircle2} />}
      {erro && (
        <Aviso tom="perigo" titulo="Não consegui ler tudo">
          {erro}
        </Aviso>
      )}

      <div className="flex gap-2">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              aba === a.id ? "bg-mata-600 text-white" : "bg-terra-100 text-terra-600 hover:bg-terra-200"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {isLoading && (
        <Cartao>
          <p className="py-8 text-center text-sm text-terra-500">Carregando…</p>
        </Cartao>
      )}

      {!isLoading && laudos?.length === 0 && (
        <Cartao>
          <EstadoVazio
            icone={FlaskConical}
            titulo={aba === "PENDENTE" ? "Nenhum laudo esperando" : "Nada aqui"}
            descricao={
              aba === "PENDENTE"
                ? "Arraste os arquivos do laboratório na área acima."
                : undefined
            }
          />
        </Cartao>
      )}

      {laudos?.map((laudo) => (
        <Cartao key={laudo.id} className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-terra-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <FileSpreadsheet size={17} className="shrink-0 text-terra-400" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-terra-900">{laudo.nomeArquivo}</p>
                <p className="text-xs text-terra-500">
                  {laudo.amostras.length} amostra(s)
                  {laudo.dataColeta &&
                    ` · coleta ${new Date(laudo.dataColeta).toLocaleDateString("pt-BR")}`}
                  {laudo.cliente && ` · ${laudo.cliente}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Etiqueta tom={TOM_TIPO[laudo.tipo]}>{ROTULO_TIPO[laudo.tipo]}</Etiqueta>
              {laudo.digitacaoManual && <Etiqueta tom="alerta">digitar conferindo</Etiqueta>}
              {laudo.situacao === "PENDENTE" ? (
                <>
                  <button
                    onClick={() => confirmar.mutate(laudo)}
                    disabled={confirmar.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-mata-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-mata-700 disabled:opacity-60"
                  >
                    <CheckCircle2 size={14} />
                    Confirmar
                  </button>
                  <button
                    onClick={() => ignorar.mutate(laudo.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-terra-300 px-3 py-1.5 text-sm font-medium text-terra-600 transition hover:bg-terra-50"
                  >
                    <EyeOff size={14} />
                    Ignorar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => reabrir.mutate(laudo.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-terra-300 px-3 py-1.5 text-sm font-medium text-terra-600 transition hover:bg-terra-50"
                >
                  <RotateCcw size={14} />
                  Reabrir
                </button>
              )}
            </div>
          </div>

          {laudo.digitacaoManual && (
            <div className="border-b border-terra-100 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-800">
              <p>
                Este arquivo é PDF. O texto do laudo junta valores (&quot;23,7512,21&quot; são dois
                números) e quebra número entre linhas — chutar aqui gravaria valor errado, e
                adubação em cima de valor errado é prejuízo. Digite os valores abaixo conferindo o
                laudo original.
              </p>
              {laudo.textoExtraido && (
                <>
                  <button
                    type="button"
                    onClick={() => setTextoAberto((t) => ({ ...t, [laudo.id]: !t[laudo.id] }))}
                    className="mt-1.5 font-semibold underline decoration-dotted"
                  >
                    {textoAberto[laudo.id] ? "esconder" : "mostrar"} texto lido do PDF (OCR, só para
                    conferência)
                  </button>
                  {textoAberto[laudo.id] && (
                    <pre className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2.5 font-mono text-[11px] text-terra-700">
                      {laudo.textoExtraido}
                    </pre>
                  )}
                </>
              )}
            </div>
          )}

          {laudo.amostras.map((a) => {
            const padrao: Destino = {
              talhaoIds: a.sugestao ? [a.sugestao.talhaoId] : [],
              loteCompostoId: "",
            };
            return (
              <LinhaAmostra
                key={a.id}
                amostra={a}
                laudo={laudo}
                talhoes={talhoes ?? []}
                lotes={lotes ?? []}
                destino={destinos[a.id] ?? padrao}
                valores={edicoes[a.id] ?? valoresIniciais(a)}
                onDestino={(v) => setDestinos((d) => ({ ...d, [a.id]: v }))}
                onValor={(chave, v) =>
                  setEdicoes((e) => ({
                    ...e,
                    [a.id]: { ...(e[a.id] ?? valoresIniciais(a)), [chave]: v },
                  }))
                }
              />
            );
          })}
        </Cartao>
      ))}

      <div className="flex items-start gap-2 rounded-lg bg-terra-50 px-3 py-2.5 text-xs leading-relaxed text-terra-500">
        <Archive size={14} className="mt-0.5 shrink-0" />
        <span>
          Amostra deixada em <strong>&quot;arquivar&quot;</strong> não entra em talhão nenhum — fica
          registrada no laudo, sem virar análise. O laudo inteiro pode ser <strong>ignorado</strong>,
          como nas notas fiscais, e reaberto depois. Confirmar não apaga nada: reabrir devolve o
          laudo à fila sem mexer no que já foi gravado.
        </span>
      </div>
    </div>
  );
}
