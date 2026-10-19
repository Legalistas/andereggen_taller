import { getServerSession, INTERNAL_ROLES, verifyAuth } from "./auth-utils";
import { prisma } from "./prisma";
import { FINANCE_ROLES } from "./roles";

/**
 * Quién puede entrar a Caja y a qué cajas.
 *
 * - Rol de finanzas (super_admin, contable): todas las cajas, sin límite.
 * - Cualquier otro rol interno con `User.cashBoxKeys` cargado: solo esas
 *   cajas. Las listas se filtran y cualquier operación sobre otra caja da 403.
 * - Sin rol de finanzas y sin keys: 403.
 */
export type CajaScope = {
  /** null = todas las cajas. */
  boxIds: string[] | null;
  scoped: boolean;
};

export async function cajaScope(
  request: Request,
): Promise<Response | CajaScope> {
  const err = await verifyAuth(request, INTERNAL_ROLES);
  if (err) return err;
  const session = await getServerSession();
  const role = session?.user?.domainRole?.name ?? "";
  if ((FINANCE_ROLES as readonly string[]).includes(role)) {
    return { boxIds: null, scoped: false };
  }
  const user = await prisma.user.findUnique({
    where: { id: session?.user?.id ?? "" },
    select: { cashBoxKeys: true },
  });
  if (!user?.cashBoxKeys.length) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }
  const boxes = await prisma.cashBox.findMany({
    where: { key: { in: user.cashBoxKeys } },
    select: { id: true },
  });
  return { boxIds: boxes.map((b) => b.id), scoped: true };
}

/** true si la caja está dentro del alcance (o no hay límite). */
export function inScope(scope: CajaScope, cashBoxId: string | null): boolean {
  return scope.boxIds === null || (!!cashBoxId && scope.boxIds.includes(cashBoxId));
}

export const outOfScope = () =>
  Response.json({ error: "Esa caja no está habilitada para tu usuario" }, { status: 403 });
