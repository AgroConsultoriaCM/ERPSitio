import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, CircleAlert, RotateCcw, EyeOff, Check, X, Sparkles } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { Cartao, TituloSecao, Tabela, Etiqueta, EstadoVazio, Aviso, Esqueleto } from "../../components/ui";
import { ROTULO_FUNCAO_INSUMO } from "../../lib/types";
import type {
  FuncaoInsumo,
  Insumo,
  ItemNotaDetalhe,
  NotaDetalhe,
  NotaResumo,
  SituacaoNota,
} from "../../lib/types";

const moeda = (v: number | null | undefined) =>
  v == null ? "-" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const num = (v: number | null | undefined, casas = 3) =>
  v == null ? "-" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

const FUNCOES = Object.keys(ROTULO_FUNCAO_INSUMO) as FuncaoInsumo[];

/** CNPJ cru fica ilegível numa tabela. */
function formatarDocumento(d: string | null) {
  if (!d) return "-";
  const s = d.replace(/\D/g, "");
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d;
}

/**
 * Verde quando a nota é da propriedade, amarela quando é de outra pessoa
 * jurídica que divide a mesma caixa de e-mail. Cinza quando a propriedade
 * ainda não tem documento cadastrado — ali não dá para afirmar nada.
 */
function Bolinha({ nosso, titulo }: { nosso: boolean | null; titulo: string }) {
  const cor = nosso === true ? "bg-emerald-500" : nosso === false ? "bg-amber-400" : "bg-terra-300";
  return (
    <span className="inline-flex items-center" title={titulo}>
      <span className={`h-3 w-3 shrink-0 rounded-full ${cor}`} />
    </span>
  );
}

const ABAS: { id: SituacaoNota; rotulo: string }[] = [
  { id: "PENDENTE", rotulo: "Pendentes" },
  { id: "IMPORTADA", rotulo: "Lançadas" },
  { id: "IGNORADA", rotulo: "Ignoradas" },
];

export default function Notas() {
  const qc = useQueryClient();
  const [aba, setAba] = useState<SituacaoNota>("PENDENTE");
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const { data: notas, isLoading } = useQuery({
    queryKey: ["notas", aba],
    queryFn: () => api.get<NotaResumo[]>(`/notas?situacao=${aba}`),
  });

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["notas"] });
    qc.invalidateQueries({ queryKey: ["insumos"] });
    qc.invalidateQueries({ queryKey: ["lotes"] });
    qc.invalidateQueries({ queryKey: ["movimentacoes"] });
  };

  const enviar = useMutation({
    mutationFn: async (arquivos: FileList) => {
      const r = { novas: 0, repetidas: 0, falhas: [] as string[] };
      for (const arquivo of Array.from(arquivos)) {
        try {
          const xml = await arquivo.text();
          const resp = await api.post<{ jaExistia: boolean }>("/notas", { xml, nomeArquivo: arquivo.name });
          if (resp.jaExistia) r.repetidas++;
          else r.novas++;
        } catch (e) {
          r.falhas.push(`${arquivo.name}: ${e instanceof ApiError ? e.message : "erro ao ler"}`);
        }
      }
      return r;
    },
    onSuccess: (r) => {
      const partes: string[] = [];
      if (r.novas) partes.push(`${r.novas} nota(s) recebida(s)`);
      if (r.repetidas) partes.push(`${r.repetidas} já estava(m) no sistema`);
      setRecado(partes.join(", ") || "Nenhuma nota nova.");
      setErro(r.falhas.length ? r.falhas.join(" | ") : null);
      atualizar();
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Falha ao enviar"),
  });

  const reabrir = useMutation({
    mutationFn: (id: string) => api.patch(`/notas/${id}/reabrir`, {}),
    onSuccess: atualizar,
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Falha"),
  });

  const semDocumento = notas?.some((n) => n.destinatarioEhNosso === null) ?? false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <TituloSecao descricao="As notas chegam aqui e ficam esperando. Nada entra no estoque sem você confirmar.">
          Notas fiscais de entrada
        </TituloSecao>
        <div>
          <input
            ref={arquivoRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) enviar.mutate(e.target.files); e.target.value = ""; }}
          />
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-mata-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mata-700 disabled:opacity-60"
            onClick={() => arquivoRef.current?.click()}
            disabled={enviar.isPending}
          >
            <Upload className="h-4 w-4" />
            {enviar.isPending ? "Lendo..." : "Anexar XML"}
          </button>
        </div>
      </div>

      {recado && <Aviso tom="mata" titulo={recado} />}
      {erro && <Aviso tom="perigo" titulo="Não consegui ler tudo">{erro}</Aviso>}

      {semDocumento && (
        <Aviso tom="alerta" titulo="Falta o CNPJ da propriedade">
          Sem ele não dá para dizer quais notas são do sítio. Preencha em{" "}
          <strong>Cadastros → Propriedade</strong> e as bolinhas passam a funcionar.
        </Aviso>
      )}

      <div className="flex gap-2">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => { setAba(a.id); setAbertaId(null); }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              aba === a.id ? "bg-mata-600 text-white" : "bg-terra-100 text-terra-600 hover:bg-terra-200"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Esqueleto className="h-40 w-full" />
      ) : !notas?.length ? (
        <EstadoVazio
          titulo="Nenhuma nota aqui"
          descricao={
            aba === "PENDENTE"
              ? "Quando um XML chegar, ele aparece nesta lista esperando sua decisão."
              : "Nada nesta situação."
          }
        />
      ) : (
        <Tabela cabecalho={["", "Emissão", "Nota", "Fornecedor", "Emitida para", "Valor", ""]}>
          {notas.map((n) => (
            <tr
              key={n.id}
              className="cursor-pointer border-t border-terra-100 transition hover:bg-terra-50/60"
              onClick={() => setAbertaId(n.id)}
            >
              <td className="px-3 py-2">
                <Bolinha
                  nosso={n.destinatarioEhNosso}
                  titulo={
                    n.destinatarioEhNosso === true
                      ? "Emitida para a propriedade"
                      : n.destinatarioEhNosso === false
                        ? `Emitida para outra empresa: ${n.nomeDestinatario ?? "?"}`
                        : "Sem CNPJ da propriedade cadastrado para comparar"
                  }
                />
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{dia(n.dataEmissao)}</td>
              <td className="px-3 py-2 whitespace-nowrap font-medium">{n.numero}/{n.serie}</td>
              <td className="px-3 py-2">
                <div className="font-medium">{n.nomeEmitente}</div>
                <div className="text-xs text-terra-500">{formatarDocumento(n.cnpjEmitente)}</div>
              </td>
              <td className="px-3 py-2">
                <div>{n.nomeDestinatario ?? "-"}</div>
                <div className="text-xs text-terra-500">{formatarDocumento(n.documentoDestinatario)}</div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap font-semibold">{moeda(n.valorTotal)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {n.situacao === "IMPORTADA" && <Etiqueta tom="mata">{n.quantidadeLotes} lote(s)</Etiqueta>}
                {n.situacao === "IGNORADA" && (
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-terra-300 px-2 py-1 text-xs font-medium text-terra-600 transition hover:bg-terra-50"
                    onClick={(e) => { e.stopPropagation(); reabrir.mutate(n.id); }}
                  >
                    <RotateCcw className="h-3 w-3" /> Reabrir
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Tabela>
      )}

      {abertaId && (
        <JanelaNota
          id={abertaId}
          onFechar={() => setAbertaId(null)}
          onConcluir={(msg) => { setAbertaId(null); setRecado(msg); atualizar(); }}
        />
      )}
    </div>
  );
}

interface Escolha {
  lancar: boolean;
  insumoId: string;
  nome: string;
  unidade: string;
  funcoes: FuncaoInsumo[];
  fator: string;
}

/** Conferência item a item, numa janela sobre a lista. */
function JanelaNota({
  id,
  onFechar,
  onConcluir,
}: {
  id: string;
  onFechar: () => void;
  onConcluir: (mensagem: string) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [escolhas, setEscolhas] = useState<Record<number, Escolha>>({});

  const { data: nota, isLoading } = useQuery({
    queryKey: ["nota", id],
    queryFn: () => api.get<NotaDetalhe>(`/notas/${id}`),
  });
  const { data: insumos } = useQuery({
    queryKey: ["insumos"],
    queryFn: () => api.get<Insumo[]>("/insumos"),
  });

  // Esc fecha, como qualquer janela. E o fundo da página não rola atrás.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", aoTeclar);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = antes;
    };
  }, [onFechar]);

  // Chega tudo preenchido: o que o sistema já sabe, ou o que leu da descrição.
  useEffect(() => {
    if (!nota) return;
    const inicial: Record<number, Escolha> = {};
    for (const i of nota.itens) {
      inicial[i.numero] = {
        lancar: true,
        insumoId: i.insumoId ?? "",
        nome: i.nomeSugerido,
        unidade: i.insumoUnidade ?? "L",
        funcoes: [],
        fator: i.fatorConversao != null ? String(i.fatorConversao) : "",
      };
    }
    setEscolhas(inicial);
  }, [nota]);

  const importar = useMutation({
    mutationFn: () => {
      const itens = Object.entries(escolhas)
        .filter(([, v]) => v.lancar)
        .map(([numeroItem, v]) => ({
          numeroItem: Number(numeroItem),
          ...(v.insumoId
            ? { insumoId: v.insumoId }
            : { nomeNovoProduto: v.nome, unidadeNovoProduto: v.unidade, funcoesNovoProduto: v.funcoes }),
          fatorConversao: Number(v.fator) || 1,
          lembrarProduto: true,
        }));
      if (!itens.length) throw new ApiError("Marque ao menos um item para lançar", 400);
      const semNome = itens.find((i) => "nomeNovoProduto" in i && !i.nomeNovoProduto);
      if (semNome) throw new ApiError("Dê um nome ao produto novo", 400);
      return api.post<{ lotesCriados: number }>(`/notas/${id}/importar`, { itens });
    },
    onSuccess: (r) => onConcluir(`Nota lançada: ${r.lotesCriados} produto(s) no estoque.`),
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Falha ao lançar"),
  });

  const ignorar = useMutation({
    mutationFn: () => api.patch(`/notas/${id}/ignorar`, {}),
    onSuccess: () => onConcluir("Nota ignorada."),
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Falha"),
  });

  const definir = (numero: number, mudanca: Partial<Escolha>) =>
    setEscolhas((a) => ({ ...a, [numero]: { ...a[numero], ...mudanca } }));

  const jaLancada = nota?.situacao === "IMPORTADA";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-terra-900/50 p-4 backdrop-blur-sm sm:p-8"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {isLoading || !nota ? (
          <div className="p-8"><Esqueleto className="h-40 w-full" /></div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-terra-200 p-5">
              <div>
                <h3 className="text-lg font-semibold">
                  Nota {nota.numero}/{nota.serie} — {nota.nomeEmitente}
                </h3>
                <p className="text-sm text-terra-500">
                  Emitida em {dia(nota.dataEmissao)} para {nota.nomeDestinatario ?? "?"}{" "}
                  ({formatarDocumento(nota.documentoDestinatario)})
                </p>
              </div>
              <button
                onClick={onFechar}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-terra-300 text-terra-600 transition hover:bg-terra-50"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {nota.destinatarioEhNosso === false && (
                <Aviso tom="alerta" titulo="Esta nota não é da propriedade" icone={CircleAlert}>
                  Foi emitida para <strong>{nota.nomeDestinatario}</strong>. Só lance no estoque se
                  tiver certeza de que o produto veio para o sítio.
                </Aviso>
              )}
              {!nota.totalConfere && (
                <Aviso tom="perigo" titulo="A soma dos itens não bate com o total">
                  {`Itens somam ${moeda(nota.somaItens)}, mas a nota declara ${moeda(nota.valorTotal)}.`}
                </Aviso>
              )}
              {erro && <Aviso tom="perigo" titulo="Não deu para lançar">{erro}</Aviso>}

              <Tabela cabecalho={["", "Item da nota", "Qtd.", "Custo/un", "Produto no estoque", "Função", "Embalagem", "Entra no estoque"]}>
                {nota.itens.map((item) => (
                  <LinhaItem
                    key={item.numero}
                    item={item}
                    escolha={escolhas[item.numero]}
                    insumos={insumos ?? []}
                    bloqueado={jaLancada}
                    onMudar={(m) => definir(item.numero, m)}
                  />
                ))}
              </Tabela>

              <p className="text-xs text-terra-500">
                A <strong>embalagem</strong> é quanto vem em cada unidade da nota — um balde de 20
                litros: 20. Quando dá para ler isso na descrição, já vem preenchido com o trecho de
                onde saiu. Fica guardado, e a próxima nota deste fornecedor já vem convertida.
              </p>
            </div>

            {!jaLancada && (
              <div className="flex flex-wrap gap-2 border-t border-terra-200 p-5">
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-mata-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mata-700 disabled:opacity-60"
                  onClick={() => importar.mutate()}
                  disabled={importar.isPending}
                >
                  <Check className="h-4 w-4" />
                  {importar.isPending ? "Lançando..." : "Lançar no estoque"}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-terra-300 px-3 py-2 text-sm font-medium text-terra-600 transition hover:bg-terra-50"
                  onClick={() => ignorar.mutate()}
                >
                  <EyeOff className="h-4 w-4" /> Ignorar esta nota
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LinhaItem({
  item,
  escolha,
  insumos,
  bloqueado,
  onMudar,
}: {
  item: ItemNotaDetalhe;
  escolha?: Escolha;
  insumos: Insumo[];
  bloqueado: boolean;
  onMudar: (m: Partial<Escolha>) => void;
}) {
  if (!escolha) return null;
  const fator = Number(escolha.fator) || 0;
  const existente = insumos.find((i) => i.id === escolha.insumoId);
  const unidade = existente?.unidadeMedida ?? escolha.unidade;
  const campo =
    "w-full rounded-md border border-terra-300 px-2 py-1.5 text-sm focus:border-mata-500 focus:outline-none disabled:bg-terra-50";

  return (
    // Produto já conhecido ganha fundo e faixa: dá para varrer a tabela e ver
    // de relance o que exige decisão e o que já está resolvido.
    <tr className={`border-t border-terra-100 align-top ${item.jaConhecido ? "bg-mata-50/50" : ""}`}>
      <td className="px-2 py-2">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-mata-600"
          checked={escolha.lancar}
          disabled={bloqueado}
          onChange={(e) => onMudar({ lancar: e.target.checked })}
          aria-label="Lançar este item"
        />
      </td>

      <td className="px-3 py-2">
        <div className="font-medium">{item.descricao}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-terra-500">
          <span className="rounded bg-terra-100 px-1.5 py-0.5 font-mono">cód. {item.codigo}</span>
          {item.jaConhecido && <Etiqueta tom="mata">já cadastrado</Etiqueta>}
        </div>
      </td>

      <td className="px-3 py-2 whitespace-nowrap">{num(item.quantidade)} {item.unidade}</td>
      <td className="px-3 py-2 whitespace-nowrap">{moeda(item.custoUnitarioReal)}</td>

      <td className="px-3 py-2 min-w-52">
        {item.jaConhecido ? (
          <div className="font-medium text-mata-800">{item.insumoNome}</div>
        ) : (
          <>
            <input
              className={campo}
              value={escolha.nome}
              disabled={bloqueado || !escolha.lancar}
              onChange={(e) => onMudar({ nome: e.target.value, insumoId: "" })}
              placeholder="Nome do produto"
            />
            <select
              className={`${campo} mt-1 text-xs`}
              value={escolha.insumoId}
              disabled={bloqueado || !escolha.lancar}
              onChange={(e) => onMudar({ insumoId: e.target.value })}
            >
              <option value="">criar produto novo</option>
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>ou usar: {i.nome} ({i.unidadeMedida})</option>
              ))}
            </select>
          </>
        )}
      </td>

      <td className="px-3 py-2 min-w-44">
        {item.jaConhecido || escolha.insumoId ? (
          <span className="text-xs text-terra-500">definida no produto</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {FUNCOES.map((f) => {
              const marcada = escolha.funcoes.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  disabled={bloqueado || !escolha.lancar}
                  onClick={() =>
                    onMudar({
                      funcoes: marcada
                        ? escolha.funcoes.filter((x) => x !== f)
                        : [...escolha.funcoes, f],
                    })
                  }
                  className={`rounded-full border px-2 py-0.5 text-xs transition ${
                    marcada
                      ? "border-mata-500 bg-mata-600 text-white"
                      : "border-terra-300 text-terra-600 hover:bg-terra-50"
                  }`}
                >
                  {ROTULO_FUNCAO_INSUMO[f]}
                </button>
              );
            })}
          </div>
        )}
      </td>

      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            className="w-20 rounded-md border border-terra-300 px-2 py-1.5 text-sm focus:border-mata-500 focus:outline-none disabled:bg-terra-50"
            type="number"
            min="0"
            step="any"
            value={escolha.fator}
            disabled={bloqueado || !escolha.lancar}
            onChange={(e) => onMudar({ fator: e.target.value })}
          />
          <span className="text-xs text-terra-500">{unidade}</span>
        </div>
        {item.trechoEmbalagem && (
          <div className="mt-1 flex items-center gap-1 text-xs text-mata-700" title="Lido da descrição da nota">
            <Sparkles className="h-3 w-3" />
            {item.trechoEmbalagem}
          </div>
        )}
      </td>

      <td className="px-3 py-2 whitespace-nowrap">
        {escolha.lancar && fator > 0 ? (
          <>
            <div className="font-semibold">{num(item.quantidade * fator)} {unidade}</div>
            <div className="text-xs text-terra-500">
              {moeda(item.custoUnitarioReal / fator)} / {unidade}
            </div>
          </>
        ) : (
          <span className="text-terra-400">—</span>
        )}
      </td>
    </tr>
  );
}
