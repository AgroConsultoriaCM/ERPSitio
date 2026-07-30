-- CreateEnum
CREATE TYPE "RolePapel" AS ENUM ('ADMIN', 'GERENTE', 'ENCARREGADO');

-- CreateEnum
CREATE TYPE "StatusTalhao" AS ENUM ('EM_FORMACAO', 'ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "OrigemLancamento" AS ENUM ('WEB', 'APP');

-- CreateEnum
CREATE TYPE "CategoriaInsumo" AS ENUM ('DEFENSIVO', 'FERTILIZANTE', 'EMBALAGEM', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoMovimentacaoEstoque" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "OrigemMovimentacaoEstoque" AS ENUM ('COMPRA', 'USO_ATIVIDADE', 'AJUSTE', 'OUTRO');

-- CreateTable
CREATE TABLE "Propriedade" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "localizacao" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Propriedade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "RolePapel" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cultura" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "variedade" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cultura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talhao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT,
    "areaHa" DOUBLE PRECISION,
    "culturaId" TEXT,
    "dataPlantio" TIMESTAMP(3),
    "status" "StatusTalhao" NOT NULL DEFAULT 'ATIVO',
    "poligono" JSONB,
    "corMapa" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Talhao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Safra" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Safra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoAtividade" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoAtividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atividade" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "observacoes" TEXT,
    "origem" "OrigemLancamento" NOT NULL DEFAULT 'WEB',
    "propriedadeId" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "tipoAtividadeId" TEXT NOT NULL,
    "safraId" TEXT,
    "responsavelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtividadeInsumo" (
    "id" TEXT NOT NULL,
    "atividadeId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtividadeInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "CategoriaInsumo" NOT NULL DEFAULT 'OUTRO',
    "unidadeMedida" TEXT NOT NULL,
    "estoqueMinimo" DOUBLE PRECISION,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" "TipoMovimentacaoEstoque" NOT NULL,
    "origem" "OrigemMovimentacaoEstoque" NOT NULL DEFAULT 'OUTRO',
    "quantidade" DOUBLE PRECISION NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "observacoes" TEXT,
    "atividadeId" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colheita" (
    "id" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "safraId" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT NOT NULL,
    "classificacao" TEXT,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colheita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilCorrecaoSolo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "culturaId" TEXT NOT NULL,
    "phIdealMin" DOUBLE PRECISION,
    "phIdealMax" DOUBLE PRECISION,
    "materiaOrganicaIdeal" DOUBLE PRECISION,
    "fosforoIdeal" DOUBLE PRECISION,
    "potassioIdeal" DOUBLE PRECISION,
    "calcioIdeal" DOUBLE PRECISION,
    "magnesioIdeal" DOUBLE PRECISION,
    "saturacaoBasesIdeal" DOUBLE PRECISION,
    "ctcReferencia" DOUBLE PRECISION,
    "micronutrientesIdeais" JSONB,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilCorrecaoSolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnaliseSolo" (
    "id" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "dataColeta" TIMESTAMP(3) NOT NULL,
    "profundidadeCm" DOUBLE PRECISION,
    "laboratorio" TEXT,
    "ph" DOUBLE PRECISION,
    "materiaOrganica" DOUBLE PRECISION,
    "fosforo" DOUBLE PRECISION,
    "potassio" DOUBLE PRECISION,
    "calcio" DOUBLE PRECISION,
    "magnesio" DOUBLE PRECISION,
    "aluminio" DOUBLE PRECISION,
    "hAl" DOUBLE PRECISION,
    "somaBases" DOUBLE PRECISION,
    "ctc" DOUBLE PRECISION,
    "saturacaoBases" DOUBLE PRECISION,
    "micronutrientes" JSONB,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnaliseSolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnaliseFoliar" (
    "id" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "dataColeta" TIMESTAMP(3) NOT NULL,
    "estadioFenologico" TEXT,
    "nitrogenio" DOUBLE PRECISION,
    "fosforo" DOUBLE PRECISION,
    "potassio" DOUBLE PRECISION,
    "calcio" DOUBLE PRECISION,
    "magnesio" DOUBLE PRECISION,
    "enxofre" DOUBLE PRECISION,
    "micronutrientes" JSONB,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnaliseFoliar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_propriedadeId_idx" ON "Usuario"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_usuarioId_idx" ON "RefreshToken"("usuarioId");

-- CreateIndex
CREATE INDEX "Cultura_propriedadeId_idx" ON "Cultura"("propriedadeId");

-- CreateIndex
CREATE INDEX "Talhao_propriedadeId_idx" ON "Talhao"("propriedadeId");

-- CreateIndex
CREATE INDEX "Talhao_culturaId_idx" ON "Talhao"("culturaId");

-- CreateIndex
CREATE INDEX "Safra_talhaoId_idx" ON "Safra"("talhaoId");

-- CreateIndex
CREATE INDEX "TipoAtividade_propriedadeId_idx" ON "TipoAtividade"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "Atividade_clientId_key" ON "Atividade"("clientId");

-- CreateIndex
CREATE INDEX "Atividade_propriedadeId_idx" ON "Atividade"("propriedadeId");

-- CreateIndex
CREATE INDEX "Atividade_talhaoId_idx" ON "Atividade"("talhaoId");

-- CreateIndex
CREATE INDEX "Atividade_data_idx" ON "Atividade"("data");

-- CreateIndex
CREATE INDEX "AtividadeInsumo_atividadeId_idx" ON "AtividadeInsumo"("atividadeId");

-- CreateIndex
CREATE INDEX "AtividadeInsumo_insumoId_idx" ON "AtividadeInsumo"("insumoId");

-- CreateIndex
CREATE INDEX "Insumo_propriedadeId_idx" ON "Insumo"("propriedadeId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_propriedadeId_idx" ON "MovimentacaoEstoque"("propriedadeId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_insumoId_idx" ON "MovimentacaoEstoque"("insumoId");

-- CreateIndex
CREATE INDEX "Colheita_propriedadeId_idx" ON "Colheita"("propriedadeId");

-- CreateIndex
CREATE INDEX "Colheita_talhaoId_idx" ON "Colheita"("talhaoId");

-- CreateIndex
CREATE INDEX "PerfilCorrecaoSolo_propriedadeId_idx" ON "PerfilCorrecaoSolo"("propriedadeId");

-- CreateIndex
CREATE INDEX "PerfilCorrecaoSolo_culturaId_idx" ON "PerfilCorrecaoSolo"("culturaId");

-- CreateIndex
CREATE INDEX "AnaliseSolo_propriedadeId_idx" ON "AnaliseSolo"("propriedadeId");

-- CreateIndex
CREATE INDEX "AnaliseSolo_talhaoId_idx" ON "AnaliseSolo"("talhaoId");

-- CreateIndex
CREATE INDEX "AnaliseSolo_dataColeta_idx" ON "AnaliseSolo"("dataColeta");

-- CreateIndex
CREATE INDEX "AnaliseFoliar_propriedadeId_idx" ON "AnaliseFoliar"("propriedadeId");

-- CreateIndex
CREATE INDEX "AnaliseFoliar_talhaoId_idx" ON "AnaliseFoliar"("talhaoId");

-- CreateIndex
CREATE INDEX "AnaliseFoliar_dataColeta_idx" ON "AnaliseFoliar"("dataColeta");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cultura" ADD CONSTRAINT "Cultura_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talhao" ADD CONSTRAINT "Talhao_culturaId_fkey" FOREIGN KEY ("culturaId") REFERENCES "Cultura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talhao" ADD CONSTRAINT "Talhao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Safra" ADD CONSTRAINT "Safra_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipoAtividade" ADD CONSTRAINT "TipoAtividade_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_tipoAtividadeId_fkey" FOREIGN KEY ("tipoAtividadeId") REFERENCES "TipoAtividade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtividadeInsumo" ADD CONSTRAINT "AtividadeInsumo_atividadeId_fkey" FOREIGN KEY ("atividadeId") REFERENCES "Atividade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtividadeInsumo" ADD CONSTRAINT "AtividadeInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_atividadeId_fkey" FOREIGN KEY ("atividadeId") REFERENCES "Atividade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colheita" ADD CONSTRAINT "Colheita_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colheita" ADD CONSTRAINT "Colheita_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colheita" ADD CONSTRAINT "Colheita_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilCorrecaoSolo" ADD CONSTRAINT "PerfilCorrecaoSolo_culturaId_fkey" FOREIGN KEY ("culturaId") REFERENCES "Cultura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilCorrecaoSolo" ADD CONSTRAINT "PerfilCorrecaoSolo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnaliseSolo" ADD CONSTRAINT "AnaliseSolo_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnaliseSolo" ADD CONSTRAINT "AnaliseSolo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnaliseFoliar" ADD CONSTRAINT "AnaliseFoliar_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnaliseFoliar" ADD CONSTRAINT "AnaliseFoliar_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
