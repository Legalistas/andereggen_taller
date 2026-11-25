/** GET /api/whatsapp/templates — plantillas del Taller aprobadas por Meta. */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { listTemplates, waErrorResponse } from "@/lib/whatsapp/twilio";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  try {
    return NextResponse.json({ data: await listTemplates() });
  } catch (e) {
    return waErrorResponse(e);
  }
}
