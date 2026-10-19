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
  // Caja en el menú: rol de finanzas, o cajas habilitadas en el usuario.
  const canCaja =
    (roleName !== null && (FINANCE_ROLES as readonly string[]).includes(roleName)) ||
    ((await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { cashBoxKeys: true },
    }))?.cashBoxKeys.length ?? 0) > 0;

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
      }}
    >
      {children}
    </DashboardShell>
  );
}
