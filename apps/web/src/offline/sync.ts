import { api } from "../lib/api";
import { db } from "./db";

interface ResultadoLote {
  resultados: {
    clientId: string;
    id?: string;
    status: "criado" | "ja_existia" | "erro";
    erro?: string;
  }[];
}

export interface ResumoSync {
  enviados: number;
  falhas: number;
}

async function sincronizarAtividades(): Promise<ResumoSync> {
  const pendentes = await db.atividadesPendentes.where("status").equals("pendente").toArray();
  if (pendentes.length === 0) return { enviados: 0, falhas: 0 };

  const itens = pendentes.map((p) => ({
    clientId: p.clientId,
    tipoAtividadeId: p.tipoAtividadeId,
    talhaoIds: p.talhaoIds,
    grupoIds: p.grupoIds,
    executorId: p.executorId ?? undefined,
    custoMaoDeObra: p.custoMaoDeObra ?? undefined,
    data: p.data,
    observacoes: p.observacoes,
    origem: "APP" as const,
    insumos: p.insumos,
  }));

  let resposta: ResultadoLote;
  try {
    resposta = await api.post<ResultadoLote>("/atividades/sync-lote", { itens });
  } catch {
    return { enviados: 0, falhas: pendentes.length };
  }

  let enviados = 0;
  let falhas = 0;
  for (const r of resposta.resultados) {
    if (r.status === "erro") {
      falhas++;
      await db.atividadesPendentes.update(r.clientId, { status: "erro", erro: r.erro });
    } else {
      enviados++;
      await db.atividadesPendentes.delete(r.clientId);
    }
  }
  return { enviados, falhas };
}

async function sincronizarColheitas(): Promise<ResumoSync> {
  const pendentes = await db.colheitasPendentes.where("status").equals("pendente").toArray();
  if (pendentes.length === 0) return { enviados: 0, falhas: 0 };

  const itens = pendentes.map((p) => ({
    clientId: p.clientId,
    talhaoId: p.talhaoId,
    data: p.data,
    quantidadeCaixas: p.quantidadeCaixas,
    executorId: p.executorId ?? undefined,
    valorPorCaixa: p.valorPorCaixa ?? undefined,
    observacoes: p.observacoes,
    origem: "APP" as const,
  }));

  let resposta: ResultadoLote;
  try {
    resposta = await api.post<ResultadoLote>("/colheitas/sync-lote", { itens });
  } catch {
    return { enviados: 0, falhas: pendentes.length };
  }

  let enviados = 0;
  let falhas = 0;
  for (const r of resposta.resultados) {
    if (r.status === "erro") {
      falhas++;
      await db.colheitasPendentes.update(r.clientId, { status: "erro", erro: r.erro });
    } else {
      enviados++;
      await db.colheitasPendentes.delete(r.clientId);
    }
  }
  return { enviados, falhas };
}

export async function sincronizarPendentes(): Promise<ResumoSync> {
  const [ops, colheitas] = await Promise.all([sincronizarAtividades(), sincronizarColheitas()]);
  return {
    enviados: ops.enviados + colheitas.enviados,
    falhas: ops.falhas + colheitas.falhas,
  };
}

export function iniciarSyncAutomatico() {
  window.addEventListener("online", () => {
    sincronizarPendentes().catch(() => {});
  });
  if (navigator.onLine) {
    sincronizarPendentes().catch(() => {});
  }
}
