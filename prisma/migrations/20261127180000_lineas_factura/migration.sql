-- CreateEnum
CREATE TYPE "InvoiceLine" AS ENUM ('LINEA_1', 'LINEA_2');

-- AlterTable
ALTER TABLE "RepairInvoice" ADD COLUMN     "line" "InvoiceLine" NOT NULL DEFAULT 'LINEA_1';


-- Facturas ya cargadas: Línea 2 las que tienen cobros y TODOS fueron a Caja 2
-- (la "línea negra"). El resto queda Línea 1; las de cobros mezclados se
-- revisan a mano en el canvas.
UPDATE "RepairInvoice" ri SET "line" = 'LINEA_2'
WHERE EXISTS (SELECT 1 FROM "RepairInvoicePayment" p WHERE p."invoiceId" = ri.id)
  AND NOT EXISTS (
    SELECT 1 FROM "RepairInvoicePayment" p
    LEFT JOIN "CashBox" cb ON cb.id = p."cashBoxId"
    WHERE p."invoiceId" = ri.id AND (cb.key IS NULL OR cb.key <> 'caja_2')
  );
