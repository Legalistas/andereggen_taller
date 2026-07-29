/**
 * Types compartidos del módulo Compras (frontend).
 * Espejo del shape que devuelve /api/purchases.
 */

import type {
  PurchaseStatus,
  QuoteCategory,
} from "../../../generated/prisma/client";

export type PurchaseRow = {
  id: string;
  number: string;
  status: PurchaseStatus;
  category: QuoteCategory | null;
  supplierId: string | null;
  supplierName: string | null;
  amount: string | number;
  freightAmount: string | number;
  freightSupplierId: string | null;
  freightSupplierName: string | null;
  purchasedAt: string | null;
  receivedAt: string | null;
  archivedAt: string | null;
  paidPartsAt: string | null;
  paidPartsMovementId: string | null;
  paidFreightAt: string | null;
  paidFreightMovementId: string | null;
  receiptUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  item: {
    id: string;
    description: string;
    budget: {
      id: string;
      number: number;
      extensionSuffix: number | null;
      repair: {
        id: string;
        internalNumber: number | null;
        vehicleBrand: string;
        vehicleModel: string;
        vehicleDomain: string;
        customerName: string;
      } | null;
    } | null;
  };
  chosenQuote: {
    id: string;
    category: QuoteCategory;
    supplierName: string;
    price: string | number;
    discount: string | number | null;
    partCode: string | null;
  } | null;
  supplier: { id: string; name: string } | null;
  freightSupplier: { id: string; name: string } | null;
};

export type SupplierLite = { id: string; name: string; isActive: boolean };

export type CashBoxLite = { id: string; name: string; key: string };
