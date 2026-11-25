import EstadisticasSection from "@/components/estadisticas/estadisticas-section";
import { getServerSession } from "@/lib/auth-utils";
import { FINANCE_ROLES } from "@/lib/roles";

export const metadata = { title: "Estadísticas" };

export default async function EstadisticasPage() {
  const role = (await getServerSession())?.user?.domainRole?.name ?? "";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Estadísticas</h1>
        <p className="text-sm text-slate-500">
          Tablero mensual de KPIs y reportes complementarios.
        </p>
      </div>
      <EstadisticasSection
        showIncome={(FINANCE_ROLES as readonly string[]).includes(role)}
      />
    </div>
  );
}
