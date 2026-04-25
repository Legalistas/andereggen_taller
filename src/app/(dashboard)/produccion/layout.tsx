"use client";

import { Car, ClipboardList, ScrollText } from "lucide-react";
import { ModuleTabs } from "@/components/layout/module-tabs";

const TABS = [
  { label: "Tablero", href: "/produccion", icon: Car },
  { label: "Lista completa", href: "/produccion/lista", icon: ClipboardList },
  { label: "Histórico", href: "/produccion/historico", icon: ScrollText },
];

export default function ProduccionLayout({
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
