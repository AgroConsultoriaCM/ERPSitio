-- Guarda a linha original do OCR quando o sistema consegue separar
-- codigo/identificacao/profundidade automaticamente de um PDF, para mostrar
-- ao lado dos campos na digitacao manual.
ALTER TABLE "AmostraLaudo" ADD COLUMN "linhaOriginal" TEXT;
