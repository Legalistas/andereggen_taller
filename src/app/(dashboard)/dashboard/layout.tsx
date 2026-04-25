"use client";

import { BarChartBig, PiggyBank, Trophy, Wrench } from "lucide-react";
import { ModuleTabs } from "@/components/layout/module-tabs";

const TABS = [
  { label: "Resumen", href: "/dashboard", icon: BarChartBig },
  { label: "Ingresos", href: "/dashboard/ingresos", icon: PiggyBank },
  { label: "Servicios", href: "/dashboard/servicios", icon: Wrench },
  { label: "Clientes", href: "/dashboard/clientes", icon: Trophy },
];

export default function DashboardLayout({
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
