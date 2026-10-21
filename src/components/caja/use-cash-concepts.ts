"use client";

import { useEffect, useState } from "react";

export type CashConceptOption = { label: string; subs: string[] };

/**
 * Rubros de egreso activos, con sus subcategorías. Los usan el alta de
 * movimiento y las compras con tarjeta. Se administran en Configuración →
 * Rubros de caja.
 */
export function useCashConcepts(): CashConceptOption[] {
  const [concepts, setConcepts] = useState<CashConceptOption[]>([]);
  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/cash-concepts?active=1", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : { concepts: [] }))
      .then((b) =>
        setConcepts(
          (b.concepts ?? []).map(
            (c: { label: string; children: Array<{ label: string }> }) => ({
              label: c.label,
              subs: c.children.map((s) => s.label),
            }),
          ),
        ),
      )
      .catch(() => {});
    return () => ac.abort();
  }, []);
  return concepts;
}
