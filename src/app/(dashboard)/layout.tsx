import type React from "react"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { protectRoute } from "@/lib/auth-utils"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await protectRoute(["admin", "internal"])

    return (
        <DashboardShell
            user={{
                name: session.user.name ?? null,
                email: session.user.email ?? null,
                role: session.user.role?.name ?? null,
            }}
        >
            {children}
        </DashboardShell>
    )
}
