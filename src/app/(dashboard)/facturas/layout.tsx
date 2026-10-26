import type React from "react";
import { protectRoute } from "@/lib/auth-utils";
import { FINANCE_ROLES } from "@/lib/roles";

export const metadata = { title: "Facturas de compra" };

/** spec 13 · Como Caja: solo dirección y contable. */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await protectRoute(FINANCE_ROLES);
  return children;
}
