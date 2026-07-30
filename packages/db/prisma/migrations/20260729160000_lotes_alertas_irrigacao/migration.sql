-- CreateEnum
CREATE TYPE "OrigemLote" AS ENUM ('COMPRA', 'INVENTARIO_INICIAL', 'AJUSTE');
CREATE TYPE "EscopoAlerta" AS ENUM ('TODOS_TALHOES', 'GRUPO', 'TALHAO');

-- CreateTable: lotes de entrada com preco (base do custo real)
CREATE TABLE "LoteInsumo" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "origem" "OrigemLote" NOT NULL DEFAULT 'COMPRA',
    "data" TIMESTAMP(3) NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "quantidadeRestante" DOUBLE PRECISION NOT NULL,
    "precoUnitario" DOUBLE PRECISION NOT NULL,
    "fornecedor" TEXT,
    "numeroNota" TEXT,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoteInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable: regras de alerta do controle de pragas
CREATE TABLE "RegraAlerta" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" "FuncaoInsumo" NOT NULL,
    "intervaloDias" INTEGER NOT NULL,
    "escopo" "EscopoAlerta" NOT NULL DEFAULT 'TODOS_TALHOES',
    "grupoId" TEXT,
    "talhaoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegraAlerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable: registro de irrigacao por setor
CREATE TABLE "Irrigacao" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "setorId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "duracaoHoras" DOUBLE PRECISION,
    "laminaMm" DOUBLE PRECISION,
    "observacoes" TEXT,
    "origem" "OrigemLancamento" NOT NULL DEFAULT 'WEB',
    "responsavelId" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Irrigacao_pkey" PRIMARY KEY ("id")
);

-- AlterTable: movimentacao aponta para o lote e guarda custo
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN     "loteId" TEXT,
ADD COLUMN     "custoUnitario" DOUBLE PRECISION,
ADD COLUMN     "custoTotal" DOUBLE PRECISION;

-- AlterTable: produto da operacao guarda levado/devolvido e custo real
ALTER TABLE "AtividadeInsumo" ADD COLUMN     "quantidadeLevada" DOUBLE PRECISION,
ADD COLUMN     "quantidadeRetornada" DOUBLE PRECISION,
ADD COLUMN     "custoUnitario" DOUBLE PRECISION,
ADD COLUMN     "custoTotal" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "LoteInsumo_propriedadeId_idx" ON "LoteInsumo"("propriedadeId");
CREATE INDEX "LoteInsumo_insumoId_idx" ON "LoteInsumo"("insumoId");
CREATE INDEX "LoteInsumo_data_idx" ON "LoteInsumo"("data");
CREATE INDEX "RegraAlerta_propriedadeId_idx" ON "RegraAlerta"("propriedadeId");
CREATE UNIQUE INDEX "Irrigacao_clientId_key" ON "Irrigacao"("clientId");
CREATE INDEX "Irrigacao_propriedadeId_idx" ON "Irrigacao"("propriedadeId");
CREATE INDEX "Irrigacao_setorId_idx" ON "Irrigacao"("setorId");
CREATE INDEX "Irrigacao_data_idx" ON "Irrigacao"("data");
CREATE INDEX "MovimentacaoEstoque_loteId_idx" ON "MovimentacaoEstoque"("loteId");

-- AddForeignKey
ALTER TABLE "LoteInsumo" ADD CONSTRAINT "LoteInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoteInsumo" ADD CONSTRAINT "LoteInsumo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegraAlerta" ADD CONSTRAINT "RegraAlerta_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Irrigacao" ADD CONSTRAINT "Irrigacao_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "SetorIrrigacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Irrigacao" ADD CONSTRAINT "Irrigacao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Irrigacao" ADD CONSTRAINT "Irrigacao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteInsumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
