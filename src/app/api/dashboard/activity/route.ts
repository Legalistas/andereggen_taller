/**
 * GET /api/dashboard/activity
 * Delega a `getDashboardActivity()` (shared entre route y RSC page).
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { getDashboardActivity } from "@/lib/dashboard/queries.server";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  return NextResponse.json({ items: await getDashboardActivity() });
}
