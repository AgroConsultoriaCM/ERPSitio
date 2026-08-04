import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bug,
  ChartColumn,
  Citrus,
  ClipboardList,
  CloudOff,
  Droplets,
  Map,
  Package,
  Plus,
  Sprout,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { ROTULO_FUNCAO_INSUMO } from "../../lib/types";
import type {
  AlertaPraga,
  Atividade,
  AtividadePlanejada,
  Colheita,
  Insumo,
  Propriedade,
  RegistroPulverizacao,
  ResumoColheitaTalhao,
  RespostaClima,
  SetorIrrigacao,
  SituacaoSetor,
  Talhao,
} from "../../lib/types";
import GraficoColheita from "../../components/GraficoColheita";
import MapaPropriedade, { type SelecaoMapa } from "../../components/MapaPropriedade";
import PainelClima from "../../components/PainelClima";
import PainelResumoMapa from "../../components/PainelResumoMapa";
import {
  Aviso,
  Cartao,
  EstadoVazio,
  EsqueletoIndicador,
  Etiqueta,
  Indicador,
  Tabela,
  TituloSecao,
  moeda,
  numero,
} from "../../components/ui";

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Dashboard() {
  const { usuario } = useAuth();

  const { data: propriedade } = useQuery({
    queryKey: ["propriedade"],
    queryFn: () => api.get<Propriedade>("/propriedades/me"),
  });
  const { data: talhoes } = useQuery({
    queryKey: ["talhoes"],
    queryFn: () => api.get<Talhao[]>("/talhoes"),
  });
  const { data: atividades } = useQuery({
    queryKey: ["atividades-recentes"],
    queryFn: () => api.get<Atividade[]>("/atividades"),
  });
  const { data: colheitas, isLoading: carregandoColheitas } = useQuery({
    queryKey: ["colheitas-recentes"],
    queryFn: () => api.get<Colheita[]>("/colheitas"),
  });
  const { data: resumo } = useQuery({
    queryKey: ["colheitas-resumo"],
    queryFn: () => api.get<ResumoColheitaTalhao[]>("/colheitas/resumo"),
  });
  const { data: insumos } = useQuery({
    queryKey: ["insumos"],
    queryFn: () => api.get<Insumo[]>("/insumos"),
  });
  const { data: alertas } = useQuery({
    queryKey: ["pragas-alertas"],
    queryFn: () => api.get<AlertaPraga[]>("/pragas/alertas"),
  });
  const { data: setores } = useQuery({
    queryKey: ["irrigacao-situacao"],
    queryFn: () => api.get<SituacaoSetor[]>("/irrigacoes/situacao"),
  });
  const { data: setoresIrrigacao } = useQuery({
    queryKey: ["setores-irrigacao"],
    queryFn: () => api.get<SetorIrrigacao[]>("/setores-irrigacao"),
  });
  const { data: atividadesPlanejadas } = useQuery({
    queryKey: ["atividades-planejadas"],
    queryFn: () => api.get<AtividadePlanejada[]>("/atividades-planejadas"),
  });
  const { data: pulverizacoes } = useQuery({
    queryKey: ["pulverizacoes"],
    queryFn: () => api.get<RegistroPulverizacao[]>("/pulverizacoes"),
  });

  const [selecaoMapa, setSelecaoMapa] = useState<SelecaoMapa>(null);
  const [camadaTalhoes, setCamadaTalhoes] = useState(true);
  const [camadaSetores, setCamadaSetores] = useState(true);
  // O clima depende de coordenada cadastrada; falha dele não pode derrubar
  // o resto do painel, por isso fica isolado num bloco condicional.
  const clima = useQuery({
    queryKey: ["clima"],
    queryFn: () => api.get<RespostaClima>("/clima"),
    retry: false,
    staleTime: 30 * 60 * 1000,
  });

  const setoresAtrasados = setores?.filter((s) => (s.diasDesdeUltima ?? 999) > 7) ?? [];
  const insumosBaixos =
    insumos?.filter((i) => i.estoqueMinimo != null && (i.saldoAtual ?? 0) < i.estoqueMinimo) ?? [];

  const areaTotal = talhoes?.reduce((s, t) => s + (t.areaHa ?? 0), 0) ?? 0;
  const caixasTotal = resumo?.reduce((s, r) => s + r.caixas, 0) ?? 0;
  const custoColheita = resumo?.reduce((s, r) => s + r.custoColheita, 0) ?? 0;
  const custoOperacoes = atividades?.reduce((s, a) => s + (a.custoMaoDeObra ?? 0), 0) ?? 0;
  const receita = resumo?.reduce((s, r) => s + r.receita, 0) ?? 0;
  const custoTotal = custoColheita + custoOperacoes;
  const margem = receita - custoTotal;

  const hoje = new Date().toISOString().slice(0, 10);
  const caixasHoje =
    colheitas?.filter((c) => c.data.slice(0, 10) === hoje).reduce((s, c) => s + c.quantidadeCaixas, 0) ??
    0;

  const custoPorCaixa = caixasTotal > 0 ? custoTotal / caixasTotal : null;
  const semLancamento = caixasTotal === 0 && (atividades?.length ?? 0) === 0;
  const temAlerta = alertas?.length || setoresAtrasados.length || insumosBaixos.length;

  return (
    <div className="escalonar space-y-4">
      {/* Cabeçalho com faixa de marca: dá âncora visual ao topo da página sem
          ocupar altura de conteúdo. */}
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-mata-700 via-mata-600 to-mata-800 px-5 py-5 text-white shadow-cartao-alto sm:px-6 sm:py-6">
        <Sprout
          size={150}
          strokeWidth={1}
          className="pointer-events-none absolute -right-6 -top-8 text-white/[0.07]"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {saudacao()}
              {usuario?.nome ? `, ${usuario.nome.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-1 text-sm text-mata-100">
              {propriedade?.nome ?? "Propriedade"}
              {areaTotal > 0 && ` · ${numero(areaTotal, 2)} ha em ${talhoes?.length ?? 0} talhões`}
              {" · "}
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/painel/colheitas"
              className="flex items-center gap-1.5 rounded-lg bg-limao-400 px-3.5 py-2 text-sm font-semibold text-mata-900 shadow-cartao transition duration-200 ease-suave hover:-translate-y-0.5 hover:bg-limao-300 hover:shadow-cartao-alto"
            >
              <Plus size={16} strokeWidth={2.5} />
              Colheita
            </Link>
            <Link
              to="/painel/atividades"
              className="flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur transition duration-200 ease-suave hover:-translate-y-0.5 hover:bg-white/20"
            >
              <Plus size={16} strokeWidth={2.5} />
              Operação
            </Link>
          </div>
        </div>
      </header>

      {semLancamento && (
        <Aviso tom="mata" titulo="Cadastro pronto, operação ainda não começou" icone={Sprout}>
          Os {talhoes?.length ?? 0} talhões e {numero(areaTotal, 2)} ha já estão no sistema. Assim que
          o primeiro repique e as primeiras operações forem lançados, os números e o gráfico abaixo
          passam a se preencher sozinhos.
        </Aviso>
      )}

      {/* Grade assimétrica: o acumulado ocupa o dobro e ancora a leitura; os
          demais orbitam em torno dele. */}
      {carregandoColheitas ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <EsqueletoIndicador />
          <EsqueletoIndicador />
          <EsqueletoIndicador />
          <EsqueletoIndicador />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador
            titulo="Colheita acumulada"
            valor={numero(caixasTotal, 0)}
            unidade="cx"
            tom="limao"
            icone={Citrus}
            destaque
            className="col-span-2 lg:row-span-2"
            detalhe={
              areaTotal > 0
                ? `${numero(caixasTotal / areaTotal)} cx/ha em ${numero(areaTotal, 2)} ha`
                : undefined
            }
            link="/painel/colheitas"
          />
          <Indicador
            titulo="Colhido hoje"
            valor={numero(caixasHoje, 0)}
            unidade="cx"
            tom="limao"
            icone={TrendingUp}
            detalhe={caixasHoje > 0 ? "repique em andamento" : "nenhum lançamento hoje"}
            link="/painel/colheitas"
          />
          <Indicador
            titulo="Custo por caixa"
            valor={custoPorCaixa != null ? moeda(custoPorCaixa) : "—"}
            tom="mata"
            icone={Wallet}
            detalhe={custoPorCaixa != null ? "colheita + operações" : "sem colheita lançada"}
            link="/painel/atividades"
          />
          <Indicador
            titulo="Margem parcial"
            valor={receita > 0 ? moeda(margem) : "—"}
            tom={receita > 0 ? (margem >= 0 ? "mata" : "perigo") : "neutro"}
            icone={ChartColumn}
            className="col-span-2"
            detalhe={
              receita > 0
                ? `receita ${moeda(receita)} · custos ${moeda(custoTotal)}`
                : "sem venda lançada"
            }
            link="/painel/colheitas"
          />
        </div>
      )}

      {clima.data && <PainelClima clima={clima.data} />}
      {clima.isError && (
        <Aviso tom="neutro" titulo="Clima indisponível" icone={CloudOff}>
          Não foi possível consultar a previsão agora. Se isto persistir, confira se a propriedade
          tem latitude e longitude preenchidas em{" "}
          <Link to="/painel/cadastros/propriedade" className="font-medium underline">
            Cadastros
          </Link>
          .
        </Aviso>
      )}

      <Cartao className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-0 sm:p-5 sm:pb-0">
          <TituloSecao
            icone={Map}
            descricao={
              selecaoMapa
                ? "Clique noutro talhão/setor para trocar, ou numa área vazia do mapa para limpar"
                : "Clique num talhão ou setor para ver os avisos dele"
            }
          >
            Mapa da propriedade
          </TituloSecao>
          <Link
            to="/painel/mapa"
            className="group flex shrink-0 items-center gap-1 text-sm font-medium text-mata-700 transition hover:text-mata-900"
          >
            ver mapa completo
            <ArrowRight
              size={14}
              className="transition-transform duration-200 ease-suave group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-5">
          <button
            type="button"
            onClick={() => setCamadaTalhoes((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              camadaTalhoes
                ? "border-mata-300 bg-mata-50 text-mata-700"
                : "border-terra-200 text-terra-500 hover:bg-terra-50"
            }`}
          >
            Talhões
          </button>
          <button
            type="button"
            onClick={() => setCamadaSetores((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              camadaSetores
                ? "border-agua-300 bg-agua-50 text-agua-700"
                : "border-terra-200 text-terra-500 hover:bg-terra-50"
            }`}
          >
            Setores de irrigação
          </button>
        </div>

        <div className="mt-3 flex flex-col lg:flex-row">
          <div className="w-full shrink-0 lg:w-[380px]">
            <MapaPropriedade
              propriedade={propriedade}
              talhoes={talhoes}
              setores={setoresIrrigacao}
              verTalhoes={camadaTalhoes}
              verSetores={camadaSetores}
              altura="h-80 lg:h-[400px]"
              compacto
              selecao={selecaoMapa}
              aoSelecionar={setSelecaoMapa}
            />
          </div>
          <div className="min-w-0 flex-1 border-t border-terra-100 p-4 sm:p-5 lg:border-l lg:border-t-0">
            <PainelResumoMapa
              selecao={selecaoMapa}
              talhoes={talhoes}
              setoresIrrigacao={setoresIrrigacao}
              alertas={alertas}
              atividadesPlanejadas={atividadesPlanejadas}
              pulverizacoes={pulverizacoes}
              atividades={atividades}
              situacaoSetores={setores}
            />
          </div>
        </div>
      </Cartao>

      <Cartao>
        <TituloSecao
          icone={ChartColumn}
          descricao="Cada barra é uma semana — o vão entre elas mostra o intervalo entre repiques"
          acao={
            <Link
              to="/painel/colheitas"
              className="group flex items-center gap-1 text-sm font-medium text-mata-700 transition hover:text-mata-900"
            >
              ver colheitas
              <ArrowRight
                size={14}
                className="transition-transform duration-200 ease-suave group-hover:translate-x-0.5"
              />
            </Link>
          }
        >
          Ritmo de colheita
        </TituloSecao>
        <GraficoColheita colheitas={colheitas ?? []} />
      </Cartao>

      {!!temAlerta && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {!!alertas?.length && (
            <Aviso
              tom="perigo"
              titulo="Controle de pragas"
              icone={Bug}
              acao={
                <Link to="/painel/pragas" className="text-xs font-medium underline">
                  ver todos
                </Link>
              }
            >
              <ul className="space-y-1">
                {alertas.slice(0, 4).map((a) => (
                  <li key={`${a.regraId}-${a.talhaoId}`}>
                    <span className="font-semibold">
                      {a.talhaoCodigo ? `${a.talhaoCodigo} · ` : ""}
                      {a.talhaoNome}
                    </span>{" "}
                    — {ROTULO_FUNCAO_INSUMO[a.funcao]}
                    {a.nuncaAplicado ? " (nunca aplicado)" : ` há ${a.diasDesdeUltima} dias`}
                  </li>
                ))}
              </ul>
              {alertas.length > 4 && (
                <p className="mt-1.5 text-xs opacity-80">e mais {alertas.length - 4}…</p>
              )}
            </Aviso>
          )}

          {!!setoresAtrasados.length && (
            <Aviso
              tom="agua"
              titulo="Irrigação atrasada"
              icone={Droplets}
              acao={
                <Link to="/painel/irrigacao" className="text-xs font-medium underline">
                  manejo hídrico
                </Link>
              }
            >
              <ul className="space-y-1">
                {setoresAtrasados.slice(0, 4).map((s) => (
                  <li key={s.setorId}>
                    <span className="font-semibold">
                      {s.codigo ? `${s.codigo} · ` : ""}
                      {s.nome}
                    </span>
                    {s.diasDesdeUltima != null ? ` — há ${s.diasDesdeUltima} dias` : " — nunca irrigado"}
                  </li>
                ))}
              </ul>
            </Aviso>
          )}

          {!!insumosBaixos.length && (
            <Aviso
              tom="alerta"
              titulo="Estoque abaixo do mínimo"
              icone={Package}
              acao={
                <Link to="/painel/estoque" className="text-xs font-medium underline">
                  estoque
                </Link>
              }
            >
              <ul className="space-y-1">
                {insumosBaixos.slice(0, 4).map((i) => (
                  <li key={i.id}>
                    <span className="font-semibold">{i.nome}</span> — {numero(i.saldoAtual)}{" "}
                    {i.unidadeMedida} (mínimo {numero(i.estoqueMinimo)})
                  </li>
                ))}
              </ul>
            </Aviso>
          )}
        </div>
      )}

      <div>
        <TituloSecao icone={Citrus} descricao="Produtividade e custo por talhão, do que já foi lançado">
          Desempenho por talhão
        </TituloSecao>
        <Tabela
          cabecalho={["Talhão", "Caixas", "Cx/ha", "Custo colheita", "R$/cx", "Margem"]}
          vazio={
            !resumo?.length ? (
              <EstadoVazio
                icone={Citrus}
                tom="limao"
                titulo="Nenhum talhão com colheita ainda"
                descricao="A comparação entre talhões aparece assim que houver caixas lançadas em pelo menos um deles."
              />
            ) : undefined
          }
        >
          {resumo?.map((r) => {
            const custoCaixa = r.caixas > 0 ? r.custoColheita / r.caixas : null;
            return (
              <tr key={r.talhaoId} className="transition-colors duration-150 hover:bg-terra-50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-terra-800">
                  {r.codigo ? `${r.codigo} · ` : ""}
                  {r.nome}
                </td>
                <td className="numero px-4 py-3">{numero(r.caixas, 0)}</td>
                <td className="numero px-4 py-3">{numero(r.caixasPorHectare)}</td>
                <td className="numero px-4 py-3">{moeda(r.custoColheita)}</td>
                <td className="numero px-4 py-3">{custoCaixa != null ? moeda(custoCaixa) : "—"}</td>
                <td className="numero px-4 py-3">
                  {r.receita > 0 ? (
                    <Etiqueta tom={r.margem >= 0 ? "mata" : "perigo"}>{moeda(r.margem)}</Etiqueta>
                  ) : (
                    <span className="text-terra-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </Tabela>
      </div>

      <div>
        <TituloSecao
          icone={ClipboardList}
          acao={
            <Link
              to="/painel/atividades"
              className="group flex items-center gap-1 text-sm font-medium text-mata-700 transition hover:text-mata-900"
            >
              ver todas
              <ArrowRight
                size={14}
                className="transition-transform duration-200 ease-suave group-hover:translate-x-0.5"
              />
            </Link>
          }
        >
          Últimas operações
        </TituloSecao>
        <Tabela
          cabecalho={["Data", "Operação", "Talhões", "Quem fez", "Custo"]}
          vazio={
            !atividades?.length ? (
              <EstadoVazio
                icone={ClipboardList}
                titulo="Nenhuma operação lançada"
                descricao="Pulverizações, adubações e tratos culturais lançados pelo celular aparecem aqui."
              />
            ) : undefined
          }
        >
          {atividades?.slice(0, 8).map((a) => (
            <tr key={a.id} className="transition-colors duration-150 hover:bg-terra-50">
              <td className="numero whitespace-nowrap px-4 py-3 text-terra-600">
                {new Date(a.data).toLocaleDateString("pt-BR")}
              </td>
              <td className="px-4 py-3 font-medium text-terra-800">{a.tipoAtividade?.nome}</td>
              <td className="px-4 py-3 text-terra-600">
                {a.talhoes?.map((t) => t.talhao.nome).join(", ")}
              </td>
              <td className="px-4 py-3 text-terra-600">
                {a.executor?.nome ?? a.responsavel?.nome ?? "—"}
              </td>
              <td className="numero px-4 py-3">
                {a.custoMaoDeObra != null ? moeda(a.custoMaoDeObra) : "—"}
              </td>
            </tr>
          ))}
        </Tabela>
      </div>
    </div>
  );
}
