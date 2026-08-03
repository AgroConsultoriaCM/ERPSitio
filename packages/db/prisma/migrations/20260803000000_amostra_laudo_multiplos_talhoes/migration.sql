-- Uma amostra de laudo pode valer para mais de um talhão (grid de amostragem
-- que cobre área maior que um talhão só) — troca a FK única "talhaoId" por
-- uma lista "talhaoIds". Os valores já confirmados são preservados antes de
-- a coluna antiga sair.
ALTER TABLE "AmostraLaudo" ADD COLUMN "talhaoIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "AmostraLaudo" SET "talhaoIds" = ARRAY["talhaoId"]::TEXT[] WHERE "talhaoId" IS NOT NULL;

ALTER TABLE "AmostraLaudo" DROP CONSTRAINT "AmostraLaudo_talhaoId_fkey";
DROP INDEX "AmostraLaudo_talhaoId_idx";
ALTER TABLE "AmostraLaudo" DROP COLUMN "talhaoId";
