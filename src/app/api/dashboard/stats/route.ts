/**
 * GET /api/dashboard/stats
 * Delega a `getDashboardStats()` (shared entre route y RSC page).
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { getDashboardStats } from "@/lib/dashboard/queries.server";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  return NextResponse.json(await getDashboardStats());
}
