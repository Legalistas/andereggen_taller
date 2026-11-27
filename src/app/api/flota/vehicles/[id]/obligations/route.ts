import { NextResponse } from "next/server";
import { parseObligation } from "@/lib/fleet";
import { fleetHandler, jsonBody } from "@/lib/fleet-server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../../../../generated/prisma/client";

export const POST = fleetHandler(async (req, vehicleId) => {
  const data = parseObligation(await jsonBody(req), true);
  const obligation = await prisma.fleetObligation.create({
    data: { ...data, vehicleId } as Prisma.FleetObligationUncheckedCreateInput,
  });
  return NextResponse.json({ obligation }, { status: 201 });
});
