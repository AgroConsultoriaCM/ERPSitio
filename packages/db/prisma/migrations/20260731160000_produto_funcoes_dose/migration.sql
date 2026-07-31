-- Produto passa a ter mais de uma funcao, e a guardar a dose de bula.
--
-- Um mesmo defensivo age como fungicida e acaricida. Com uma funcao so, o
-- controle de pragas registrava a aplicacao em apenas uma delas e o alerta da
-- outra continuava vencido sem motivo.

-- 1. Coluna nova, ja com valor para todo mundo (lista vazia).
ALTER TABLE "Insumo" ADD COLUMN "funcoes" "FuncaoInsumo"[] NOT NULL DEFAULT '{}';

-- 2. Leva o que existia: quem tinha uma funcao passa a ter uma lista de um.
UPDATE "Insumo" SET "funcoes" = ARRAY["funcao"] WHERE "funcao" IS NOT NULL;

-- 3. So entao remove a antiga. Nesta ordem nada se perde.
ALTER TABLE "Insumo" DROP COLUMN "funcao";

-- 4. O DEFAULT servia so para preencher as linhas existentes no passo 1. O
-- Prisma nao declara default em lista, e deixa-lo aqui faria o banco divergir
-- do schema desde a primeira aplicacao.
ALTER TABLE "Insumo" ALTER COLUMN "funcoes" DROP DEFAULT;

-- Dose de bula. A unidade acompanha a do proprio produto: produto em litros
-- guarda mL por 100 L e L por hectare; produto em quilos guarda gramas e
-- quilos. Sem campo de unidade separado, que sairia de sincronia.
ALTER TABLE "Insumo" ADD COLUMN "dosePor100L" DOUBLE PRECISION;
ALTER TABLE "Insumo" ADD COLUMN "dosePorHectare" DOUBLE PRECISION;
ALTER TABLE "Insumo" ADD COLUMN "observacoesDose" TEXT;
ALTER TABLE "Insumo" ADD COLUMN "fabricante" TEXT;
