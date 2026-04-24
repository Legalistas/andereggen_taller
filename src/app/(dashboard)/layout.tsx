import type React from "react"
import Header from "@/components/layout/header"
import Navigation from "@/components/layout/navigation"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-background">
            <Header />
            <Navigation />
            <main className="container mx-auto p-4 md:p-6 lg:p-8">
                {children}
            </main>
        </div>
    )
}