-- PerfilCorrecaoSolo passa a valer pela ESPECIE da cultura (culturaNome:
-- "Limao", "Abacate"), nao mais por uma Cultura especifica (que inclui
-- variedade - o sitio tem 4 variedades de limao e 2 de abacate cadastradas).
-- Producao ainda nao tinha nenhum perfil cadastrado, entao nao ha dado para
-- migrar - so trocar a coluna.
ALTER TABLE "PerfilCorrecaoSolo" DROP CONSTRAINT "PerfilCorrecaoSolo_culturaId_fkey";
DROP INDEX "PerfilCorrecaoSolo_culturaId_idx";
ALTER TABLE "PerfilCorrecaoSolo" DROP COLUMN "culturaId";
ALTER TABLE "PerfilCorrecaoSolo" ADD COLUMN "culturaNome" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PerfilCorrecaoSolo" ALTER COLUMN "culturaNome" DROP DEFAULT;
ALTER TABLE "PerfilCorrecaoSolo" ADD COLUMN "enxofreIdeal" DOUBLE PRECISION;
CREATE INDEX "PerfilCorrecaoSolo_culturaNome_idx" ON "PerfilCorrecaoSolo"("culturaNome");

-- Perfil de correcao FOLIAR: uma FAIXA (minimo e maximo) por nutriente, nao
-- um "ideal" so como no solo - e como a folha e interpretada na pratica.
CREATE TABLE "PerfilCorrecaoFoliar" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "culturaNome" TEXT NOT NULL,
    "nitrogenioIdealMin" DOUBLE PRECISION,
    "nitrogenioIdealMax" DOUBLE PRECISION,
    "fosforoIdealMin" DOUBLE PRECISION,
    "fosforoIdealMax" DOUBLE PRECISION,
    "potassioIdealMin" DOUBLE PRECISION,
    "potassioIdealMax" DOUBLE PRECISION,
    "calcioIdealMin" DOUBLE PRECISION,
    "calcioIdealMax" DOUBLE PRECISION,
    "magnesioIdealMin" DOUBLE PRECISION,
    "magnesioIdealMax" DOUBLE PRECISION,
    "enxofreIdealMin" DOUBLE PRECISION,
    "enxofreIdealMax" DOUBLE PRECISION,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilCorrecaoFoliar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PerfilCorrecaoFoliar_propriedadeId_idx" ON "PerfilCorrecaoFoliar"("propriedadeId");
CREATE INDEX "PerfilCorrecaoFoliar_culturaNome_idx" ON "PerfilCorrecaoFoliar"("culturaNome");

ALTER TABLE "PerfilCorrecaoFoliar" ADD CONSTRAINT "PerfilCorrecaoFoliar_propriedadeId_fkey"
  FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
