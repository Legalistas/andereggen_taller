import { NextResponse } from "next/server";
import { parsePayment } from "@/lib/fleet";
import { fleetHandler, jsonBody } from "@/lib/fleet-server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../../../../generated/prisma/client";

export const POST = fleetHandler(async (req, obligationId) => {
  const data = parsePayment(await jsonBody(req), true);
  const payment = await prisma.fleetPayment.create({
    data: { ...data, obligationId } as Prisma.FleetPaymentUncheckedCreateInput,
  });
  return NextResponse.json({ payment }, { status: 201 });
});
