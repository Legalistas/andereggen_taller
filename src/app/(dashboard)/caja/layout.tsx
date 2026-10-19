import { redirect } from "next/navigation";
import type React from "react";
import { protectRoute } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES } from "@/lib/roles";

export const metadata = { title: "Caja" };

/**
 * spec 9.1 · Caja es de dirección y contable. Excepción: un usuario con
 * cajas habilitadas (User.cashBoxKeys) entra y ve solo esas.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await protectRoute();
  const role = session.user.domainRole?.name ?? "";
  if (!(FINANCE_ROLES as readonly string[]).includes(role)) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { cashBoxKeys: true },
    });
    if (!user?.cashBoxKeys.length) redirect("/auth/error?error=AccessDenied");
  }
  return children;
}
