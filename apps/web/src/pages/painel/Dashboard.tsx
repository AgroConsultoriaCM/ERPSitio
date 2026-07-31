import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { ROTULO_FUNCAO_INSUMO } from "../../lib/types";
import type {
  AlertaPraga,
  Atividade,
  Colheita,
  Insumo,
  Propriedade,
  ResumoColheitaTalhao,
  RespostaClima,
  SituacaoSetor,
  Talhao,
} from "../../lib/types";
import GraficoColheita from "../../components/GraficoColheita";
import PainelClima from "../../components/PainelClima";
import {
  Aviso,
  Cartao,
  EstadoVazio,
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
  const { data: colheitas } = useQuery({
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

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-terra-900">
            {saudacao()}
            {usuario?.nome ? `, ${usuario.nome.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-terra-500">
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
            className="rounded-lg bg-limao-600 px-3.5 py-2 text-sm font-semibold text-white shadow-cartao transition hover:bg-limao-700"
          >
            Lançar colheita
          </Link>
          <Link
            to="/painel/atividades"
            className="rounded-lg border border-terra-300 bg-white px-3.5 py-2 text-sm font-semibold text-terra-700 transition hover:bg-terra-50"
          >
            Lançar operação
          </Link>
        </div>
      </header>

      {semLancamento && (
        <Aviso tom="mata" titulo="Cadastro pronto, operação ainda não começou">
          Os {talhoes?.length ?? 0} talhões e {numero(areaTotal, 2)} ha já estão no sistema. Assim que
          o primeiro repique e as primeiras operações forem lançados, os números e o gráfico abaixo
          passam a se preencher sozinhos.
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          titulo="Colhido hoje"
          valor={numero(caixasHoje, 0)}
          unidade="cx"
          tom="limao"
          detalhe={caixasHoje > 0 ? "repique em andamento" : "nenhum lançamento hoje"}
          link="/painel/colheitas"
        />
        <Indicador
          titulo="Colheita acumulada"
          valor={numero(caixasTotal, 0)}
          unidade="cx"
          tom="limao"
          detalhe={areaTotal > 0 ? `${numero(caixasTotal / areaTotal)} cx/ha` : undefined}
          link="/painel/colheitas"
        />
        <Indicador
          titulo="Custo por caixa"
          valor={custoPorCaixa != null ? moeda(custoPorCaixa) : "—"}
          tom="mata"
          detalhe={custoPorCaixa != null ? "colheita + operações" : "sem colheita lançada"}
          link="/painel/atividades"
        />
        <Indicador
          titulo="Margem parcial"
          valor={receita > 0 ? moeda(margem) : "—"}
          tom={receita > 0 ? (margem >= 0 ? "mata" : "perigo") : "neutro"}
          detalhe={receita > 0 ? `receita ${moeda(receita)}` : "sem venda lançada"}
          link="/painel/colheitas"
        />
      </div>

      {clima.data && <PainelClima clima={clima.data} />}
      {clima.isError && (
        <Aviso tom="neutro" titulo="Clima indisponível">
          Não foi possível consultar a previsão agora. Se isto persistir, confira se a propriedade
          tem latitude e longitude preenchidas em{" "}
          <Link to="/painel/cadastros/propriedade" className="underline">
            Cadastros
          </Link>
          .
        </Aviso>
      )}

      <Cartao>
        <TituloSecao
          descricao="Cada barra é uma semana — o vão entre elas mostra o intervalo entre repiques"
          acao={
            <Link to="/painel/colheitas" className="text-sm font-medium text-mata-700 hover:underline">
              ver colheitas
            </Link>
          }
        >
          Ritmo de colheita
        </TituloSecao>
        <GraficoColheita colheitas={colheitas ?? []} />
      </Cartao>

      {(alertas?.length || setoresAtrasados.length || insumosBaixos.length) > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {!!alertas?.length && (
            <Aviso
              tom="perigo"
              titulo="Controle de pragas"
              acao={
                <Link to="/painel/pragas" className="text-xs underline">
                  ver todos
                </Link>
              }
            >
              <ul className="space-y-1">
                {alertas.slice(0, 4).map((a) => (
                  <li key={`${a.regraId}-${a.talhaoId}`}>
                    <span className="font-medium">
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
              acao={
                <Link to="/painel/irrigacao" className="text-xs underline">
                  manejo hídrico
                </Link>
              }
            >
              <ul className="space-y-1">
                {setoresAtrasados.slice(0, 4).map((s) => (
                  <li key={s.setorId}>
                    <span className="font-medium">
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
              acao={
                <Link to="/painel/estoque" className="text-xs underline">
                  estoque
                </Link>
              }
            >
              <ul className="space-y-1">
                {insumosBaixos.slice(0, 4).map((i) => (
                  <li key={i.id}>
                    <span className="font-medium">{i.nome}</span> — {numero(i.saldoAtual)}{" "}
                    {i.unidadeMedida} (mínimo {numero(i.estoqueMinimo)})
                  </li>
                ))}
              </ul>
            </Aviso>
          )}
        </div>
      )}

      <div>
        <TituloSecao descricao="Produtividade e custo por talhão, do que já foi lançado">
          Desempenho por talhão
        </TituloSecao>
        <Tabela
          cabecalho={["Talhão", "Caixas", "Cx/ha", "Custo colheita", "R$/cx", "Margem"]}
          vazio={
            !resumo?.length ? (
              <EstadoVazio
                icone="▦"
                titulo="Nenhum talhão com colheita ainda"
                descricao="A comparação entre talhões aparece assim que houver caixas lançadas em pelo menos um deles."
              />
            ) : undefined
          }
        >
          {resumo?.map((r) => {
            const custoCaixa = r.caixas > 0 ? r.custoColheita / r.caixas : null;
            return (
              <tr key={r.talhaoId} className="transition hover:bg-terra-50">
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-terra-800">
                  {r.codigo ? `${r.codigo} · ` : ""}
                  {r.nome}
                </td>
                <td className="numero px-4 py-2.5">{numero(r.caixas, 0)}</td>
                <td className="numero px-4 py-2.5">{numero(r.caixasPorHectare)}</td>
                <td className="numero px-4 py-2.5">{moeda(r.custoColheita)}</td>
                <td className="numero px-4 py-2.5">{custoCaixa != null ? moeda(custoCaixa) : "—"}</td>
                <td className="numero px-4 py-2.5">
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
          acao={
            <Link to="/painel/atividades" className="text-sm font-medium text-mata-700 hover:underline">
              ver todas
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
                icone="✓"
                titulo="Nenhuma operação lançada"
                descricao="Pulverizações, adubações e tratos culturais lançados pelo celular aparecem aqui."
              />
            ) : undefined
          }
        >
          {atividades?.slice(0, 8).map((a) => (
            <tr key={a.id} className="transition hover:bg-terra-50">
              <td className="numero whitespace-nowrap px-4 py-2.5 text-terra-600">
                {new Date(a.data).toLocaleDateString("pt-BR")}
              </td>
              <td className="px-4 py-2.5 font-medium text-terra-800">{a.tipoAtividade?.nome}</td>
              <td className="px-4 py-2.5 text-terra-600">
                {a.talhoes?.map((t) => t.talhao.nome).join(", ")}
              </td>
              <td className="px-4 py-2.5 text-terra-600">
                {a.executor?.nome ?? a.responsavel?.nome ?? "—"}
              </td>
              <td className="numero px-4 py-2.5">
                {a.custoMaoDeObra != null ? moeda(a.custoMaoDeObra) : "—"}
              </td>
            </tr>
          ))}
        </Tabela>
      </div>
    </div>
  );
}
