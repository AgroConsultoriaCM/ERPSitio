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
    alvo.receita +=
      c.valorTotalVenda ?? (c.valorPorCaixa != null ? c.valorPorCaixa * c.quantidadeCaixas : 0);
  }

  return [...mapa.values()];
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
        icone="▤"
        titulo="Nenhuma colheita nas últimas semanas"
        descricao="Assim que os repiques forem lançados, o ritmo de colheita aparece aqui — cada barra é uma semana."
      />
    );
  }

  const semanasComColheita = dados.filter((d) => d.caixas > 0);
  const maior = Math.max(...dados.map((d) => d.caixas));

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e3db" vertical={false} />
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
              cursor={{ fill: "#f3f1ed" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e7e3db",
                fontSize: 13,
                boxShadow: "0 6px 16px rgb(24 54 40 / 0.10)",
              }}
              formatter={(valor: number, nome) =>
                nome === "caixas"
                  ? [`${numero(valor, 0)} caixas`, "Colhido"]
                  : [numero(valor, 2), String(nome)]
              }
              labelFormatter={(r) => `Semana de ${r}`}
            />
            <Bar dataKey="caixas" radius={[4, 4, 0, 0]} maxBarSize={26}>
              {dados.map((d) => (
                // A maior semana do período ganha destaque: é a referência de
                // pico que o produtor usa para comparar os repiques seguintes.
                <Cell key={d.chave} fill={d.caixas === maior ? "#82970b" : "#c9dd1c"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-terra-500">
        <span>
          <strong className="numero text-terra-700">{numero(totalCaixas, 0)}</strong> caixas em{" "}
          {semanas} semanas
        </span>
        <span>
          <strong className="numero text-terra-700">{semanasComColheita.length}</strong> semanas com
          repique
        </span>
        <span>
          pico de <strong className="numero text-terra-700">{numero(maior, 0)}</strong> cx numa
          semana
        </span>
      </div>
    </div>
  );
}
