import Dexie, { type Table } from "dexie";

export interface InsumoUsadoOffline {
  insumoId: string;
  quantidade?: number;
  quantidadeLevada?: number;
  quantidadeRetornada?: number;
  unidade: string;
}

export interface AtividadePendente {
  clientId: string; // chave primária local, também enviada como idempotency key
  tipoAtividadeId: string;
  talhaoIds: string[];
  grupoIds: string[];
  executorId?: string | null;
  custoMaoDeObra?: number | null;
  data: string; // ISO
  observacoes?: string;
  insumos: InsumoUsadoOffline[];
  // metadados de exibição (para listar offline sem depender de outra tabela)
  descricaoTalhoes: string;
  tipoAtividadeNome: string;
  status: "pendente" | "erro";
  erro?: string;
  /** quantas vezes o servidor já recusou este item */
  tentativas?: number;
  criadoEm: string; // ISO
}

export interface ColheitaPendente {
  clientId: string;
  talhaoId: string;
  data: string; // ISO
  quantidadeCaixas: number;
  executorId?: string | null;
  valorPorCaixa?: number | null;
  observacoes?: string;
  // metadados de exibição
  talhaoNome: string;
  executorNome?: string;
  status: "pendente" | "erro";
  erro?: string;
  /** quantas vezes o servidor já recusou este item */
  tentativas?: number;
  criadoEm: string; // ISO
}

class ErpSitioDB extends Dexie {
  atividadesPendentes!: Table<AtividadePendente, string>;
  colheitasPendentes!: Table<ColheitaPendente, string>;

  constructor() {
    super("erpsitio-offline");
    this.version(1).stores({
      atividadesPendentes: "clientId, status, criadoEm",
    });
    // v2: operacao passa a ter varios talhoes e colheita ganha fila offline.
    // A fila v1 nao e migrada: o formato do apontamento mudou e a fila e
    // efemera (some assim que sincroniza).
    this.version(2)
      .stores({
        atividadesPendentes: "clientId, status, criadoEm",
        colheitasPendentes: "clientId, status, criadoEm",
      })
      .upgrade(async (tx) => {
        await tx.table("atividadesPendentes").clear();
      });
  }
}

export const db = new ErpSitioDB();
