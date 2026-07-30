-- CreateTable
CREATE TABLE "SetorIrrigacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT,
    "areaHa" DOUBLE PRECISION,
    "poligono" JSONB,
    "corMapa" TEXT,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetorIrrigacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SetorIrrigacao_propriedadeId_idx" ON "SetorIrrigacao"("propriedadeId");

-- AddForeignKey
ALTER TABLE "SetorIrrigacao" ADD CONSTRAINT "SetorIrrigacao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
