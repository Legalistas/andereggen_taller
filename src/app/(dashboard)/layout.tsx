import type { Metadata } from "next";
import type React from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { protectRoute } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await protectRoute();
  const roleName = session.user.domainRole?.name ?? null;
  // Caja y Estadísticas en el menú: rol de finanzas, o acceso habilitado en
  // el usuario (cajas en cashBoxKeys / canViewStats).
  const isFinance =
    roleName !== null && (FINANCE_ROLES as readonly string[]).includes(roleName);
  const access = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { cashBoxKeys: true, canViewStats: true },
  });
  const canCaja = isFinance || (access?.cashBoxKeys.length ?? 0) > 0;
  const canStats = isFinance || (access?.canViewStats ?? false);

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        role:
          session.user.domainRole?.label ??
          session.user.domainRole?.name ??
          null,
        roleName,
        canCaja,
        canStats,
      }}
    >
      {children}
    </DashboardShell>
  );
}
