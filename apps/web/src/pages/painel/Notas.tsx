import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, CircleAlert, RotateCcw, EyeOff, Check } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { Cartao, TituloSecao, Tabela, Etiqueta, EstadoVazio, Aviso, Esqueleto } from "../../components/ui";
import type { Insumo, ItemNotaDetalhe, NotaDetalhe, NotaResumo, SituacaoNota } from "../../lib/types";

const moeda = (v: number | null | undefined) =>
  v == null ? "-" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const num = (v: number | null | undefined, casas = 3) =>
  v == null ? "-" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

/** CNPJ cru (14 digitos) fica ilegivel numa tabela. */
function formatarDocumento(d: string | null) {
  if (!d) return "-";
  const s = d.replace(/\D/g, "");
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d;
}

/**
 * A bolinha da primeira coluna: verde quando a nota e da propriedade, amarela
 * quando e de outra pessoa juridica que divide a mesma caixa de e-mail.
 *
 * Cinza quando a propriedade ainda nao tem documento cadastrado - ali nao da
 * para afirmar nada, e inventar uma cor seria pior do que admitir a duvida.
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
    qc.invalidateQueries({ queryKey: ["lotes"] });
    qc.invalidateQueries({ queryKey: ["movimentacoes"] });
  };

  const enviar = useMutation({
    mutationFn: async (arquivos: FileList) => {
      const resultados = { novas: 0, repetidas: 0, falhas: [] as string[] };
      for (const arquivo of Array.from(arquivos)) {
        try {
          const xml = await arquivo.text();
          const r = await api.post<{ jaExistia: boolean }>("/notas", { xml, nomeArquivo: arquivo.name });
          if (r.jaExistia) resultados.repetidas++;
          else resultados.novas++;
        } catch (e) {
          resultados.falhas.push(`${arquivo.name}: ${e instanceof ApiError ? e.message : "erro ao ler"}`);
        }
      }
      return resultados;
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

  const ignorar = useMutation({
    mutationFn: (id: string) => api.patch(`/notas/${id}/ignorar`),
    onSuccess: () => { setAbertaId(null); atualizar(); },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Falha"),
  });

  const reabrir = useMutation({
    mutationFn: (id: string) => api.patch(`/notas/${id}/reabrir`),
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
          <button className="inline-flex items-center gap-2 rounded-lg bg-mata-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mata-700 disabled:opacity-60" onClick={() => arquivoRef.current?.click()} disabled={enviar.isPending}>
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
        <Esqueleto />
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
              className="cursor-pointer border-t border-terra-100 hover:bg-terra-50/60"
              onClick={() => setAbertaId(abertaId === n.id ? null : n.id)}
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
                {n.situacao === "IMPORTADA" && (
                  <Etiqueta tom="mata">{n.quantidadeLotes} lote(s)</Etiqueta>
                )}
                {n.situacao === "IGNORADA" && (
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-terra-300 px-2 py-1 text-xs font-medium text-terra-600 transition hover:border-terra-400 hover:bg-terra-50"
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
        <DetalheNota
          id={abertaId}
          onFechar={() => setAbertaId(null)}
          onImportou={() => { setAbertaId(null); setRecado("Nota lançada no estoque."); atualizar(); }}
          onIgnorar={() => ignorar.mutate(abertaId)}
        />
      )}
    </div>
  );
}

/** Conferência item a item, antes de qualquer coisa tocar no estoque. */
function DetalheNota({
  id,
  onFechar,
  onImportou,
  onIgnorar,
}: {
  id: string;
  onFechar: () => void;
  onImportou: () => void;
  onIgnorar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [escolhas, setEscolhas] = useState<Record<number, { insumoId: string; fator: string }>>({});

  const { data: nota, isLoading } = useQuery({
    queryKey: ["nota", id],
    queryFn: () => api.get<NotaDetalhe>(`/notas/${id}`),
  });
  const { data: insumos } = useQuery({
    queryKey: ["insumos"],
    queryFn: () => api.get<Insumo[]>("/insumos"),
  });

  const importar = useMutation({
    mutationFn: () => {
      const itens = Object.entries(escolhas)
        .filter(([, v]) => v.insumoId)
        .map(([numeroItem, v]) => ({
          numeroItem: Number(numeroItem),
          insumoId: v.insumoId,
          fatorConversao: Number(v.fator) || 1,
          lembrarProduto: true,
        }));
      if (!itens.length) throw new ApiError("Escolha ao menos um item para lançar", 400);
      return api.post(`/notas/${id}/importar`, { itens });
    },
    onSuccess: onImportou,
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Falha ao lançar"),
  });

  if (isLoading || !nota) return <Cartao><Esqueleto /></Cartao>;

  // Item ja mapeado numa nota anterior chega preenchido; o resto fica em branco
  // esperando a decisao.
  const valorDe = (item: ItemNotaDetalhe) =>
    escolhas[item.numero] ?? {
      insumoId: item.insumoId ?? "",
      fator: String(item.fatorConversao ?? 1),
    };

  const definir = (numero: number, campo: "insumoId" | "fator", valor: string) =>
    setEscolhas((atual) => {
      const item = nota.itens.find((i) => i.numero === numero)!;
      const base = atual[numero] ?? { insumoId: item.insumoId ?? "", fator: String(item.fatorConversao ?? 1) };
      return { ...atual, [numero]: { ...base, [campo]: valor } };
    });

  const jaLancada = nota.situacao === "IMPORTADA";

  return (
    <Cartao>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">
            Nota {nota.numero}/{nota.serie} — {nota.nomeEmitente}
          </h3>
          <p className="text-sm text-terra-500">
            Emitida em {dia(nota.dataEmissao)} para {nota.nomeDestinatario ?? "?"} ({formatarDocumento(nota.documentoDestinatario)})
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg border border-terra-300 px-3 py-2 text-sm font-medium text-terra-600 transition hover:border-terra-400 hover:bg-terra-50" onClick={onFechar}>Fechar</button>
      </div>

      {nota.destinatarioEhNosso === false && (
        <Aviso tom="alerta" titulo="Esta nota não é da propriedade" icone={CircleAlert}>
          Foi emitida para <strong>{nota.nomeDestinatario}</strong>. Só lance no estoque se tiver
          certeza de que o produto veio para o sítio.
        </Aviso>
      )}

      {!nota.totalConfere && (
        <Aviso tom="perigo" titulo="A soma dos itens não bate com o total">
          {`Itens somam ${moeda(nota.somaItens)}, mas a nota declara ${moeda(nota.valorTotal)}. Confira antes de lançar.`}
        </Aviso>
      )}

      {erro && <Aviso tom="perigo" titulo="Não deu para lançar">{erro}</Aviso>}

      <div className="mt-4">
        <Tabela cabecalho={["Item da nota", "Qtd.", "Custo/un", "Vira no estoque", "Fator", "Entra"]}>
          {nota.itens.map((item) => {
            const v = valorDe(item);
            const fator = Number(v.fator) || 0;
            const insumo = insumos?.find((i) => i.id === v.insumoId);
            return (
              <tr key={item.numero} className="border-t border-terra-100 align-top">
                <td className="px-3 py-2">
                  <div className="font-medium">{item.descricao}</div>
                  <div className="text-xs text-terra-500">cód. {item.codigo}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{num(item.quantidade)} {item.unidade}</td>
                <td className="px-3 py-2 whitespace-nowrap">{moeda(item.custoUnitarioReal)}</td>
                <td className="px-3 py-2">
                  <select
                    className="w-full min-w-44 rounded-md border border-terra-300 px-2 py-1.5 text-sm focus:border-mata-500 focus:outline-none"
                    value={v.insumoId}
                    disabled={jaLancada}
                    onChange={(e) => definir(item.numero, "insumoId", e.target.value)}
                  >
                    <option value="">— não lançar —</option>
                    {insumos?.map((i) => (
                      <option key={i.id} value={i.id}>{i.nome} ({i.unidadeMedida})</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-20 rounded-md border border-terra-300 px-2 py-1.5 text-sm focus:border-mata-500 focus:outline-none"
                    type="number"
                    min="0"
                    step="any"
                    value={v.fator}
                    disabled={jaLancada || !v.insumoId}
                    onChange={(e) => definir(item.numero, "fator", e.target.value)}
                  />
                  <div className="mt-1 text-xs text-terra-500">
                    {insumo ? `${item.unidade} → ${insumo.unidadeMedida}` : "por embalagem"}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {v.insumoId && fator > 0 ? (
                    <>
                      <div className="font-semibold">
                        {num(item.quantidade * fator)} {insumo?.unidadeMedida ?? ""}
                      </div>
                      <div className="text-xs text-terra-500">
                        {moeda(item.custoUnitarioReal / fator)} / {insumo?.unidadeMedida ?? "un"}
                      </div>
                    </>
                  ) : (
                    <span className="text-terra-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </Tabela>
      </div>

      <p className="mt-3 text-xs text-terra-500">
        O <strong>fator</strong> é quanto vem em cada embalagem da nota. Um balde de 20 litros: fator 20.
        Ele fica guardado, e a próxima nota deste fornecedor já vem convertida.
      </p>

      {!jaLancada && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg bg-mata-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mata-700 disabled:opacity-60" onClick={() => importar.mutate()} disabled={importar.isPending}>
            <Check className="h-4 w-4" />
            {importar.isPending ? "Lançando..." : "Lançar no estoque"}
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-terra-300 px-3 py-2 text-sm font-medium text-terra-600 transition hover:border-terra-400 hover:bg-terra-50" onClick={onIgnorar}>
            <EyeOff className="h-4 w-4" /> Ignorar esta nota
          </button>
        </div>
      )}
    </Cartao>
  );
}
