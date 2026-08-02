-- Leitura mensal de vigor por satelite, guardada no banco.
--
-- Antes, o Manejo Nutricional e a aba Satelite do talhao chamavam o Copernicus
-- AO VIVO toda vez que a tela abria - sete requisicoes so para ver uma pagina,
-- para um numero que so muda de mes em mes. A sincronizacao (POST
-- /satelite/sincronizar) passa a gravar aqui; as telas so leem.

-- CreateTable
CREATE TABLE "LeituraSatelite" (
    "id" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "periodo" TIMESTAMP(3) NOT NULL,
    "ndviMedio" DOUBLE PRECISION,
    "osaviMedio" DOUBLE PRECISION,
    "desvio" DOUBLE PRECISION,
    "pixels" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeituraSatelite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeituraSatelite_talhaoId_periodo_key" ON "LeituraSatelite"("talhaoId", "periodo");

-- CreateIndex
CREATE INDEX "LeituraSatelite_propriedadeId_idx" ON "LeituraSatelite"("propriedadeId");

-- CreateIndex
CREATE INDEX "LeituraSatelite_talhaoId_idx" ON "LeituraSatelite"("talhaoId");

-- AddForeignKey
ALTER TABLE "LeituraSatelite" ADD CONSTRAINT "LeituraSatelite_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeituraSatelite" ADD CONSTRAINT "LeituraSatelite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
