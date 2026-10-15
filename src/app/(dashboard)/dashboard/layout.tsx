import type React from "react";
import { FINANCE_ROLES, getServerSession } from "@/lib/auth-utils";
import { DashboardTabs } from "./dashboard-tabs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  const roleName = session?.user?.domainRole?.name ?? "";
  return (
    <div>
      <DashboardTabs showIngresos={(FINANCE_ROLES as readonly string[]).includes(roleName)} />
      {children}
    </div>
  );
}
