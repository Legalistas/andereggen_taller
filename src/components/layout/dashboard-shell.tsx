"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { Sidebar } from "./sidebar";
import type { SidebarUser } from "./sidebar-user-menu";

const STORAGE_KEY = "andereggen:sidebar-collapsed";

type Props = {
  user: SidebarUser;
  children: React.ReactNode;
};

export function DashboardShell({ user, children }: Props) {
  // Desktop: expandida/colapsada con persistencia en localStorage
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Mobile: drawer abierto/cerrado (siempre arranca cerrado)
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname = usePathname();

  // Cargar estado de localStorage en el primer render del cliente
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      // ignore (SSR / modo privado)
    }
    setHydrated(true);
  }, []);

  // Persistir cambios
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed, hydrated]);

  // Cerrar drawer automáticamente al navegar (en mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Bloquear scroll del body cuando el drawer está abierto (mobile)
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar desktop (visible lg+) */}
      <div className="hidden lg:block sticky top-0 h-screen shrink-0">
        <Sidebar
          user={user}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      </div>

      {/* Sidebar mobile drawer (visible <lg) */}
      {mobileOpen && (
        <>
          {/* Overlay */}
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-in fade-in-0"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden animate-in slide-in-from-left duration-200">
            <Sidebar
              user={user}
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header mobile (solo <lg): hamburguer + logo */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo className="h-6 w-auto" />
          </Link>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
