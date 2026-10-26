-- spec 13 · Facturas de compra importadas de ARCA ("Mis Comprobantes Recibidos")
-- y CUIT / código de cuenta corriente en los proveedores. Solo agrega.

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "accountCode" TEXT,
ADD COLUMN     "cuit" TEXT;

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT,
    "issuerCuit" TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "typeCode" INTEGER NOT NULL,
    "typeName" TEXT NOT NULL,
    "pointOfSale" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "cae" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PES',
    "exchangeRate" DECIMAL(14,6) NOT NULL DEFAULT 1,
    "netTaxed" DECIMAL(14,2) NOT NULL,
    "netUntaxed" DECIMAL(14,2) NOT NULL,
    "exempt" DECIMAL(14,2) NOT NULL,
    "otherTaxes" DECIMAL(14,2) NOT NULL,
    "iva" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "importedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierInvoice_date_idx" ON "SupplierInvoice"("date");

-- CreateIndex
CREATE INDEX "SupplierInvoice_supplierId_idx" ON "SupplierInvoice"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_issuerCuit_typeCode_pointOfSale_number_key" ON "SupplierInvoice"("issuerCuit", "typeCode", "pointOfSale", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_cuit_key" ON "Supplier"("cuit");

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

