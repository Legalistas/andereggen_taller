/**
 * GET  /api/whatsapp/campaigns — campañas con su avance.
 * POST /api/whatsapp/campaigns { name, listId, templateSid, variables }
 *   Lanza la campaña: responde enseguida y manda en segundo plano.
 */

import { after, NextResponse } from "next/server";
import { ADMIN_ROLES, getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import {
  createCampaign,
  listCampaigns,
  runCampaign,
} from "@/lib/whatsapp/campaigns";
import { waErrorResponse } from "@/lib/whatsapp/twilio";

// El envío corre en `after`, dentro de este tiempo (~1.000 contactos, unos 2 min).
export const maxDuration = 300;

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  return NextResponse.json({ data: await listCampaigns() });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request, ADMIN_ROLES);
  if (authError) return authError;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (
    !name ||
    typeof body?.listId !== "string" ||
    typeof body?.templateSid !== "string"
  ) {
    return NextResponse.json(
      { error: "Completá nombre, lista y plantilla." },
      { status: 400 },
    );
  }
  const list = await prisma.whatsappList.findUnique({
    where: { id: body.listId },
    select: { _count: { select: { members: true } } },
  });
  if (!list || list._count.members === 0) {
    return NextResponse.json(
      { error: "La lista no existe o está vacía." },
      { status: 400 },
    );
  }
  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.variables ?? {})) {
    if (typeof v === "string") variables[k] = v;
  }
  try {
    const campaign = await createCampaign({
      name: name.slice(0, 150),
      listId: body.listId,
      templateSid: body.templateSid,
      variables,
      userId: session?.user?.id ?? null,
    });
    after(() =>
      runCampaign(campaign.id).catch((e) =>
        console.error(`[whatsapp] campaña ${campaign.id}:`, e),
      ),
    );
    return NextResponse.json(
      { id: campaign.id, recipients: campaign._count.recipients },
      { status: 201 },
    );
  } catch (e) {
    return waErrorResponse(e);
  }
}
