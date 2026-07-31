import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, X, History } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { ROTULO_FUNCAO_INSUMO } from "../../lib/types";
import type { FuncaoInsumo, Insumo } from "../../lib/types";
import { Cartao, TituloSecao, Tabela, Etiqueta, Aviso, EstadoVazio, Esqueleto } from "../../components/ui";

const CATEGORIAS = ["DEFENSIVO", "FERTILIZANTE", "EMBALAGEM", "OUTRO"] as const;
const FUNCOES = Object.keys(ROTULO_FUNCAO_INSUMO) as FuncaoInsumo[];

const moeda = (v: number | null | undefined) =>
  v == null ? "—" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: number | null | undefined, casas = 3) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

const CAMPO =
  "w-full rounded-md border border-terra-300 px-2 py-1.5 text-sm focus:border-mata-500 focus:outline-none";

interface Formulario {
  id: string | null;
  nome: string;
  categoria: (typeof CATEGORIAS)[number];
  funcoes: FuncaoInsumo[];
  unidadeMedida: string;
  estoqueMinimo: string;
  dosePor100L: string;
  dosePorHectare: string;
  observacoesDose: string;
  fabricante: string;
}

const VAZIO: Formulario = {
  id: null,
  nome: "",
  categoria: "DEFENSIVO",
  funcoes: [],
  unidadeMedida: "L",
  estoqueMinimo: "",
  dosePor100L: "",
  dosePorHectare: "",
  observacoesDose: "",
  fabricante: "",
};

export default function Produtos() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Formulario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [historicoDe, setHistoricoDe] = useState<string | null>(null);

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["insumos"],
    queryFn: () => api.get<Insumo[]>("/insumos"),
  });

  const salvar = useMutation({
    mutationFn: (f: Formulario) => {
      const corpo = {
        nome: f.nome,
        categoria: f.categoria,
        funcoes: f.funcoes,
        unidadeMedida: f.unidadeMedida,
        estoqueMinimo: f.estoqueMinimo ? Number(f.estoqueMinimo) : null,
        dosePor100L: f.dosePor100L ? Number(f.dosePor100L) : null,
        dosePorHectare: f.dosePorHectare ? Number(f.dosePorHectare) : null,
        observacoesDose: f.observacoesDose || null,
        fabricante: f.fabricante || null,
      };
      return f.id ? api.patch(`/insumos/${f.id}`, corpo) : api.post("/insumos", corpo);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insumos"] });
      setForm(null);
      setErro(null);
    },
    onError: (e) => setErro(e instanceof ApiError ? e.message : "Não consegui salvar"),
  });

  function editar(p: Insumo) {
    setForm({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      funcoes: p.funcoes ?? [],
      unidadeMedida: p.unidadeMedida,
      estoqueMinimo: p.estoqueMinimo != null ? String(p.estoqueMinimo) : "",
      dosePor100L: p.dosePor100L != null ? String(p.dosePor100L) : "",
      dosePorHectare: p.dosePorHectare != null ? String(p.dosePorHectare) : "",
      observacoesDose: p.observacoesDose ?? "",
      fabricante: p.fabricante ?? "",
    });
    setErro(null);
  }

  // Unidade do produto manda na unidade da dose: produto em litros mede a dose
  // em mL; em quilos, em gramas. Campo de unidade separado sairia de sincronia.
  const unidadeDose = (u: string) => (u.toLowerCase().startsWith("k") || u.toLowerCase() === "g" ? "g" : "mL");
  const unidadeArea = (u: string) => (u.toLowerCase().startsWith("k") || u.toLowerCase() === "g" ? "kg" : "L");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <TituloSecao descricao="Produtos do estoque, com o que você pagou por eles e a dose de bula.">
          Produtos
        </TituloSecao>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-mata-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mata-700"
          onClick={() => { setForm({ ...VAZIO }); setErro(null); }}
        >
          <Plus className="h-4 w-4" /> Novo produto
        </button>
      </div>

      {erro && <Aviso tom="perigo" titulo="Não consegui salvar">{erro}</Aviso>}

      {form && (
        <Cartao>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{form.id ? "Editar produto" : "Novo produto"}</h3>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-terra-300 text-terra-600 transition hover:bg-terra-50"
              onClick={() => setForm(null)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="sm:col-span-2">
              <span className="rotulo">Nome</span>
              <input className={CAMPO} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </label>
            <label>
              <span className="rotulo">Fabricante</span>
              <input className={CAMPO} value={form.fabricante} onChange={(e) => setForm({ ...form, fabricante: e.target.value })} />
            </label>
            <label>
              <span className="rotulo">Categoria</span>
              <select
                className={CAMPO}
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value as Formulario["categoria"] })}
              >
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label>
              <span className="rotulo">Unidade no estoque</span>
              <select
                className={CAMPO}
                value={form.unidadeMedida}
                onChange={(e) => setForm({ ...form, unidadeMedida: e.target.value })}
              >
                <option value="L">litro (L)</option>
                <option value="kg">quilo (kg)</option>
                <option value="un">unidade</option>
              </select>
              <span className="mt-1 block text-xs text-terra-500">
                Litro ou quilo permite lançar a sobra do galão de volta.
              </span>
            </label>
            <label>
              <span className="rotulo">Estoque mínimo</span>
              <input className={CAMPO} type="number" step="any" value={form.estoqueMinimo}
                onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })} />
            </label>
            <label>
              <span className="rotulo">Dose por 100 L de calda ({unidadeDose(form.unidadeMedida)})</span>
              <input className={CAMPO} type="number" step="any" value={form.dosePor100L}
                onChange={(e) => setForm({ ...form, dosePor100L: e.target.value })} />
            </label>
            <label>
              <span className="rotulo">Dose por hectare ({unidadeArea(form.unidadeMedida)})</span>
              <input className={CAMPO} type="number" step="any" value={form.dosePorHectare}
                onChange={(e) => setForm({ ...form, dosePorHectare: e.target.value })} />
            </label>

            <div className="sm:col-span-2 lg:col-span-4">
              <span className="rotulo">Funções</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {FUNCOES.map((f) => {
                  const marcada = form.funcoes.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          funcoes: marcada ? form.funcoes.filter((x) => x !== f) : [...form.funcoes, f],
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        marcada ? "border-mata-500 bg-mata-600 text-white" : "border-terra-300 text-terra-600 hover:bg-terra-50"
                      }`}
                    >
                      {ROTULO_FUNCAO_INSUMO[f]}
                    </button>
                  );
                })}
              </div>
              <span className="mt-1 block text-xs text-terra-500">
                Pode marcar mais de uma. Uma aplicação conta para todas as funções do produto.
              </span>
            </div>

            <label className="sm:col-span-2 lg:col-span-4">
              <span className="rotulo">Observações da dose</span>
              <input className={CAMPO} value={form.observacoesDose}
                placeholder="Ex.: intervalo de 21 dias, não aplicar em floração"
                onChange={(e) => setForm({ ...form, observacoesDose: e.target.value })} />
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-mata-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mata-700 disabled:opacity-60"
              onClick={() => salvar.mutate(form)}
              disabled={salvar.isPending || !form.nome}
            >
              {salvar.isPending ? "Salvando..." : "Salvar"}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-terra-300 px-3 py-2 text-sm font-medium text-terra-600 transition hover:bg-terra-50"
              onClick={() => setForm(null)}
            >
              Cancelar
            </button>
          </div>
        </Cartao>
      )}

      {isLoading ? (
        <Esqueleto className="h-40 w-full" />
      ) : !produtos?.length ? (
        <EstadoVazio
          titulo="Nenhum produto ainda"
          descricao="Eles aparecem sozinhos quando você lança uma nota fiscal, ou você cadastra à mão aqui."
        />
      ) : (
        <Tabela cabecalho={["Produto", "Funções", "Saldo", "Preço médio", "Última compra", "Dose", ""]}>
          {produtos.map((p) => (
            <>
              <tr key={p.id} className="border-t border-terra-100 align-top">
                <td className="px-3 py-2">
                  <div className="font-medium">{p.nome}</div>
                  <div className="text-xs text-terra-500">
                    {p.fabricante ? `${p.fabricante} · ` : ""}{p.categoria.toLowerCase()}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {p.funcoes?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {p.funcoes.map((f) => <Etiqueta key={f} tom="agua">{ROTULO_FUNCAO_INSUMO[f]}</Etiqueta>)}
                    </div>
                  ) : (
                    <span className="text-terra-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap font-semibold">
                  {num(p.saldoAtual)} {p.unidadeMedida}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {p.precoMedio != null ? (
                    <>
                      <div className="font-medium">{moeda(p.precoMedio)}</div>
                      <div className="text-xs text-terra-500">por {p.unidadeMedida}</div>
                    </>
                  ) : (
                    <span className="text-terra-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {p.ultimasCompras?.length ? (
                    <>
                      <div>{moeda(p.ultimasCompras[0].precoUnitario)}</div>
                      <div className="text-xs text-terra-500">{dia(p.ultimasCompras[0].data)}</div>
                    </>
                  ) : (
                    <span className="text-terra-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.dosePor100L != null && (
                    <div>{num(p.dosePor100L)} {unidadeDose(p.unidadeMedida)}/100 L</div>
                  )}
                  {p.dosePorHectare != null && (
                    <div>{num(p.dosePorHectare)} {unidadeArea(p.unidadeMedida)}/ha</div>
                  )}
                  {p.dosePor100L == null && p.dosePorHectare == null && (
                    <span className="text-terra-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex gap-1">
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-terra-300 text-terra-600 transition hover:bg-terra-50"
                      onClick={() => editar(p)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {(p.ultimasCompras?.length ?? 0) > 0 && (
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-terra-300 text-terra-600 transition hover:bg-terra-50"
                        onClick={() => setHistoricoDe(historicoDe === p.id ? null : p.id)}
                        title="Histórico de preços"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>

              {historicoDe === p.id && (
                <tr className="border-t border-terra-100 bg-terra-50/60">
                  <td colSpan={7} className="px-3 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-terra-500">
                      Últimas compras — total comprado: {num(p.totalComprado)} {p.unidadeMedida}
                    </p>
                    <div className="space-y-1 text-sm">
                      {p.ultimasCompras?.map((c, i) => (
                        <div key={i} className="flex flex-wrap gap-x-4 gap-y-0.5">
                          <span className="w-24 text-terra-500">{dia(c.data)}</span>
                          <span className="w-28 font-medium">{moeda(c.precoUnitario)}/{p.unidadeMedida}</span>
                          <span className="w-28">{num(c.quantidade)} {p.unidadeMedida}</span>
                          <span className="text-terra-500">
                            {c.fornecedor ?? "—"}{c.numeroNota ? ` · NF ${c.numeroNota}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </Tabela>
      )}
    </div>
  );
}
