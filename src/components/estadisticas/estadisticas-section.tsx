"use client";

/**
 * Contenedor de la página Estadísticas — spec KPIs jul '26.
 *
 * Tabs (en orden):
 *   1. KPIs (default) — tablero mensual consolidado
 *   2. Ingresos       — reporte complementario existente
 *   3. Servicios      — reporte complementario existente
 *   4. Clientes       — reporte complementario existente
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import KpiTab from "@/components/kpis/kpi-tab";
import CustomersReportSection from "@/components/reports/customers-report-section";
import IncomeSection from "@/components/reports/income-section";
import ServicesSection from "@/components/reports/services-section";

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
