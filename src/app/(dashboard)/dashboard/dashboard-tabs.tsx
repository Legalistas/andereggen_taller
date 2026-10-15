"use client";

import { BarChartBig, PiggyBank, Trophy, Wrench } from "lucide-react";
import { ModuleTabs } from "@/components/layout/module-tabs";

const TABS = [
  { label: "Resumen", href: "/dashboard", icon: BarChartBig },
  { label: "Ingresos", href: "/dashboard/ingresos", icon: PiggyBank },
  { label: "Servicios", href: "/dashboard/servicios", icon: Wrench },
  { label: "Clientes", href: "/dashboard/clientes", icon: Trophy },
];

/** La pestaña Ingresos (facturación) solo la ven dirección y contable. */
export function DashboardTabs({ showIngresos }: { showIngresos: boolean }) {
  return (
    <ModuleTabs
      tabs={TABS.filter((t) => showIngresos || t.href !== "/dashboard/ingresos")}
    />
  );
}
