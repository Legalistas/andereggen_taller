/**
 * Líneas de facturación del taller. Sin dependencias de servidor.
 *
 * Para análisis (KPIs, facturado) los importes van SIN IVA: la Línea 1
 * (factura oficial A/B) se carga con el 21% incluido y se descuenta; la
 * Línea 2 (efectivo o monotributo) no lleva IVA y va tal cual.
 */
import type { InvoiceLine } from "../../generated/prisma/client";
import { DEFAULT_IVA_RATE } from "./budget-catalog";

export const INVOICE_LINES: {
  value: InvoiceLine;
  label: string;
  hint: string;
}[] = [
  { value: "LINEA_1", label: "Línea 1", hint: "Factura oficial, con IVA" },
  {
    value: "LINEA_2",
    label: "Línea 2",
    hint: "Efectivo / monotributo, sin IVA",
  },
];

export function netOfIva(amount: number, line: InvoiceLine): number {
  return line === "LINEA_1" ? amount / (1 + DEFAULT_IVA_RATE / 100) : amount;
}
