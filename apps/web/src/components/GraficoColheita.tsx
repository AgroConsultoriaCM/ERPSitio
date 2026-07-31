import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Citrus } from "lucide-react";
import type { Colheita } from "../lib/types";
import { EstadoVazio, numero } from "./ui";

/**
 * Colheita por semana.
 *
 * Limão taiti não tem safra única: colhe-se em repiques ao longo do ano. Um
 * total acumulado esconde exatamente o que interessa — o ritmo. Agrupar por
 * semana deixa à vista o intervalo entre repiques e o tamanho de cada um.
 */

interface SemanaColheita {
  chave: string;
  rotulo: string;
  caixas: number;
  receita: number;
  inicio: Date;
}

/** Segunda-feira da semana da data informada. */
function inicioDaSemana(d: Date): Date {
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  const diaSemana = (dia.getDay() + 6) % 7; // 0 = segunda
  dia.setDate(dia.getDate() - diaSemana);
  return dia;
}

export function agruparPorSemana(colheitas: Colheita[], semanas = 16): SemanaColheita[] {
  const agora = inicioDaSemana(new Date());
  const primeira = new Date(agora);
  primeira.setDate(primeira.getDate() - (semanas - 1) * 7);

  // Todas as semanas do intervalo existem, mesmo as sem colheita: é o vão
  // entre as barras que mostra o intervalo entre repiques.
  const mapa = new Map<string, SemanaColheita>();
  for (let i = 0; i < semanas; i++) {
    const inicio = new Date(primeira);
    inicio.setDate(inicio.getDate() + i * 7);
    const chave = inicio.toISOString().slice(0, 10);
    mapa.set(chave, {
      chave,
      inicio,
      rotulo: inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      caixas: 0,
      receita: 0,
    });
  }

  for (const c of colheitas) {
    const inicio = inicioDaSemana(new Date(c.data));
    const chave = inicio.toISOString().slice(0, 10);
    const alvo = mapa.get(chave);
    if (!alvo) continue; // fora da janela mostrada
    alvo.caixas += c.quantidadeCaixas;
    // valorVendaTotal já resolve preço por qualidade e valor fechado antigo;
    // o valorPorCaixa é o último recurso, para lançamento só de campo.
    alvo.receita +=
      c.valorVendaTotal ?? (c.valorPorCaixa != null ? c.valorPorCaixa * c.quantidadeCaixas : 0);
  }

  return [...mapa.values()];
}

function Legenda({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="numero text-lg font-bold leading-none text-terra-800">{valor}</span>
      <span className="text-xs text-terra-500">{rotulo}</span>
    </div>
  );
}

export default function GraficoColheita({
  colheitas,
  semanas = 16,
}: {
  colheitas: Colheita[];
  semanas?: number;
}) {
  const dados = useMemo(() => agruparPorSemana(colheitas, semanas), [colheitas, semanas]);
  const totalCaixas = dados.reduce((s, d) => s + d.caixas, 0);

  if (totalCaixas === 0) {
    return (
      <EstadoVazio
        icone={Citrus}
        tom="limao"
        titulo="Nenhuma colheita nas últimas semanas"
        descricao="Assim que os repiques forem lançados, o ritmo de colheita aparece aqui — cada barra é uma semana."
      />
    );
  }

  const semanasComColheita = dados.filter((d) => d.caixas > 0);
  const maior = Math.max(...dados.map((d) => d.caixas));
  const media = totalCaixas / Math.max(1, semanasComColheita.length);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-7 gap-y-2 border-b border-terra-100 pb-3">
        <Legenda valor={numero(totalCaixas, 0)} rotulo={`caixas em ${semanas} semanas`} />
        <Legenda valor={String(semanasComColheita.length)} rotulo="semanas com repique" />
        <Legenda valor={numero(media, 0)} rotulo="média por repique" />
        <Legenda valor={numero(maior, 0)} rotulo="maior semana" />
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              {/* Gradiente vertical: a barra fica mais densa na base, o que dá
                  peso visual e evita o aspecto chapado de bloco sólido. */}
              <linearGradient id="barraColheita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dbed4c" />
                <stop offset="100%" stopColor="#a8bd10" />
              </linearGradient>
              <linearGradient id="barraPico" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a8bd10" />
                <stop offset="100%" stopColor="#62730d" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 5" stroke="#e7e3db" vertical={false} />
            <XAxis
              dataKey="rotulo"
              tick={{ fontSize: 11, fill: "#94886f" }}
              axisLine={{ stroke: "#e7e3db" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94886f" }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ fill: "rgba(168, 189, 16, 0.08)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e7e3db",
                fontSize: 13,
                padding: "8px 12px",
                boxShadow: "0 8px 20px -4px rgb(24 54 40 / 0.12)",
              }}
              formatter={(valor: number) => [`${numero(valor, 0)} caixas`, "Colhido"]}
              labelFormatter={(r) => `Semana de ${r}`}
            />
            <Bar
              dataKey="caixas"
              radius={[5, 5, 0, 0]}
              maxBarSize={28}
              animationDuration={700}
              animationEasing="ease-out"
            >
              {dados.map((d) => (
                // A maior semana do período ganha destaque: é a referência de
                // pico que o produtor usa para comparar os repiques seguintes.
                <Cell
                  key={d.chave}
                  fill={d.caixas === maior ? "url(#barraPico)" : "url(#barraColheita)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
