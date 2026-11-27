import { NextResponse } from "next/server";
import { parseObligation } from "@/lib/fleet";
import { deleteWithFiles, fleetHandler, jsonBody } from "@/lib/fleet-server";
import { prisma } from "@/lib/prisma";

export const PATCH = fleetHandler(async (req, id) => {
  const obligation = await prisma.fleetObligation.update({
    where: { id },
    data: parseObligation(await jsonBody(req), false),
  });
  return NextResponse.json({ obligation });
});

export const DELETE = fleetHandler(async (_req, id) => {
  await deleteWithFiles({ payment: { obligationId: id } }, () =>
    prisma.fleetObligation.delete({ where: { id } }),
  );
  return NextResponse.json({ ok: true });
});
