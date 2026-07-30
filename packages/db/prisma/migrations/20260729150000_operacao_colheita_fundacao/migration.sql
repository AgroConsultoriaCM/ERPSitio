-- CreateEnum
CREATE TYPE "TipoExecutor" AS ENUM ('EQUIPE_PROPRIA', 'EMPREITEIRO', 'PRESTADOR_SERVICO');

-- CreateEnum
CREATE TYPE "FuncaoInsumo" AS ENUM ('INSETICIDA', 'FUNGICIDA', 'HERBICIDA', 'ACARICIDA', 'NEMATICIDA', 'NUTRICAO_FOLIAR', 'FERTILIZANTE_SOLO', 'ADJUVANTE', 'OUTRO');

-- AlterTable: funcao agronomica do insumo
ALTER TABLE "Insumo" ADD COLUMN     "funcao" "FuncaoInsumo";

-- CreateTable
CREATE TABLE "GrupoTalhao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "corMapa" TEXT,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrupoTalhao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoTalhaoItem" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,

    CONSTRAINT "GrupoTalhaoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Executor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoExecutor" NOT NULL,
    "contato" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Executor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtividadeTalhao" (
    "id" TEXT NOT NULL,
    "atividadeId" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "areaHa" DOUBLE PRECISION,
    "custoRateado" DOUBLE PRECISION,

    CONSTRAINT "AtividadeTalhao_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Atividade passa a ser multi-talhao, com executor e custo.
-- A tabela esta vazia (0 registros), entao remover talhaoId e seguro.
ALTER TABLE "Atividade" DROP CONSTRAINT IF EXISTS "Atividade_talhaoId_fkey";
DROP INDEX IF EXISTS "Atividade_talhaoId_idx";
ALTER TABLE "Atividade" DROP COLUMN IF EXISTS "talhaoId";
ALTER TABLE "Atividade" ADD COLUMN     "custoMaoDeObra" DOUBLE PRECISION,
ADD COLUMN     "executorId" TEXT;

-- AlterTable: Colheita ganha os dois momentos (campo e comercial).
-- Tabela vazia: troca de "quantidade/unidade" por "quantidadeCaixas".
ALTER TABLE "Colheita" DROP COLUMN IF EXISTS "quantidade";
ALTER TABLE "Colheita" DROP COLUMN IF EXISTS "unidade";
ALTER TABLE "Colheita" ADD COLUMN     "quantidadeCaixas" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "executorId" TEXT,
ADD COLUMN     "valorPorCaixa" DOUBLE PRECISION,
ADD COLUMN     "custoColheita" DOUBLE PRECISION,
ADD COLUMN     "origem" "OrigemLancamento" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "pesoTotalKg" DOUBLE PRECISION,
ADD COLUMN     "pesoRefugoKg" DOUBLE PRECISION,
ADD COLUMN     "valorTotalVenda" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "GrupoTalhao_propriedadeId_idx" ON "GrupoTalhao"("propriedadeId");
CREATE UNIQUE INDEX "GrupoTalhaoItem_grupoId_talhaoId_key" ON "GrupoTalhaoItem"("grupoId", "talhaoId");
CREATE INDEX "GrupoTalhaoItem_grupoId_idx" ON "GrupoTalhaoItem"("grupoId");
CREATE INDEX "GrupoTalhaoItem_talhaoId_idx" ON "GrupoTalhaoItem"("talhaoId");
CREATE INDEX "Executor_propriedadeId_idx" ON "Executor"("propriedadeId");
CREATE UNIQUE INDEX "AtividadeTalhao_atividadeId_talhaoId_key" ON "AtividadeTalhao"("atividadeId", "talhaoId");
CREATE INDEX "AtividadeTalhao_atividadeId_idx" ON "AtividadeTalhao"("atividadeId");
CREATE INDEX "AtividadeTalhao_talhaoId_idx" ON "AtividadeTalhao"("talhaoId");
CREATE INDEX "Atividade_executorId_idx" ON "Atividade"("executorId");
CREATE UNIQUE INDEX "Colheita_clientId_key" ON "Colheita"("clientId");
CREATE INDEX "Colheita_data_idx" ON "Colheita"("data");
CREATE INDEX "Colheita_executorId_idx" ON "Colheita"("executorId");

-- AddForeignKey
ALTER TABLE "GrupoTalhao" ADD CONSTRAINT "GrupoTalhao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrupoTalhaoItem" ADD CONSTRAINT "GrupoTalhaoItem_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoTalhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrupoTalhaoItem" ADD CONSTRAINT "GrupoTalhaoItem_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Executor" ADD CONSTRAINT "Executor_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtividadeTalhao" ADD CONSTRAINT "AtividadeTalhao_atividadeId_fkey" FOREIGN KEY ("atividadeId") REFERENCES "Atividade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtividadeTalhao" ADD CONSTRAINT "AtividadeTalhao_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "Executor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Colheita" ADD CONSTRAINT "Colheita_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "Executor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
