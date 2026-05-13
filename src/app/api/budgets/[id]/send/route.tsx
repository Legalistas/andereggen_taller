import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { sendEmail } from "@/lib/email/send";
import { BudgetSentEmail } from "@/lib/email/templates/budget-sent";
import { BudgetPdf, type BudgetPdfData } from "@/lib/pdf/budget-pdf";
import { resolvePdfLogo } from "@/lib/pdf/logo";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

type RouteContext = { params: Promise<{ id: string }> };

type Recipient = {
  role: "customer" | "inspector" | "insurance" | "other";
  name?: string | null;
  email: string;
};

type SendBody = {
  recipients: Recipient[];
  customMessage?: string | null;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();
  const { id } = await ctx.params;

  const body = (await request.json().catch(() => null)) as SendBody | null;
  if (
    !body ||
    !Array.isArray(body.recipients) ||
    body.recipients.length === 0
  ) {
    return NextResponse.json(
      { error: "Se requiere al menos un destinatario" },
      { status: 400 },
    );
  }

  // Validación básica de emails
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const r of body.recipients) {
    if (!r?.email || !emailRe.test(r.email)) {
      return NextResponse.json(
        { error: `Email inválido: "${r?.email}"` },
        { status: 400 },
      );
    }
  }

  // Cargar budget completo con todo lo que el PDF necesita
  const budget = await prisma.budget.findUnique({
    where: { id },
    include: {
      concepts: { orderBy: { order: "asc" } },
      parts: { orderBy: { order: "asc" } },
      lead: {
        select: {
          customer: { select: { dni: true, address: true } },
        },
      },
      parentBudget: {
        select: { number: true, extensionSuffix: true },
      },
    },
  });

  if (!budget) {
    return NextResponse.json(
      { error: "Presupuesto no encontrado" },
      { status: 404 },
    );
  }

  // Datos de la empresa (del singleton AppSettings)
  const settings = await getAppSettings();

  // Armar snapshot para el PDF
  const parentDisplay = budget.parentBudget
    ? budget.parentBudget.extensionSuffix > 0
      ? `${budget.parentBudget.number}-A${budget.parentBudget.extensionSuffix}`
      : `${budget.parentBudget.number}`
    : null;
  const pdfData: BudgetPdfData = {
    number: budget.number,
    extensionSuffix: budget.extensionSuffix,
    parentDisplayNumber: parentDisplay,
    createdAt: budget.createdAt,
    customer: {
      name: budget.customerName,
      email: budget.customerEmail,
      phone: budget.customerPhone,
      dni: budget.customerDni ?? budget.lead.customer.dni ?? null,
      address: budget.customerAddress ?? budget.lead.customer.address ?? null,
    },
    vehicle: {
      brand: budget.vehicleBrand,
      model: budget.vehicleModel,
      year: budget.vehicleYear,
      domain: budget.vehicleDomain,
      chassis: budget.vehicleChassis,
      perladoTricapa: budget.vehiclePerladoTricapa,
      insurance: budget.vehicleInsurance,
      coverageType: budget.insuranceCoverageType,
      franchise:
        budget.insuranceFranchise !== null
          ? Number(budget.insuranceFranchise)
          : null,
    },
    concepts: budget.concepts.map((c) => ({
      type: c.type as "DESCRIPTIVO" | "UNIDADES" | "FIJO",
      category: c.category,
      subdetails: c.subdetails,
      additionalDetail: c.additionalDetail,
      units: c.units ? Number(c.units) : null,
      unitValue: c.unitValue ? Number(c.unitValue) : null,
      fixedAmount: c.fixedAmount ? Number(c.fixedAmount) : null,
      fixedDescription: c.fixedDescription,
    })),
    parts: budget.parts.map((p) => ({
      quantity: Number(p.quantity),
      description: p.description,
      unitPrice: Number(p.unitPrice),
    })),
    partsNote: budget.partsNote,
    totals: {
      laborSubtotal: Number(budget.laborSubtotal),
      ivaRate: Number(budget.ivaRate),
      ivaAmount: Number(budget.ivaAmount),
      laborTotal: Number(budget.laborTotal),
      partsSubtotal: Number(budget.partsSubtotal),
      grandTotal: Number(budget.grandTotal),
    },
    conditions: {
      validityDays: budget.validityDays,
      deliveryDays: budget.deliveryDays,
      paymentCondition: budget.paymentCondition,
      observations: budget.observations,
    },
    company: {
      name: settings.companyName,
      address: settings.companyAddress,
      phone: settings.companyPhone ?? "—",
      email: settings.companyEmail ?? "",
      cuit: settings.companyCuit,
      logoUrl: await resolvePdfLogo(settings.companyLogoUrl),
    },
  };

  // Renderizar PDF una sola vez (mismo attachment para todos)
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(<BudgetPdf data={pdfData} />);
  } catch (e) {
    console.error("PDF render error:", e);
    return NextResponse.json(
      { error: "No se pudo generar el PDF del presupuesto" },
      { status: 500 },
    );
  }

  const subject = `Presupuesto #${budget.number} — ${settings.companyName}`;
  const vehicleSummary = `${budget.vehicleBrand} ${budget.vehicleModel} ${budget.vehicleYear} · ${budget.vehicleDomain}`;
  const taller = {
    name: settings.companyName,
    phone: settings.companyPhone ?? "",
    email: settings.companyEmail ?? "",
  };

  // Enviar uno por destinatario con template personalizado al rol
  const results: Array<{
    email: string;
    role: Recipient["role"];
    ok: boolean;
    error?: string;
    messageId?: string;
  }> = [];

  for (const r of body.recipients) {
    try {
      const info = await sendEmail({
        to: r.email,
        subject,
        react: (
          <BudgetSentEmail
            role={r.role}
            recipientName={r.name ?? null}
            customerName={budget.customerName}
            budgetNumber={budget.number}
            vehicleSummary={vehicleSummary}
            grandTotal={ARS.format(Number(budget.grandTotal))}
            validityDays={budget.validityDays}
            customMessage={body.customMessage ?? null}
            taller={taller}
          />
        ),
        attachments: [
          {
            filename: `presupuesto-${budget.number}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      results.push({
        email: r.email,
        role: r.role,
        ok: info.rejected.length === 0,
        messageId: info.messageId,
        error:
          info.rejected.length > 0
            ? `Rechazado: ${info.rejected.join(", ")}`
            : undefined,
      });
    } catch (e) {
      results.push({
        email: r.email,
        role: r.role,
        ok: false,
        error: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }

  // Log de auditoría + update de sentAt/status si hubo al menos un éxito
  const anySuccess = results.some((r) => r.ok);
  const allFailed = !anySuccess;

  await prisma.budgetEmailLog.create({
    data: {
      budgetId: budget.id,
      sentById: session?.user?.id ?? null,
      recipients: results,
      subject,
      messageBody: body.customMessage ?? null,
      status: allFailed ? "failed" : "sent",
      errorMsg: allFailed
        ? results.map((r) => `${r.email}: ${r.error ?? "?"}`).join("; ")
        : null,
      messageId: results.find((r) => r.ok)?.messageId ?? null,
    },
  });

  if (anySuccess) {
    await prisma.budget.update({
      where: { id: budget.id },
      data: {
        sentAt: new Date(),
        // Si estaba en draft, pasar a sent (enum del schema)
        ...(budget.status === "draft" ? { status: "sent" as const } : {}),
      },
    });

    // Escalar el lead del CRM a "enviado" si está en una etapa anterior.
    // Se ejecuta en todos los envíos (primero + reenvíos), pero solo se
    // aplica si el lead sigue en solicitud/control/refuerzo.
    const currentLead = await prisma.lead.findUnique({
      where: { id: budget.leadId },
      select: { status: true },
    });
    if (
      currentLead &&
      (currentLead.status === "solicitud" ||
        currentLead.status === "control" ||
        currentLead.status === "refuerzo")
    ) {
      await prisma.lead.update({
        where: { id: budget.leadId },
        data: { status: "enviado" },
      });
    }
  }

  return NextResponse.json(
    {
      ok: anySuccess,
      results,
      anyFailed: results.some((r) => !r.ok),
    },
    { status: allFailed ? 500 : 200 },
  );
}

/**
 * GET /api/budgets/[id]/send — devuelve el historial de envíos del presupuesto.
 */
export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const logs = await prisma.budgetEmailLog.findMany({
    where: { budgetId: id },
    include: {
      sentBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { sentAt: "desc" },
  });

  return NextResponse.json({ logs });
}
