"use client";

/**
 * Contenedor de la página Estadísticas — spec KPIs jul '26.
 *
 * Tabs (en orden):
 *   1. KPIs (default) — tablero mensual consolidado
 *   2. Ingresos       — reporte complementario existente
 *   3. Servicios      — reporte complementario existente
 *   4. Clientes       — reporte complementario existente
 *
 * Perf audit: los 3 tabs no-default (Ingresos, Servicios, Clientes)
 * cargan recharts. Con `dynamic()` cada uno queda en su propio chunk y
 * solo se baja cuando el usuario clickea la tab.
 */

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import KpiTab from "@/components/kpis/kpi-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabFallback = (
  <div className="p-8 flex items-center justify-center text-slate-400">
    <Loader2 className="h-5 w-5 animate-spin" />
  </div>
);
const IncomeSection = dynamic(
  () => import("@/components/reports/income-section"),
  { loading: () => tabFallback },
);
const ServicesSection = dynamic(
  () => import("@/components/reports/services-section"),
  { loading: () => tabFallback },
);
const CustomersReportSection = dynamic(
  () => import("@/components/reports/customers-report-section"),
  { loading: () => tabFallback },
);

export default function EstadisticasSection() {
  return (
    <Tabs defaultValue="kpis" className="w-full">
      <TabsList>
        <TabsTrigger value="kpis">KPIs</TabsTrigger>
        <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
        <TabsTrigger value="servicios">Servicios</TabsTrigger>
        <TabsTrigger value="clientes">Clientes</TabsTrigger>
      </TabsList>
      <TabsContent value="kpis" className="mt-4">
        <KpiTab />
      </TabsContent>
      <TabsContent value="ingresos" className="mt-4">
        <IncomeSection />
      </TabsContent>
      <TabsContent value="servicios" className="mt-4">
        <ServicesSection />
      </TabsContent>
      <TabsContent value="clientes" className="mt-4">
        <CustomersReportSection />
      </TabsContent>
    </Tabs>
  );
}
