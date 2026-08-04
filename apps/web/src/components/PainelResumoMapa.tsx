import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bug, CalendarClock, ClipboardList, Droplets, MapPin, SprayCan } from "lucide-react";
import { ROTULO_FUNCAO_INSUMO } from "../lib/types";
import type {
  AlertaPraga,
  Atividade,
  AtividadePlanejada,
  RegistroPulverizacao,
  SetorIrrigacao,
  SituacaoSetor,
  Talhao,
} from "../lib/types";
import type { SelecaoMapa } from "./MapaPropriedade";

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

function Secao({ icone: Ico, titulo, children }: { icone: typeof Bug; titulo: string; children: ReactNode }) {
  return (
    <div className="border-t border-terra-100 pt-3 first:border-t-0 first:pt-0">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-terra-500">
        <Ico size={13} className="text-terra-400" />
        {titulo}
      </p>
      {children}
    </div>
  );
}

function SemNada({ children }: { children: string }) {
  return <p className="text-sm text-terra-400">{children}</p>;
}

/**
 * Painel ao lado do mapa do Painel (Dashboard.tsx): sem seleção, mostra um
 * resumo geral da propriedade; com um talhão ou setor clicado no mapa,
 * filtra tudo para aquele talhão/setor. Compacto de propósito — o detalhe de
 * verdade continua nas telas de Controle de pragas, Calendário e Pulverizações.
 */
export default function PainelResumoMapa({
  selecao,
  talhoes,
  setoresIrrigacao,
  alertas,
  atividadesPlanejadas,
  pulverizacoes,
  atividades,
  situacaoSetores,
}: {
  selecao: SelecaoMapa;
  talhoes?: Talhao[];
  setoresIrrigacao?: SetorIrrigacao[];
  alertas?: AlertaPraga[];
  atividadesPlanejadas?: AtividadePlanejada[];
  pulverizacoes?: RegistroPulverizacao[];
  atividades?: Atividade[];
  situacaoSetores?: SituacaoSetor[];
}) {
  if (selecao?.tipo === "setor") {
    const setor = setoresIrrigacao?.find((s) => s.id === selecao.id);
    const situacao = situacaoSetores?.find((s) => s.setorId === selecao.id);
    return (
      <div className="space-y-3">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-terra-900">
            <MapPin size={15} className="text-agua-600" />
            {setor?.codigo ? `${setor.codigo} · ` : ""}
            {setor?.nome ?? "Setor"}
          </p>
          {setor?.areaHa != null && <p className="text-xs text-terra-500">{setor.areaHa.toFixed(2)} ha</p>}
        </div>
        <Secao icone={Droplets} titulo="Irrigação">
          {situacao ? (
            <div className="space-y-0.5 text-sm text-terra-700">
              <p>
                {situacao.ultimaIrrigacao
                  ? `Última em ${dia(situacao.ultimaIrrigacao)} — há ${situacao.diasDesdeUltima} dia(s)`
                  : "Nunca irrigado"}
              </p>
              {situacao.duracaoHoras != null && <p>Duração: {situacao.duracaoHoras}h</p>}
              {situacao.laminaMm != null && <p>Lâmina: {situacao.laminaMm} mm</p>}
            </div>
          ) : (
            <SemNada>Sem registro de irrigação.</SemNada>
          )}
        </Secao>
        <Link
          to={`/painel/cadastros/setores/${selecao.id}`}
          className="inline-block text-sm font-medium text-mata-700 hover:text-mata-900 hover:underline"
        >
          Ver setor completo →
        </Link>
      </div>
    );
  }

  const talhaoId = selecao?.tipo === "talhao" ? selecao.id : null;
  const talhao = talhaoId ? talhoes?.find((t) => t.id === talhaoId) : null;

  const alertasFiltrados = (alertas ?? []).filter((a) => !talhaoId || a.talhaoId === talhaoId);
  const tarefasFiltradas = (atividadesPlanejadas ?? [])
    .filter((t) => !t.concluida)
    .filter((t) => !talhaoId || t.talhaoId === talhaoId)
    .sort((a, b) => a.data.localeCompare(b.data));
  const pulverizacoesFiltradas = (pulverizacoes ?? [])
    .filter((p) => !talhaoId || p.talhoes.some((t) => t.talhaoId === talhaoId))
    .sort((a, b) => b.data.localeCompare(a.data));
  const atividadesFiltradas = (atividades ?? [])
    .filter((a) => !talhaoId || a.talhoes.some((t) => t.talhaoId === talhaoId))
    .sort((a, b) => b.data.localeCompare(a.data));

  const ultimaPulverizacao = pulverizacoesFiltradas[0];

  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-1.5 font-semibold text-terra-900">
          {talhao && <MapPin size={15} className="text-mata-600" />}
          {talhao
            ? `${talhao.codigo ? `${talhao.codigo} · ` : ""}${talhao.nome}`
            : "Visão geral da propriedade"}
        </p>
        {talhao?.areaHa != null && <p className="text-xs text-terra-500">{talhao.areaHa.toFixed(2)} ha</p>}
        {!talhao && <p className="text-xs text-terra-500">Clique num talhão ou setor no mapa para filtrar</p>}
      </div>

      <Secao icone={Bug} titulo="Pragas">
        {alertasFiltrados.length ? (
          <ul className="space-y-1 text-sm text-terra-700">
            {alertasFiltrados.slice(0, 3).map((a) => (
              <li key={`${a.regraId}-${a.talhaoId}`}>
                {!talhao && (
                  <span className="font-medium">
                    {a.talhaoCodigo ? `${a.talhaoCodigo} · ` : ""}
                    {a.talhaoNome}
                  </span>
                )}{" "}
                <span className={talhao ? "font-medium" : ""}>{ROTULO_FUNCAO_INSUMO[a.funcao]}</span>
                {a.nuncaAplicado ? " — nunca aplicado" : ` — há ${a.diasDesdeUltima}d`}
              </li>
            ))}
            {alertasFiltrados.length > 3 && (
              <li className="text-xs text-terra-400">e mais {alertasFiltrados.length - 3}…</li>
            )}
          </ul>
        ) : (
          <SemNada>Nada vencido.</SemNada>
        )}
      </Secao>

      <Secao icone={CalendarClock} titulo="Tarefas pendentes">
        {tarefasFiltradas.length ? (
          <ul className="space-y-1 text-sm text-terra-700">
            {tarefasFiltradas.slice(0, 3).map((t) => (
              <li key={t.id}>
                <span className="font-medium">{t.titulo}</span> — {dia(t.data)}
              </li>
            ))}
            {tarefasFiltradas.length > 3 && (
              <li className="text-xs text-terra-400">e mais {tarefasFiltradas.length - 3}…</li>
            )}
          </ul>
        ) : (
          <SemNada>Nada programado.</SemNada>
        )}
      </Secao>

      <Secao icone={SprayCan} titulo="Última pulverização">
        {ultimaPulverizacao ? (
          <p className="text-sm text-terra-700">
            {dia(ultimaPulverizacao.data)}
            {!talhao && ultimaPulverizacao.talhoes.length > 0 && (
              <span className="text-terra-500"> — {ultimaPulverizacao.talhoes.map((t) => t.talhao?.nome ?? "").join(", ")}</span>
            )}
          </p>
        ) : (
          <SemNada>Nenhuma registrada.</SemNada>
        )}
      </Secao>

      <Secao icone={ClipboardList} titulo="Últimas operações">
        {atividadesFiltradas.length ? (
          <ul className="space-y-1 text-sm text-terra-700">
            {atividadesFiltradas.slice(0, 3).map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.tipoAtividade?.nome}</span> — {dia(a.data)}
              </li>
            ))}
            {atividadesFiltradas.length > 3 && (
              <li className="text-xs text-terra-400">e mais {atividadesFiltradas.length - 3}…</li>
            )}
          </ul>
        ) : (
          <SemNada>Nenhuma lançada.</SemNada>
        )}
      </Secao>

      {talhao && (
        <Link
          to={`/painel/cadastros/talhoes/${talhao.id}`}
          className="inline-block text-sm font-medium text-mata-700 hover:text-mata-900 hover:underline"
        >
          Ver talhão completo →
        </Link>
      )}
    </div>
  );
}
