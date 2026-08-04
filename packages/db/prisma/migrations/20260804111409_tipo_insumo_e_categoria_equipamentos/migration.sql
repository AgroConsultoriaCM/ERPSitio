-- CreateEnum
CREATE TYPE "TipoInsumo" AS ENUM ('INSUMO', 'BEM');

-- AlterEnum
ALTER TYPE "CategoriaDespesa" ADD VALUE 'EQUIPAMENTOS';

-- AlterTable
ALTER TABLE "Insumo" ADD COLUMN     "tipo" "TipoInsumo" NOT NULL DEFAULT 'INSUMO';
