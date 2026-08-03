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
  /** Linha original do texto lido por OCR, quando o sistema separou esta amostra automaticamente de um PDF. */
  linhaOriginal: string | null;
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

/**
 * Todo campo que cada tipo de laudo pode ter — usado na digitação 100%
 * manual, quando o sistema não consegue extrair nada do arquivo (PDF sem
 * planilha) e o usuário monta a amostra clicando "+ adicionar valor".
 * Espelha CAMPOS_QUIMICA/CAMPOS_FOLIAR/CAMPOS_FISICA/CAMPOS_COMPOSTO em
 * importacaoLaudo.ts no servidor.
 */
const CAMPOS_POR_TIPO: Record<TipoLaudo, string[]> = {
  QUIMICA: [
    "ph", "materiaOrganica", "fosforo", "enxofre", "calcio", "magnesio", "sodio",
    "potassio", "aluminio", "hAl", "somaBases", "ctc", "saturacaoBases", "saturacaoAluminio",
    "boro", "cobre", "ferro", "manganes", "zinco",
  ],
  FOLIAR: [
    "nitrogenio", "fosforo", "potassio", "calcio", "magnesio", "enxofre",
    "boro", "cobre", "ferro", "manganes", "zinco", "silicio",
  ],
  FISICA: [
    "argila", "silte", "areiaTotal", "areiaMuitoGrossa", "areiaGrossa", "areiaMedia",
    "areiaFina", "areiaMuitoFina", "argilaDispersaAgua", "grauFloculacao", "grauDispersao",
  ],
  MICRO: ["boro", "cobre", "ferro", "manganes", "zinco"],
  ORGANICO: [
    "materiaOrganica", "carbonoOrganico", "nitrogenio", "p2o5Total", "p2o5Ac", "p2o5Agua",
    "k2o", "calcio", "magnesio", "enxofre", "ph", "umidade", "relacaoCN",
    "boro", "cobre", "ferro", "manganes", "zinco",
  ],
};

/** Unidade de cada campo, por tipo — mesma referência do servidor (analiseLaudo.ts), para quando o valor ainda não veio na resposta (campo recém-adicionado à mão). */
const UNIDADE_POR_TIPO: Record<TipoLaudo, Record<string, string>> = {
  QUIMICA: {
    ph: "CaCl₂", materiaOrganica: "g/dm³", fosforo: "mg/dm³", enxofre: "mg/dm³",
    calcio: "mmolc/dm³", magnesio: "mmolc/dm³", sodio: "mmolc/dm³", potassio: "mmolc/dm³",
    aluminio: "mmolc/dm³", hAl: "mmolc/dm³", somaBases: "mmolc/dm³", ctc: "mmolc/dm³",
    saturacaoBases: "%", saturacaoAluminio: "%",
    boro: "mg/dm³", cobre: "mg/dm³", ferro: "mg/dm³", manganes: "mg/dm³", zinco: "mg/dm³",
  },
  MICRO: { boro: "mg/dm³", cobre: "mg/dm³", ferro: "mg/dm³", manganes: "mg/dm³", zinco: "mg/dm³" },
  FOLIAR: {
    nitrogenio: "g/kg", fosforo: "g/kg", potassio: "g/kg", calcio: "g/kg", magnesio: "g/kg",
    enxofre: "g/kg", boro: "mg/kg", cobre: "mg/kg", ferro: "mg/kg", manganes: "mg/kg",
    zinco: "mg/kg", silicio: "g/kg",
  },
  FISICA: {
    argila: "%", silte: "%", areiaTotal: "%", areiaMuitoGrossa: "%", areiaGrossa: "%",
    areiaMedia: "%", areiaFina: "%", areiaMuitoFina: "%", argilaDispersaAgua: "%",
    grauFloculacao: "%", grauDispersao: "%",
  },
  ORGANICO: {
    materiaOrganica: "%", carbonoOrganico: "%", nitrogenio: "%", p2o5Total: "%", p2o5Ac: "%",
    p2o5Agua: "%", k2o: "%", calcio: "%", magnesio: "%", enxofre: "%", boro: "%", cobre: "%",
    ferro: "%", manganes: "%", zinco: "%", umidade: "%", ph: "CaCl₂", relacaoCN: "razão",
  },
};

/** Amostra de solo sem profundidade não serve para calcular adubação depois. */
const TIPOS_QUE_PRECISAM_PROFUNDIDADE: TipoLaudo[] = ["QUIMICA", "FISICA", "MICRO"];

/** Campos calculados a partir de outros — mesma lista do servidor (analiseLaudo.ts). */
const CAMPOS_DERIVADOS_POR_TIPO: Partial<Record<TipoLaudo, string[]>> = {
  QUIMICA: ["somaBases", "ctc", "saturacaoBases", "saturacaoAluminio"],
  FISICA: ["grauFloculacao", "grauDispersao"],
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

const arred2 = (v: number) => Math.round(v * 100) / 100;

/**
 * S.B., CTC, V% e m% — mesma fórmula do servidor (analiseLaudo.ts), para
 * calcular ao vivo enquanto o usuário digita na conferência manual (PDF sem
 * planilha). Só calcula quando os valores de entrada existem; nunca chuta.
 */
function calcularDerivadosQuimica(v: Record<string, number>): Partial<Record<string, number>> {
  const saida: Partial<Record<string, number>> = {};
  if (v.calcio == null || v.magnesio == null || v.potassio == null) return saida;

  const somaBases = v.calcio + v.magnesio + v.potassio + (v.sodio ?? 0);
  saida.somaBases = arred2(somaBases);

  if (v.hAl != null) {
    const ctc = somaBases + v.hAl;
    saida.ctc = arred2(ctc);
    if (ctc !== 0) saida.saturacaoBases = arred2((somaBases / ctc) * 100);
  }
  if (v.aluminio != null) {
    const base = somaBases + v.aluminio;
    if (base !== 0) saida.saturacaoAluminio = arred2((100 * v.aluminio) / base);
  }
  return saida;
}

/**
 * Valores prontos para exibir: parte do que veio do arquivo (ou já editado),
 * e completa S.B./CTC/V%/m% que ainda faltarem calculando ao vivo. Se o
 * usuário digitar um valor nesses campos, o dele prevalece — só calcula o
 * que está vazio.
 */
function valoresParaExibir(tipo: TipoLaudo, base: Record<string, number>): Record<string, number> {
  if (tipo !== "QUIMICA") return base;
  const calculado = calcularDerivadosQuimica(base);
  const saida = { ...base };
  for (const [chave, valor] of Object.entries(calculado)) {
    if (saida[chave] == null && valor != null) saida[chave] = valor;
  }
  return saida;
}

function valoresIniciais(amostra: Amostra): Record<string, number> {
  return { ...amostra.valores };
}

/** ISO completo (ou null) -> "AAAA-MM-DD", para o valor de um input de data. */
function paraInputData(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function LinhaAmostra({
  amostra,
  laudo,
  talhoes,
  lotes,
  destino,
  valores,
  extras,
  profundidade,
  onDestino,
  onValor,
  onAdicionarCampo,
  onProfundidade,
}: {
  amostra: Amostra;
  laudo: Laudo;
  talhoes: Talhao[];
  lotes: LoteComposto[];
  destino: Destino;
  valores: Record<string, number>;
  /** Campos adicionados à mão nesta sessão (digitação manual), além dos que vieram do arquivo. */
  extras: string[];
  profundidade: string;
  onDestino: (v: Destino) => void;
  onValor: (chave: string, v: number) => void;
  onAdicionarCampo: (chave: string) => void;
  onProfundidade: (v: string) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [novoCampo, setNovoCampo] = useState("");
  // "valores" já inclui S.B./CTC/V%/m% calculados ao vivo quando ainda não
  // vieram do arquivo nem foram digitados — por isso a lista de campos vem
  // dele, não só do que o arquivo trouxe originalmente.
  const chaves = [...new Set([...Object.keys(amostra.valores), ...Object.keys(valores), ...extras])];
  const ehComposto = laudo.tipo === "ORGANICO";
  const podeAdicionar = laudo.situacao === "PENDENTE";
  const camposDisponiveis = CAMPOS_POR_TIPO[laudo.tipo].filter((c) => !chaves.includes(c));
  const precisaProfundidade = TIPOS_QUE_PRECISAM_PROFUNDIDADE.includes(laudo.tipo);

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
          {amostra.linhaOriginal && (
            <p className="mb-3 rounded-md border border-terra-200 bg-white/70 px-2 py-1.5 font-mono text-[11px] leading-snug text-terra-600">
              <span className="font-sans font-semibold uppercase tracking-wide text-terra-400">
                linha lida no PDF:{" "}
              </span>
              {amostra.linhaOriginal}
            </p>
          )}
          {precisaProfundidade && (
            <label className="mb-3 block max-w-xs">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-terra-500">
                Profundidade da coleta
                {!profundidade && (
                  <span className="text-amber-600" title="Essencial para calcular a adubação depois">
                    · obrigatória
                  </span>
                )}
              </span>
              <input
                type="text"
                placeholder="ex.: 0-20 cm"
                value={profundidade}
                disabled={laudo.situacao !== "PENDENTE"}
                onChange={(e) => onProfundidade(e.target.value)}
                className={`w-full rounded-md border px-2 py-1.5 text-sm disabled:bg-terra-100 ${
                  !profundidade ? "border-amber-300 bg-amber-50/60" : "border-terra-300"
                }`}
              />
            </label>
          )}
          {chaves.length === 0 ? (
            <p className="py-3 text-sm text-terra-500">
              Nenhum valor foi lido — adicione os campos abaixo e digite conferindo o laudo original.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 py-3 sm:grid-cols-5 lg:grid-cols-7">
              {chaves.map((c) => {
                const derivado = (CAMPOS_DERIVADOS_POR_TIPO[laudo.tipo] ?? []).includes(c);
                // Sem valor impresso no laudo -> o que aparece aqui veio do
                // cálculo (ou o usuário ainda vai digitar por cima).
                const calculado = derivado && amostra.valores[c] == null;
                const unidade = amostra.unidades[c] ?? UNIDADE_POR_TIPO[laudo.tipo][c];
                return (
                  <label key={c} className="block">
                    <span className="flex items-baseline justify-between gap-1">
                      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-terra-500">
                        {ROTULO_VALOR[c] ?? c}
                        {calculado && (
                          <span
                            className="rounded bg-mata-100 px-1 text-[8px] font-bold normal-case text-mata-700"
                            title="Calculado a partir de outros valores — confira, e edite se precisar"
                          >
                            calc.
                          </span>
                        )}
                      </span>
                      {unidade && <span className="text-[9px] text-terra-400">{unidade}</span>}
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={valores[c] ?? ""}
                      placeholder={derivado ? "digite conferindo" : undefined}
                      disabled={laudo.situacao !== "PENDENTE"}
                      onChange={(e) => onValor(c, Number(e.target.value))}
                      className={`numero w-full rounded-md border px-2 py-1 text-sm disabled:bg-terra-100 ${
                        calculado ? "border-mata-200 bg-mata-50/40" : "border-terra-300"
                      }`}
                    />
                  </label>
                );
              })}
            </div>
          )}
          {podeAdicionar && camposDisponiveis.length > 0 && (
            <div className="flex items-center gap-1.5 pb-2">
              <select
                value={novoCampo}
                onChange={(e) => setNovoCampo(e.target.value)}
                className="rounded-md border border-terra-300 px-2 py-1 text-xs"
              >
                <option value="">+ adicionar valor…</option>
                {camposDisponiveis.map((c) => (
                  <option key={c} value={c}>
                    {ROTULO_VALOR[c] ?? c}
                    {UNIDADE_POR_TIPO[laudo.tipo][c] ? ` (${UNIDADE_POR_TIPO[laudo.tipo][c]})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!novoCampo}
                onClick={() => {
                  onAdicionarCampo(novoCampo);
                  setNovoCampo("");
                }}
                className="rounded-md border border-terra-300 px-2 py-1 text-xs font-medium text-terra-600 transition hover:bg-terra-50 disabled:opacity-40"
              >
                Adicionar
              </button>
            </div>
          )}
          {laudo.tipo === "QUIMICA" && (
            <p className="mb-1 text-xs text-terra-500">
              <span className="rounded bg-mata-100 px-1 text-[8px] font-bold text-mata-700">calc.</span>{" "}
              S.B., CTC, V% e m% são calculados a partir de Ca, Mg, K, Na, Al e H+Al quando o laudo não
              os imprime — edite se o valor impresso no papel for diferente.
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
  // campos adicionados à mão na digitação manual, por amostra
  const [camposManuais, setCamposManuais] = useState<Record<string, string[]>>({});
  const [profundidades, setProfundidades] = useState<Record<string, string>>({});
  // data de coleta editada, por laudo — o sistema lê da planilha, mas o
  // usuário confere e corrige antes de confirmar (ela nunca vem certa
  // sozinha quando o laudo tem mais de uma coleta na mesma remessa).
  const [datasColeta, setDatasColeta] = useState<Record<string, string>>({});

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
    mutationFn: (laudo: Laudo) => {
      const dataColeta = datasColeta[laudo.id] ?? paraInputData(laudo.dataColeta);
      const dados = laudo.amostras.map((a) => {
        const padrao: Destino = {
          talhaoIds: a.sugestao ? [a.sugestao.talhaoId] : [],
          loteCompostoId: "",
        };
        const destino = destinos[a.id] ?? padrao;
        const profundidade = profundidades[a.id] ?? a.profundidade ?? "";
        return {
          amostraId: a.id,
          talhaoIds: destino.talhaoIds,
          loteCompostoId: destino.loteCompostoId || null,
          valores: valoresParaExibir(laudo.tipo, edicoes[a.id] ?? valoresIniciais(a)),
          profundidade: profundidade || null,
          dataColeta: dataColeta || null,
        };
      });

      // Profundidade e essencial para calcular necessidade de adubacao depois
      // - so exige quando a amostra realmente vai virar analise de talhao.
      if (TIPOS_QUE_PRECISAM_PROFUNDIDADE.includes(laudo.tipo)) {
        const semProfundidade = dados.find((d) => d.talhaoIds.length > 0 && !d.profundidade);
        if (semProfundidade) {
          const amostra = laudo.amostras.find((a) => a.id === semProfundidade.amostraId);
          throw new ApiError(
            `Falta a profundidade da coleta em "${amostra?.identificacao ?? "amostra sem identificação"}" — é essencial para calcular a adubação depois.`,
            422,
          );
        }
      }

      return api.post<{ gravadas: number; arquivadas: number }>(`/laudos/${laudo.id}/confirmar`, {
        amostras: dados,
      });
    },
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
  // Só para laudo digitado manualmente (PDF sem planilha): o sistema chuta
  // "química do solo" ao subir, e aqui o usuário corrige antes de digitar,
  // para os campos certos (foliar, física...) aparecerem na tela.
  const trocarTipo = useMutation({
    mutationFn: ({ id, tipo }: { id: string; tipo: TipoLaudo }) =>
      api.patch(`/laudos/${id}/tipo`, { tipo }),
    onSuccess: atualizar,
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Falha ao trocar o tipo"),
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
                <p className="flex flex-wrap items-center gap-x-1 text-xs text-terra-500">
                  <span>{laudo.amostras.length} amostra(s)</span>
                  {laudo.situacao === "PENDENTE" ? (
                    <span className="flex items-center gap-1">
                      <span>· coleta</span>
                      <input
                        type="date"
                        value={datasColeta[laudo.id] ?? paraInputData(laudo.dataColeta)}
                        onChange={(e) =>
                          setDatasColeta((d) => ({ ...d, [laudo.id]: e.target.value }))
                        }
                        title="Data de coleta — o sistema lê da planilha, confira e corrija se precisar"
                        className="rounded border border-terra-300 bg-white px-1 py-0.5 text-xs text-terra-700"
                      />
                    </span>
                  ) : (
                    laudo.dataColeta &&
                    ` · coleta ${new Date(laudo.dataColeta).toLocaleDateString("pt-BR")}`
                  )}
                  {laudo.cliente && <span>· {laudo.cliente}</span>}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {laudo.digitacaoManual && laudo.situacao === "PENDENTE" ? (
                <select
                  value={laudo.tipo}
                  onChange={(e) =>
                    trocarTipo.mutate({ id: laudo.id, tipo: e.target.value as TipoLaudo })
                  }
                  title="O sistema não sabe o tipo de um PDF — confira e corrija se precisar"
                  className="rounded-full border border-terra-300 bg-white px-3 py-1 text-xs font-semibold text-terra-700"
                >
                  {(Object.keys(ROTULO_TIPO) as TipoLaudo[]).map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_TIPO[t]}
                    </option>
                  ))}
                </select>
              ) : (
                <Etiqueta tom={TOM_TIPO[laudo.tipo]}>{ROTULO_TIPO[laudo.tipo]}</Etiqueta>
              )}
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

          {laudo.digitacaoManual && (() => {
            const texto = laudo.textoExtraido ?? "";
            const semOcr = texto.startsWith("PDF anexado:") || texto === "";
            const ocrFalhou = texto.startsWith("(OCR não conseguiu");
            const textoOcr = !semOcr && !ocrFalhou ? texto : null;
            return (
              <div className="border-b border-terra-100 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-800">
                <p>
                  Este arquivo é PDF. O sistema <strong>não preenche os números sozinho</strong> — o
                  texto do laudo junta valores (&quot;23,7512,21&quot; são dois números) e quebra
                  número entre linhas, e chutar aqui gravaria valor errado. Digite os valores abaixo
                  usando o &quot;+ adicionar valor&quot;, conferindo o laudo original.
                </p>
                {laudo.amostras.length > 1 && (
                  <p className="mt-1.5">
                    O sistema separou <strong>{laudo.amostras.length} amostras</strong> do PDF e já
                    preencheu código, identificação e profundidade de cada uma — confira, e digite o
                    resto olhando a linha original mostrada dentro de cada amostra.
                  </p>
                )}
                {textoOcr && (
                  <>
                    <p className="mt-1.5 font-semibold text-mata-800">
                      ✓ O texto deste PDF foi lido (OCR) — use como referência ao digitar:
                    </p>
                    <button
                      type="button"
                      onClick={() => setTextoAberto((t) => ({ ...t, [laudo.id]: !(t[laudo.id] ?? true) }))}
                      className="mt-0.5 font-semibold underline decoration-dotted"
                    >
                      {(textoAberto[laudo.id] ?? true) ? "esconder" : "mostrar"} texto lido
                    </button>
                    {(textoAberto[laudo.id] ?? true) && (
                      <pre className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2.5 font-mono text-[11px] text-terra-700">
                        {textoOcr}
                      </pre>
                    )}
                  </>
                )}
                {ocrFalhou && (
                  <p className="mt-1.5 text-red-700">
                    O OCR não conseguiu ler este arquivo específico ({texto.replace(/^\(|\)$/g, "")}) —
                    isso não afeta outros envios. Digite conferindo o PDF original.
                  </p>
                )}
                {semOcr && (
                  <p className="mt-1.5 text-terra-500">
                    Sem texto de apoio para este envio — digite conferindo o PDF original.
                  </p>
                )}
              </div>
            );
          })()}

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
                valores={valoresParaExibir(laudo.tipo, edicoes[a.id] ?? valoresIniciais(a))}
                extras={camposManuais[a.id] ?? []}
                profundidade={profundidades[a.id] ?? a.profundidade ?? ""}
                onDestino={(v) => setDestinos((d) => ({ ...d, [a.id]: v }))}
                onValor={(chave, v) =>
                  setEdicoes((e) => ({
                    ...e,
                    [a.id]: { ...(e[a.id] ?? valoresIniciais(a)), [chave]: v },
                  }))
                }
                onAdicionarCampo={(chave) =>
                  setCamposManuais((m) => ({
                    ...m,
                    [a.id]: [...new Set([...(m[a.id] ?? []), chave])],
                  }))
                }
                onProfundidade={(v) => setProfundidades((p) => ({ ...p, [a.id]: v }))}
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
