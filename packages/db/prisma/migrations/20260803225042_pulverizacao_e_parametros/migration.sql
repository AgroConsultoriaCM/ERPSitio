-- CreateTable
CREATE TABLE "ParametroPulverizacao" (
    "id" TEXT NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "chuvaMmZero" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "chuvaProbPctZero" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "ventoIdealMinKmh" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "ventoIdealMaxKmh" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "ventoZeroBaixoKmh" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ventoZeroAltoKmh" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "umidadeIdealMinPct" DOUBLE PRECISION NOT NULL DEFAULT 55,
    "umidadeZeroPct" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "kcCultura" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametroPulverizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilBomba" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "capacidadeLitros" DOUBLE PRECISION NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilBomba_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calda" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaldaItem" (
    "id" TEXT NOT NULL,
    "caldaId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "dosePor100L" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CaldaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroPulverizacao" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "bombaId" TEXT NOT NULL,
    "numeroCargas" DOUBLE PRECISION NOT NULL,
    "volumeTotalLitros" DOUBLE PRECISION NOT NULL,
    "caldaId" TEXT,
    "caldaAdHoc" JSONB,
    "atividadeId" TEXT NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroPulverizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroPulverizacaoTalhao" (
    "id" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "metrosLineares" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RegistroPulverizacaoTalhao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParametroPulverizacao_propriedadeId_key" ON "ParametroPulverizacao"("propriedadeId");

-- CreateIndex
CREATE INDEX "PerfilBomba_propriedadeId_idx" ON "PerfilBomba"("propriedadeId");

-- CreateIndex
CREATE INDEX "Calda_propriedadeId_idx" ON "Calda"("propriedadeId");

-- CreateIndex
CREATE INDEX "CaldaItem_caldaId_idx" ON "CaldaItem"("caldaId");

-- CreateIndex
CREATE INDEX "CaldaItem_insumoId_idx" ON "CaldaItem"("insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroPulverizacao_atividadeId_key" ON "RegistroPulverizacao"("atividadeId");

-- CreateIndex
CREATE INDEX "RegistroPulverizacao_propriedadeId_idx" ON "RegistroPulverizacao"("propriedadeId");

-- CreateIndex
CREATE INDEX "RegistroPulverizacao_data_idx" ON "RegistroPulverizacao"("data");

-- CreateIndex
CREATE INDEX "RegistroPulverizacaoTalhao_talhaoId_idx" ON "RegistroPulverizacaoTalhao"("talhaoId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroPulverizacaoTalhao_registroId_talhaoId_key" ON "RegistroPulverizacaoTalhao"("registroId", "talhaoId");

-- AddForeignKey
ALTER TABLE "ParametroPulverizacao" ADD CONSTRAINT "ParametroPulverizacao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilBomba" ADD CONSTRAINT "PerfilBomba_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calda" ADD CONSTRAINT "Calda_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaldaItem" ADD CONSTRAINT "CaldaItem_caldaId_fkey" FOREIGN KEY ("caldaId") REFERENCES "Calda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaldaItem" ADD CONSTRAINT "CaldaItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPulverizacao" ADD CONSTRAINT "RegistroPulverizacao_bombaId_fkey" FOREIGN KEY ("bombaId") REFERENCES "PerfilBomba"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPulverizacao" ADD CONSTRAINT "RegistroPulverizacao_caldaId_fkey" FOREIGN KEY ("caldaId") REFERENCES "Calda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPulverizacao" ADD CONSTRAINT "RegistroPulverizacao_atividadeId_fkey" FOREIGN KEY ("atividadeId") REFERENCES "Atividade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPulverizacao" ADD CONSTRAINT "RegistroPulverizacao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPulverizacaoTalhao" ADD CONSTRAINT "RegistroPulverizacaoTalhao_registroId_fkey" FOREIGN KEY ("registroId") REFERENCES "RegistroPulverizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPulverizacaoTalhao" ADD CONSTRAINT "RegistroPulverizacaoTalhao_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
