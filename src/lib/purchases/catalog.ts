/**
 * Catálogo de estados del módulo Compras — spec Compras v2.
 *
 * 7 estados que forman los tabs del módulo. La transición NO tiene
 * guardias en el enum: el brief pide que la compra pueda retroceder
 * (devoluciones/recompras), así que cualquier estado → cualquier estado
 * es válido desde el UI.
 */

import type { PurchaseStatus } from "../../../generated/prisma/client";

export type PurchaseStatusMeta = {
  key: PurchaseStatus;
  label: string;
  description: string;
  order: number;
  /** Color del badge (Tailwind). Base para el tab activo y para la celda
   *  de estado en la tabla. */
  tone: {
    bg: string;
    text: string;
    dot: string;
  };
};

export const PURCHASE_STATUS_META: Record<PurchaseStatus, PurchaseStatusMeta> = {
  COTIZAR: {
    key: "COTIZAR",
    label: "Cotizar",
    description: "Se cargan los repuestos a reemplazar y sus cotizaciones.",
    order: 1,
    tone: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
  },
  DECIDIR: {
    key: "DECIDIR",
    label: "Decidir",
    description:
      "Cotizaciones listas. Falta elegir cuál se compra (checkbox).",
    order: 2,
    tone: {
      bg: "bg-violet-100",
      text: "text-violet-700",
      dot: "bg-violet-500",
    },
  },
  COMPRAR: {
    key: "COMPRAR",
    label: "Comprar",
    description:
      "Cotización elegida — hay que gestionar la compra con el proveedor.",
    order: 3,
    tone: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  },
  EN_CAMINO: {
    key: "EN_CAMINO",
    label: "En camino",
    description: "La compra se efectuó y la pieza está en tránsito.",
    order: 4,
    tone: {
      bg: "bg-amber-100",
      text: "text-amber-700",
      dot: "bg-amber-500",
    },
  },
  EN_TALLER: {
    key: "EN_TALLER",
    label: "En taller",
    description:
      "Repuesto recibido. Fecha de recepción vinculada a 'Repuestos recibidos' de Producción.",
    order: 5,
    tone: { bg: "bg-cyan-100", text: "text-cyan-700", dot: "bg-cyan-500" },
  },
  PENDIENTE_PAGO: {
    key: "PENDIENTE_PAGO",
    label: "Pendiente de pago",
    description: "Llegó pero todavía no se pagó (repuesto y/o flete).",
    order: 6,
    tone: {
      bg: "bg-orange-100",
      text: "text-orange-700",
      dot: "bg-orange-500",
    },
  },
  ARCHIVADA: {
    key: "ARCHIVADA",
    label: "Archivada",
    description: "Compra cerrada.",
    order: 7,
    tone: {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
    },
  },
};

/** Orden canónico de tabs. */
export const PURCHASE_STATUSES_IN_ORDER: PurchaseStatus[] = Object.values(
  PURCHASE_STATUS_META,
)
  .sort((a, b) => a.order - b.order)
  .map((m) => m.key);

export const PURCHASE_STATUS_KEYS = new Set<PurchaseStatus>(
  PURCHASE_STATUSES_IN_ORDER,
);
