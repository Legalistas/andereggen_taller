import ActivityTable from "@/components/dashboard/activity-table";
import ChartsSection from "@/components/dashboard/charts-section";
import DashboardKpis from "@/components/dashboard/dashboard-kpis";
import { getServerSession } from "@/lib/auth-utils";

export default async function DashboardPage() {
  const session = await getServerSession();
  const firstName = (session?.user?.name ?? "").split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {firstName ? `Hola, ${firstName}` : "Hola"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Este es el estado actual del taller.
        </p>
      </div>

      <DashboardKpis />
      <ChartsSection />
      <ActivityTable />
    </div>
  );
}
