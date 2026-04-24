import MetricsCards from "@/components/dashboard/metrics-cards"
import ChartsSection from "@/components/dashboard/charts-section"
import ActivityTable from "@/components/dashboard/activity-table"

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <MetricsCards />
            <ChartsSection />
            <ActivityTable />
        </div>
    )
}
