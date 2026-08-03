-- Guarda a conversão de unidade aplicada (ou a unidade estranha que não deu
-- para converter) em cada amostra, ao ler o laudo. Vazio nos laudos que já
-- vieram na unidade padrão do laboratório Athenas — o caso normal.
ALTER TABLE "AmostraLaudo" ADD COLUMN "avisosUnidade" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
