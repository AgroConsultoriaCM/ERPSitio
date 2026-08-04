-- CreateEnum
CREATE TYPE "CategoriaDespesa" AS ENUM ('ADMINISTRATIVO', 'CONTABILIDADE', 'IMPOSTOS_TAXAS', 'MANUTENCAO', 'DEPRECIACAO', 'FRETE', 'OUTROS');

-- CreateTable
CREATE TABLE "AtividadePlanejada" (
    "id" TEXT NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "tipoAtividadeId" TEXT,
    "talhaoId" TEXT,
    "executorId" TEXT,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "concluidaEm" TIMESTAMP(3),
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtividadePlanejada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "talhaoId" TEXT,
    "categoria" "CategoriaDespesa" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "observacoes" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtividadePlanejada_propriedadeId_idx" ON "AtividadePlanejada"("propriedadeId");

-- CreateIndex
CREATE INDEX "AtividadePlanejada_data_idx" ON "AtividadePlanejada"("data");

-- CreateIndex
CREATE INDEX "AtividadePlanejada_talhaoId_idx" ON "AtividadePlanejada"("talhaoId");

-- CreateIndex
CREATE INDEX "Despesa_propriedadeId_idx" ON "Despesa"("propriedadeId");

-- CreateIndex
CREATE INDEX "Despesa_talhaoId_idx" ON "Despesa"("talhaoId");

-- CreateIndex
CREATE INDEX "Despesa_data_idx" ON "Despesa"("data");

-- AddForeignKey
ALTER TABLE "AtividadePlanejada" ADD CONSTRAINT "AtividadePlanejada_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtividadePlanejada" ADD CONSTRAINT "AtividadePlanejada_tipoAtividadeId_fkey" FOREIGN KEY ("tipoAtividadeId") REFERENCES "TipoAtividade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtividadePlanejada" ADD CONSTRAINT "AtividadePlanejada_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtividadePlanejada" ADD CONSTRAINT "AtividadePlanejada_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "Executor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtividadePlanejada" ADD CONSTRAINT "AtividadePlanejada_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
