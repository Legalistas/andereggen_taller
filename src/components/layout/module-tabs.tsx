"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type ModuleTab = {
  label: string;
  href: string;
  icon?: LucideIcon;
};

/**
 * Barra de navegación secundaria para las sub-rutas de cada módulo.
 * Ej: dentro de Cotizaciones → Kanban · Presupuestos · Seguimiento.
 */
export function ModuleTabs({ tabs }: { tabs: ModuleTab[] }) {
  const pathname = usePathname();
  const activeHref = pickActive(pathname, tabs);

  return (
    <div className="border-b border-slate-200 mb-6">
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.href === activeHref;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-[#003b73] text-[#003b73]"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function pickActive(pathname: string, tabs: ModuleTab[]): string | null {
  let best: string | null = null;
  for (const tab of tabs) {
    const matches = tab.href === pathname || pathname.startsWith(tab.href + "/");
    if (matches && (best === null || tab.href.length > best.length)) {
      best = tab.href;
    }
  }
  return best;
}
