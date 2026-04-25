import type { PaymentMethod } from "../../generated/prisma/client";

export const PAYMENT_METHODS: {
  key: PaymentMethod;
  label: string;
  color: string;
}[] = [
  {
    key: "EFECTIVO",
    label: "Efectivo",
    color: "bg-green-500/10 text-green-700 border-green-200",
  },
  {
    key: "TRANSFERENCIA",
    label: "Transferencia",
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
  },
  {
    key: "CHEQUE",
    label: "Cheque",
    color: "bg-slate-500/10 text-slate-700 border-slate-200",
  },
  {
    key: "TARJETA",
    label: "Tarjeta",
    color: "bg-purple-500/10 text-purple-700 border-purple-200",
  },
  {
    key: "MERCADOPAGO",
    label: "MercadoPago",
    color: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
  },
  {
    key: "OTRO",
    label: "Otro",
    color: "bg-muted text-muted-foreground border-border",
  },
];

export const PAYMENT_METHOD_BY_KEY: Record<
  PaymentMethod,
  (typeof PAYMENT_METHODS)[number]
> = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.key, m])) as Record<
  PaymentMethod,
  (typeof PAYMENT_METHODS)[number]
>;

export type PaymentStatus = "paid" | "partial" | "pending";

export function paymentStatusFor(
  grandTotal: number,
  paid: number,
): PaymentStatus {
  if (paid <= 0) return "pending";
  if (paid >= grandTotal) return "paid";
  return "partial";
}

export const PAYMENT_STATUS_LABELS: Record<
  PaymentStatus,
  { label: string; color: string }
> = {
  paid: {
    label: "Pagado",
    color: "bg-green-500/10 text-green-700 border-green-200",
  },
  partial: {
    label: "Parcial",
    color: "bg-orange-500/10 text-orange-700 border-orange-200",
  },
  pending: {
    label: "Pendiente",
    color: "bg-red-500/10 text-red-700 border-red-200",
  },
};
