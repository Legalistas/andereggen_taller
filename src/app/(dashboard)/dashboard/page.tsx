import { computeStats } from "@/app/api/stats/route";
import ActivityTable from "@/components/dashboard/activity-table";
import ChartsSection from "@/components/dashboard/charts-section";
import DashboardKpis from "@/components/dashboard/dashboard-kpis";
import StatsSection from "@/components/stats/stats-section";
import { getServerSession } from "@/lib/auth-utils";
import {
  getDashboardActivity,
  getDashboardCharts,
  getDashboardStats,
} from "@/lib/dashboard/queries.server";

export default async function DashboardPage() {
  // Perf audit: pre-fetch server-side de los 4 datasets del dashboard en
  // paralelo. Antes cada componente cliente hacía su propio fetch post-
  // hidratación (4 round-trips en cascada). Ahora: ninguno.
  const [session, stats, charts, activity, generalStats] = await Promise.all([
    getServerSession(),
    getDashboardStats(),
    getDashboardCharts(),
    getDashboardActivity(),
    computeStats(null),
  ]);
  const firstName = (session?.user?.name ?? "").split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {firstName ? `Hola, ${firstName}` : "Hola"}
        </h1>
      </div>

      <DashboardKpis initialData={stats} />
      <ChartsSection initialData={charts} />
      <StatsSection initialData={generalStats} />
      <ActivityTable initialData={activity} />
    </div>
  );
}
