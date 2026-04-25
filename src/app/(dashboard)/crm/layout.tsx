"use client";

import { FileText, LayoutGrid, Send } from "lucide-react";
import { ModuleTabs } from "@/components/layout/module-tabs";

const TABS = [
  { label: "Cotizaciones", href: "/crm/leads", icon: LayoutGrid },
  { label: "Presupuestos", href: "/crm/cotizaciones", icon: FileText },
  { label: "Seguimiento", href: "/crm/seguimiento", icon: Send },
];

export default function CotizacionesLayout({
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
