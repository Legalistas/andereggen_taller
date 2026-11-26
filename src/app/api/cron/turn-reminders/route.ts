/**
 * GET /api/cron/turn-reminders — recordatorio por WhatsApp de los turnos de
 * ingreso de mañana. Lo llama Vercel Cron una vez por día (vercel.json), con
 * `Authorization: Bearer $CRON_SECRET`.
 */

import { NextResponse } from "next/server";
import { sendTurnReminders } from "@/lib/notifications";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendTurnReminders());
}
