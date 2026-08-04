-- CreateEnum
CREATE TYPE "ModalidadePagamentoColheita" AS ENUM ('POR_CAIXA', 'POR_CAIXA_PESO');

-- AlterTable
ALTER TABLE "Executor" ADD COLUMN     "modalidadePagamentoColheita" "ModalidadePagamentoColheita" NOT NULL DEFAULT 'POR_CAIXA';
