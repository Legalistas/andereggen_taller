"use client";

import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { SIDEBAR_ITEMS } from "./sidebar-config";
import { type SidebarUser, SidebarUserMenu } from "./sidebar-user-menu";

type Props = {
  user: SidebarUser;
  collapsed: boolean;
  onToggle: () => void;
  /**
   * Cuando el Sidebar se renderiza dentro del drawer mobile queremos que el
   * click en un item lo cierre automáticamente.
   */
  onNavigate?: () => void;
};

export function Sidebar({ user, collapsed, onToggle, onNavigate }: Props) {
  const pathname = usePathname();
  const activeHref = pickActiveHref(pathname);

  return (
    <aside
      className={`h-screen bg-card border-r border-border flex flex-col transition-[width] duration-200 ease-out ${
        collapsed ? "w-18" : "w-64"
      }`}
    >
      {/* Header: logo + toggle */}
      <div
        className={`border-b border-border flex items-center ${
          collapsed ? "justify-center p-3" : "justify-between px-4 py-3"
        }`}
      >
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          {collapsed ? (
            <div className="h-8 w-8 rounded-md bg-[#003b73] flex items-center justify-center shrink-0">
              <Wrench className="h-4 w-4 text-white" />
            </div>
          ) : (
            <Logo className="h-8 w-auto" />
          )}
        </Link>
        {!collapsed && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={onToggle}
            aria-label="Colapsar sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {collapsed && (
        <div className="px-3 py-2 border-b">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full p-0"
            onClick={onToggle}
            aria-label="Expandir sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Navegación plana */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <ul className="space-y-0.5 px-2">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === activeHref;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 rounded-md text-sm transition-colors ${
                    collapsed ? "justify-center py-2.5" : "px-3 py-2.5"
                  } ${
                    isActive
                      ? "bg-[#003b73]/10 text-[#003b73] font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer: user menu */}
      <div className="border-t border-border p-2 shrink-0">
        <SidebarUserMenu user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}

/**
 * Elige el item activo con longest-prefix match para rutas anidadas.
 */
function pickActiveHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of SIDEBAR_ITEMS) {
    const matches =
      item.href === pathname ||
      pathname.startsWith(item.href + "/") ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href));
    if (matches && (best === null || item.href.length > best.length)) {
      best = item.href;
    }
  }
  return best;
}
