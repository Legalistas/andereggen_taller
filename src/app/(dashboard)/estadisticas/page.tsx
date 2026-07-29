import EstadisticasSection from "@/components/estadisticas/estadisticas-section";

export const metadata = { title: "Estadísticas" };

export default function EstadisticasPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Estadísticas</h1>
        <p className="text-sm text-slate-500">
          Tablero mensual de KPIs y reportes complementarios.
        </p>
      </div>
      <EstadisticasSection />
    </div>
  );
}
