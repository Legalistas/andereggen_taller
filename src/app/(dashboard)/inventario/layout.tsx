"use client";

import { Hammer, Package } from "lucide-react";
import { ModuleTabs } from "@/components/layout/module-tabs";

const TABS = [
  { label: "Repuestos", href: "/inventario", icon: Package },
  { label: "Herramientas", href: "/inventario/herramientas", icon: Hammer },
];

export default function InventarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <ModuleTabs tabs={TABS} />
      {children}
    </div>
  );
}
