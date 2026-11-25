import { redirect } from "next/navigation";
import type React from "react";
import { protectRoute } from "@/lib/auth-utils";
import { canViewStats } from "@/lib/stats-access";

export const metadata = { title: "Estadísticas" };

/**
 * spec 9.1 · Solo dirección y contable. Excepción: usuarios con
 * `User.canViewStats`. El resto cae en AccessDenied.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await protectRoute();
  if (!(await canViewStats(session.user.id, session.user.domainRole?.name))) {
    redirect("/auth/error?error=AccessDenied");
  }
  return children;
}
