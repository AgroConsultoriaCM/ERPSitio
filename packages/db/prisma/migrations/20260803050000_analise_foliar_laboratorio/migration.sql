-- AnaliseFoliar era o unico dos quatro modelos de analise sem coluna
-- laboratorio, e confirmar um laudo foliar quebrava com
-- "Unknown argument laboratorio" porque o codigo grava esse campo para
-- todo tipo de analise.
ALTER TABLE "AnaliseFoliar" ADD COLUMN "laboratorio" TEXT;
