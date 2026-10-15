import type React from "react";
import { FINANCE_ROLES, protectRoute } from "@/lib/auth-utils";

export const metadata = { title: "Ingresos" };

/** spec 9.1 · Solo dirección y contable. El resto cae en AccessDenied. */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await protectRoute(FINANCE_ROLES);
  return children;
}
