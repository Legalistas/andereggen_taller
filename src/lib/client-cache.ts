"use client";

/**
 * Perf audit · Cache module-level para los lookups quasi-estáticos que
 * varios componentes fetchean al montar (aseguradoras, cajas, proveedores).
 *
 * Antes: abrir la ficha de un lead + la de un repair + el módulo Compras
 * disparaba 3 fetches del mismo `/api/insurance-companies`. Ahora el primero
 * gana y el resto reusa (o se cuelga del promise en vuelo si coinciden).
 *
 * Generaliza el patrón que ya existía en `crm/vehicle-fields.tsx`.
 *
 * Scope: vive en memoria del tab, se pierde al recargar. Para invalidar
 * después de una mutación (crear proveedor, editar aseguradora) usar
 * `invalidateCache(key)`.
 */

type Entry = { value: unknown; expiresAt: number };

const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();

/** TTL default: 5 min. Suficiente para una sesión de trabajo sin quedar pegado. */
const DEFAULT_TTL_MS = 5 * 60_000;

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const inFlight = pending.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const p = fetcher()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, p);
  return p;
}

export function invalidateCache(key: string): void {
  cache.delete(key);
  pending.delete(key);
}

// ─────────────────────────────────────────────────────────────
// Lookups concretos
// ─────────────────────────────────────────────────────────────

export type InsuranceCompanyLite = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
};

export const INSURANCE_COMPANIES_KEY = "insurance-companies:active";

export function loadInsuranceCompanies(): Promise<InsuranceCompanyLite[]> {
  return cachedFetch(INSURANCE_COMPANIES_KEY, async () => {
    const res = await fetch("/api/insurance-companies?active=1");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const body = raw ? JSON.parse(raw) : {};
    return (body.companies ?? []) as InsuranceCompanyLite[];
  });
}

export type CashBoxLite = { id: string; name: string; key: string };

export const CASH_BOXES_KEY = "caja:boxes";

/**
 * Solo para poblar selects — el payload trae saldos pero acá no se usan.
 * TTL corto (60s) para que un select no muestre una caja recién archivada.
 */
export function loadCashBoxes(): Promise<CashBoxLite[]> {
  return cachedFetch(
    CASH_BOXES_KEY,
    async () => {
      const res = await fetch("/api/caja/boxes");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      const body = raw ? JSON.parse(raw) : {};
      return (body.boxes ?? []) as CashBoxLite[];
    },
    60_000,
  );
}

export type SupplierLite = { id: string; name: string; isActive: boolean };

export const SUPPLIERS_KEY = "suppliers:all";

export function loadSuppliers(): Promise<SupplierLite[]> {
  return cachedFetch(SUPPLIERS_KEY, async () => {
    const res = await fetch("/api/suppliers?pageSize=0");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const body = raw ? JSON.parse(raw) : {};
    return (body.suppliers ?? []) as SupplierLite[];
  });
}
