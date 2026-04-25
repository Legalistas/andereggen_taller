import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const settings = await getAppSettings();
  return NextResponse.json({ settings });
}

/**
 * PATCH con cualquier combinación de campos del singleton. No se permite
 * cambiar el id. Los campos sensibles (apiKeys) se aceptan tal cual — el
 * admin es responsable de rotarlos.
 */
export async function PATCH(request: Request) {
  const authError = await verifyAuth(request, ["super_admin", "admin_taller"]);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  // Sanitizar: lista explícita de campos permitidos
  const allowed = [
    "companyName",
    "companyAddress",
    "companyCuit",
    "companyPhone",
    "companyEmail",
    "companyWebsite",
    "companyLogoUrl",
    "defaultIvaRate",
    "defaultValidityDays",
    "defaultDeliveryDays",
    "defaultPaymentCondition",
    "notifyOnLeadCreated",
    "notifyOnBudgetSent",
    "notifyOnBudgetReminder",
    "notifyOnStageChange",
    "reminderDaysAfterSent",
    "locale",
    "currency",
    "timezone",
    "whatsappEnabled",
    "whatsappNumber",
    "whatsappApiKey",
    "mpEnabled",
    "mpAccessToken",
    "afipEnabled",
    "afipCuit",
    "afipCertNote",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = (body as Record<string, unknown>)[key];
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: "app" },
    update: data,
    create: { id: "app", ...data },
  });

  return NextResponse.json({ settings });
}
