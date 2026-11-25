/** GET /api/whatsapp/campaigns/[id] — destinatarios con error, para corregirlos. */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { campaignErrors } from "@/lib/whatsapp/campaigns";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;
  return NextResponse.json({ errors: await campaignErrors(id) });
}
