-- CreateTable
CREATE TABLE "RegaNoturnaConfig" (
    "id" TEXT NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL DEFAULT '21:00',
    "horaFim" TEXT NOT NULL DEFAULT '05:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegaNoturnaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespostaColheitaHoje" (
    "id" TEXT NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "resposta" BOOLEAN NOT NULL,
    "respondidoPorId" TEXT NOT NULL,
    "respondidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RespostaColheitaHoje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushInscricao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "authKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushInscricao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegaNoturnaConfig_propriedadeId_key" ON "RegaNoturnaConfig"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "RespostaColheitaHoje_propriedadeId_data_key" ON "RespostaColheitaHoje"("propriedadeId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "PushInscricao_endpoint_key" ON "PushInscricao"("endpoint");

-- CreateIndex
CREATE INDEX "PushInscricao_usuarioId_idx" ON "PushInscricao"("usuarioId");

-- AddForeignKey
ALTER TABLE "RegaNoturnaConfig" ADD CONSTRAINT "RegaNoturnaConfig_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaColheitaHoje" ADD CONSTRAINT "RespostaColheitaHoje_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaColheitaHoje" ADD CONSTRAINT "RespostaColheitaHoje_respondidoPorId_fkey" FOREIGN KEY ("respondidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushInscricao" ADD CONSTRAINT "PushInscricao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
