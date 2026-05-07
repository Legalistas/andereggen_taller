-- Agrega campos de detalle a las cotizaciones de la pestaña administrativa:
--   partCode      → código de repuesto declarado por el proveedor
--   discount      → descuento en porcentaje 0–100 (precio neto = price * (1 - discount/100))
--   availability  → texto libre ("En stock", "3 días", "Bajo pedido"…)
--   photos        → URLs de imágenes asociadas a la cotización
ALTER TABLE "BudgetAdminQuote"
  ADD COLUMN "partCode" TEXT,
  ADD COLUMN "discount" DECIMAL(5,2),
  ADD COLUMN "availability" TEXT,
  ADD COLUMN "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
