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
  /** true quando nem chegou a falar com o servidor (sem sinal) */
  semRede: boolean;
}

const VAZIO: ResumoSync = { enviados: 0, falhas: 0, semRede: false };

function somar(a: ResumoSync, b: ResumoSync): ResumoSync {
  return {
    enviados: a.enviados + b.enviados,
    falhas: a.falhas + b.falhas,
    semRede: a.semRede || b.semRede,
  };
}

async function sincronizarAtividades(): Promise<ResumoSync> {
  const pendentes = await db.atividadesPendentes.where("status").equals("pendente").toArray();
  if (pendentes.length === 0) return VAZIO;

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
    // Não marca como erro: sem rede o lançamento continua válido e será
    // tentado de novo. Marcar aqui faria o operador achar que perdeu o dado.
    return { enviados: 0, falhas: 0, semRede: true };
  }

  let enviados = 0;
  let falhas = 0;
  for (const r of resposta.resultados) {
    if (r.status === "erro") {
      falhas++;
      const atual = pendentes.find((p) => p.clientId === r.clientId);
      await db.atividadesPendentes.update(r.clientId, {
        status: "erro",
        erro: r.erro,
        tentativas: (atual?.tentativas ?? 0) + 1,
      });
    } else {
      enviados++;
      await db.atividadesPendentes.delete(r.clientId);
    }
  }
  return { enviados, falhas, semRede: false };
}

async function sincronizarColheitas(): Promise<ResumoSync> {
  const pendentes = await db.colheitasPendentes.where("status").equals("pendente").toArray();
  if (pendentes.length === 0) return VAZIO;

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
    return { enviados: 0, falhas: 0, semRede: true };
  }

  let enviados = 0;
  let falhas = 0;
  for (const r of resposta.resultados) {
    if (r.status === "erro") {
      falhas++;
      const atual = pendentes.find((p) => p.clientId === r.clientId);
      await db.colheitasPendentes.update(r.clientId, {
        status: "erro",
        erro: r.erro,
        tentativas: (atual?.tentativas ?? 0) + 1,
      });
    } else {
      enviados++;
      await db.colheitasPendentes.delete(r.clientId);
    }
  }
  return { enviados, falhas, semRede: false };
}

let sincronizando = false;

export async function sincronizarPendentes(): Promise<ResumoSync> {
  // Duas chamadas simultâneas mandariam o mesmo item duas vezes. O servidor
  // trata pelo clientId, mas gera trabalho e log inútil.
  if (sincronizando) return VAZIO;
  sincronizando = true;
  try {
    const [ops, colheitas] = await Promise.all([
      sincronizarAtividades(),
      sincronizarColheitas(),
    ]);
    return somar(ops, colheitas);
  } finally {
    sincronizando = false;
  }
}

/** Quantos lançamentos ainda não chegaram ao servidor. */
export async function contarPendentes(): Promise<{ pendentes: number; comErro: number }> {
  const [opsPend, colPend, opsErro, colErro] = await Promise.all([
    db.atividadesPendentes.where("status").equals("pendente").count(),
    db.colheitasPendentes.where("status").equals("pendente").count(),
    db.atividadesPendentes.where("status").equals("erro").count(),
    db.colheitasPendentes.where("status").equals("erro").count(),
  ]);
  return { pendentes: opsPend + colPend, comErro: opsErro + colErro };
}

/**
 * Devolve à fila os itens que o servidor recusou.
 *
 * Fica manual de propósito: erro de validação não se resolve sozinho, e
 * reenviar em laço só encheria o log. O operador vê a mensagem e decide.
 */
export async function reenviarComErro(): Promise<ResumoSync> {
  const [ops, colheitas] = await Promise.all([
    db.atividadesPendentes.where("status").equals("erro").toArray(),
    db.colheitasPendentes.where("status").equals("erro").toArray(),
  ]);
  await Promise.all([
    ...ops.map((o) => db.atividadesPendentes.update(o.clientId, { status: "pendente", erro: undefined })),
    ...colheitas.map((c) =>
      db.colheitasPendentes.update(c.clientId, { status: "pendente", erro: undefined }),
    ),
  ]);
  return sincronizarPendentes();
}

const INTERVALO_MS = 60_000;
let timer: number | undefined;

/**
 * Mantém a fila andando sozinha.
 *
 * O evento "online" não basta: no campo o aparelho oscila sem disparar evento
 * nenhum, e o navegador pode se dizer online com a torre fora de alcance. Por
 * isso há também a batida periódica e a volta do app ao primeiro plano — que
 * é o momento em que o encarregado tipicamente reencontra sinal.
 */
export function iniciarSyncAutomatico() {
  const tentar = () => {
    if (!navigator.onLine) return;
    void sincronizarPendentes().catch(() => {});
  };

  window.addEventListener("online", tentar);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tentar();
  });

  timer = window.setInterval(async () => {
    const { pendentes } = await contarPendentes();
    if (pendentes > 0) tentar();
  }, INTERVALO_MS);

  tentar();
}

export function pararSyncAutomatico() {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
}
