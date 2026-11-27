import { NextResponse } from "next/server";
import { parsePayment } from "@/lib/fleet";
import { deleteWithFiles, fleetHandler, jsonBody } from "@/lib/fleet-server";
import { prisma } from "@/lib/prisma";

/** Editar o marcar pagado / pendiente. Los comprobantes no se tocan. */
export const PATCH = fleetHandler(async (req, id) => {
  const payment = await prisma.fleetPayment.update({
    where: { id },
    data: parsePayment(await jsonBody(req), false),
  });
  return NextResponse.json({ payment });
});

export const DELETE = fleetHandler(async (_req, id) => {
  await deleteWithFiles({ paymentId: id }, () =>
    prisma.fleetPayment.delete({ where: { id } }),
  );
  return NextResponse.json({ ok: true });
});
