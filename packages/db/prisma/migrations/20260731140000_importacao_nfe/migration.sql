-- Entrada de estoque por NF-e.
--
-- So leitura do XML: nada e emitido, transmitido ou escriturado. A nota segue
-- o fluxo normal dela com o contador. O que se cria aqui e gerencial - lote de
-- estoque com custo real, que depois alimenta o custo por talhao.

CREATE TYPE "OrigemNota" AS ENUM ('ANEXO_MANUAL', 'EMAIL');
CREATE TYPE "SituacaoNota" AS ENUM ('PENDENTE', 'IMPORTADA', 'IGNORADA');

-- Documento do produtor, para avisar quando a nota foi emitida para outra
-- pessoa (nota de vizinho que caiu no mesmo e-mail).
ALTER TABLE "Propriedade" ADD COLUMN "documento" TEXT;

CREATE TABLE "NotaFiscalEntrada" (
    "id" TEXT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "cnpjEmitente" TEXT NOT NULL,
    "nomeEmitente" TEXT NOT NULL,
    -- CNPJ ou CPF: a mesma caixa recebe notas de mais de uma pessoa juridica
    -- da familia, e so as da propriedade devem virar estoque.
    "documentoDestinatario" TEXT,
    "nomeDestinatario" TEXT,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "xmlOriginal" TEXT NOT NULL,
    "origem" "OrigemNota" NOT NULL DEFAULT 'ANEXO_MANUAL',
    "situacao" "SituacaoNota" NOT NULL DEFAULT 'PENDENTE',
    "importadaEm" TIMESTAMP(3),
    "importadaPorId" TEXT,
    "observacoes" TEXT,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaFiscalEntrada_pkey" PRIMARY KEY ("id")
);

-- A chave de acesso tem 44 digitos e e unica por definicao. E este indice que
-- impede importar a mesma nota duas vezes e dobrar o estoque em silencio.
CREATE UNIQUE INDEX "NotaFiscalEntrada_chaveAcesso_key" ON "NotaFiscalEntrada"("chaveAcesso");
CREATE INDEX "NotaFiscalEntrada_propriedadeId_situacao_idx" ON "NotaFiscalEntrada"("propriedadeId", "situacao");
CREATE INDEX "NotaFiscalEntrada_cnpjEmitente_idx" ON "NotaFiscalEntrada"("cnpjEmitente");
CREATE INDEX "NotaFiscalEntrada_dataEmissao_idx" ON "NotaFiscalEntrada"("dataEmissao");

-- O que o sistema aprende sobre o catalogo de cada fornecedor.
--
-- A nota diz "ZAPP QI 620 20 L BRA", codigo 462, unidade BD. O cadastro diz
-- "Zapp QI", em litros. Guardado o mapeamento com fator 20, os 3 BD da
-- proxima nota viram 60 L sozinhos. Sem o fator, o custo por talhao erraria
-- por um fator de 20.
CREATE TABLE "MapeamentoProdutoNota" (
    "id" TEXT NOT NULL,
    "cnpjEmitente" TEXT NOT NULL,
    "codigoProduto" TEXT NOT NULL,
    "descricaoNota" TEXT NOT NULL,
    "unidadeNota" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "fatorConversao" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapeamentoProdutoNota_pkey" PRIMARY KEY ("id")
);

-- Nome encurtado de proposito: o Postgres corta identificador em 63
-- caracteres, e o nome "obvio" truncado nao bate com o que o Prisma espera -
-- o que faz o banco divergir do schema logo na primeira migration.
CREATE UNIQUE INDEX "MapeamentoProdutoNota_propriedadeId_cnpjEmitente_codigoProd_key"
    ON "MapeamentoProdutoNota"("propriedadeId", "cnpjEmitente", "codigoProduto");
CREATE INDEX "MapeamentoProdutoNota_insumoId_idx" ON "MapeamentoProdutoNota"("insumoId");

-- Rastreio: de qual nota este lote veio.
ALTER TABLE "LoteInsumo" ADD COLUMN "notaFiscalId" TEXT;
CREATE INDEX "LoteInsumo_notaFiscalId_idx" ON "LoteInsumo"("notaFiscalId");

ALTER TABLE "NotaFiscalEntrada" ADD CONSTRAINT "NotaFiscalEntrada_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Sem cascata: apagar um usuario nao pode levar junto a nota que ele importou.
ALTER TABLE "NotaFiscalEntrada" ADD CONSTRAINT "NotaFiscalEntrada_importadaPorId_fkey"
    FOREIGN KEY ("importadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MapeamentoProdutoNota" ADD CONSTRAINT "MapeamentoProdutoNota_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapeamentoProdutoNota" ADD CONSTRAINT "MapeamentoProdutoNota_insumoId_fkey"
    FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sem cascata: o lote e o estoque continuam valendo mesmo que a nota
-- importada seja removida do historico.
ALTER TABLE "LoteInsumo" ADD CONSTRAINT "LoteInsumo_notaFiscalId_fkey"
    FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscalEntrada"("id") ON DELETE SET NULL ON UPDATE CASCADE;
