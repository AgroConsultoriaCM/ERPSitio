-- Importacao de laudos de laboratorio.
--
-- Mesmo ciclo das notas fiscais, que ja funciona e o produtor conhece: o
-- arquivo chega PENDENTE, ele confere os numeros, decide a que talhao (ou lote
-- de composto) cada amostra pertence, e so entao vira analise. Pode tambem
-- ignorar - laudo de outra propriedade, duplicado, enviado por engano.
--
-- Um arquivo traz VARIAS amostras: o laudo de marco/2022 tem 4, o de folha tem
-- 7. Por isso a fila de conferencia lista amostras, nao arquivos.

-- CreateEnum
CREATE TYPE "TipoLaudo" AS ENUM ('QUIMICA', 'FISICA', 'MICRO', 'FOLIAR', 'ORGANICO');

-- CreateEnum
CREATE TYPE "SituacaoLaudo" AS ENUM ('PENDENTE', 'IMPORTADO', 'IGNORADO');

-- CreateTable
CREATE TABLE "LaudoImportado" (
    "id" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tipo" "TipoLaudo" NOT NULL,
    "situacao" "SituacaoLaudo" NOT NULL DEFAULT 'PENDENTE',
    "cliente" TEXT,
    "material" TEXT,
    "dataColeta" TIMESTAMP(3),
    "digitacaoManual" BOOLEAN NOT NULL DEFAULT false,
    "textoExtraido" TEXT,
    "importadoEm" TIMESTAMP(3),
    "importadoPorId" TEXT,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaudoImportado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmostraLaudo" (
    "id" TEXT NOT NULL,
    "laudoId" TEXT NOT NULL,
    "codigoLaboratorio" TEXT,
    "identificacao" TEXT,
    "profundidade" TEXT,
    "valores" JSONB NOT NULL,
    "naoReconhecidas" TEXT[],
    "talhaoId" TEXT,
    "loteCompostoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmostraLaudo_pkey" PRIMARY KEY ("id")
);

-- CreateTable: fisica do solo. Separada da quimica porque granulometria NAO
-- muda de ano para ano - uma vez medida, vale para o talhao. Coluna propria e
-- nao Json porque argila entra em calculo de adubacao, e Json nao entra em
-- conta nem em filtro.
CREATE TABLE "AnaliseFisicaSolo" (
    "id" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "dataColeta" TIMESTAMP(3) NOT NULL,
    "profundidadeCm" TEXT,
    "laboratorio" TEXT,
    "argila" DOUBLE PRECISION,
    "silte" DOUBLE PRECISION,
    "areiaTotal" DOUBLE PRECISION,
    "areiaMuitoGrossa" DOUBLE PRECISION,
    "areiaGrossa" DOUBLE PRECISION,
    "areiaMedia" DOUBLE PRECISION,
    "areiaFina" DOUBLE PRECISION,
    "areiaMuitoFina" DOUBLE PRECISION,
    "argilaDispersaAgua" DOUBLE PRECISION,
    "grauFloculacao" DOUBLE PRECISION,
    "grauDispersao" DOUBLE PRECISION,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnaliseFisicaSolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lote de composto/esterco produzido na propriedade.
-- Com insumoId preenchido, o lote virou item de estoque e a aplicacao no pomar
-- segue o caminho normal de adubacao. Sem ele, e so registro da analise.
CREATE TABLE "LoteComposto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataProducao" TIMESTAMP(3),
    "origem" TEXT,
    "observacoes" TEXT,
    "insumoId" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoteComposto_pkey" PRIMARY KEY ("id")
);

-- CreateTable: analise do composto. Unidades em percentual, nao mmolc/dm3:
-- material solido concentrado, nao solo.
CREATE TABLE "AnaliseComposto" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "dataColeta" TIMESTAMP(3) NOT NULL,
    "laboratorio" TEXT,
    "materiaOrganica" DOUBLE PRECISION,
    "carbonoOrganico" DOUBLE PRECISION,
    "nitrogenio" DOUBLE PRECISION,
    "p2o5Total" DOUBLE PRECISION,
    "k2o" DOUBLE PRECISION,
    "calcio" DOUBLE PRECISION,
    "magnesio" DOUBLE PRECISION,
    "enxofre" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "umidade" DOUBLE PRECISION,
    "relacaoCN" DOUBLE PRECISION,
    "micronutrientes" JSONB,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnaliseComposto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaudoImportado_propriedadeId_situacao_idx" ON "LaudoImportado"("propriedadeId", "situacao");
CREATE INDEX "LaudoImportado_tipo_idx" ON "LaudoImportado"("tipo");
CREATE INDEX "AmostraLaudo_laudoId_idx" ON "AmostraLaudo"("laudoId");
CREATE INDEX "AmostraLaudo_talhaoId_idx" ON "AmostraLaudo"("talhaoId");
CREATE INDEX "AmostraLaudo_loteCompostoId_idx" ON "AmostraLaudo"("loteCompostoId");
CREATE INDEX "AnaliseFisicaSolo_propriedadeId_idx" ON "AnaliseFisicaSolo"("propriedadeId");
CREATE INDEX "AnaliseFisicaSolo_talhaoId_idx" ON "AnaliseFisicaSolo"("talhaoId");
CREATE INDEX "LoteComposto_propriedadeId_idx" ON "LoteComposto"("propriedadeId");
CREATE INDEX "LoteComposto_insumoId_idx" ON "LoteComposto"("insumoId");
CREATE INDEX "AnaliseComposto_propriedadeId_idx" ON "AnaliseComposto"("propriedadeId");
CREATE INDEX "AnaliseComposto_loteId_idx" ON "AnaliseComposto"("loteId");

-- AddForeignKey
ALTER TABLE "LaudoImportado" ADD CONSTRAINT "LaudoImportado_importadoPorId_fkey" FOREIGN KEY ("importadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LaudoImportado" ADD CONSTRAINT "LaudoImportado_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AmostraLaudo" ADD CONSTRAINT "AmostraLaudo_laudoId_fkey" FOREIGN KEY ("laudoId") REFERENCES "LaudoImportado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AmostraLaudo" ADD CONSTRAINT "AmostraLaudo_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AmostraLaudo" ADD CONSTRAINT "AmostraLaudo_loteCompostoId_fkey" FOREIGN KEY ("loteCompostoId") REFERENCES "LoteComposto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnaliseFisicaSolo" ADD CONSTRAINT "AnaliseFisicaSolo_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnaliseFisicaSolo" ADD CONSTRAINT "AnaliseFisicaSolo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoteComposto" ADD CONSTRAINT "LoteComposto_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoteComposto" ADD CONSTRAINT "LoteComposto_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnaliseComposto" ADD CONSTRAINT "AnaliseComposto_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteComposto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnaliseComposto" ADD CONSTRAINT "AnaliseComposto_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
