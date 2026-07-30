-- CreateTable
CREATE TABLE "PermissaoPapel" (
    "id" TEXT NOT NULL,
    "papel" "RolePapel" NOT NULL,
    "modulo" TEXT NOT NULL,
    "podeVer" BOOLEAN NOT NULL DEFAULT false,
    "podeEditar" BOOLEAN NOT NULL DEFAULT false,
    "propriedadeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissaoPapel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermissaoPapel_propriedadeId_papel_modulo_key" ON "PermissaoPapel"("propriedadeId", "papel", "modulo");
CREATE INDEX "PermissaoPapel_propriedadeId_idx" ON "PermissaoPapel"("propriedadeId");

-- AddForeignKey
ALTER TABLE "PermissaoPapel" ADD CONSTRAINT "PermissaoPapel_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
