/**
 * POST /api/supplier-invoices/import  (multipart: file, confirm=1)
 *
 * spec 13 · Importa el Excel o CSV de "Mis Comprobantes Recibidos" de ARCA.
 * Sin `confirm` devuelve la vista previa y no escribe nada; con `confirm=1`
 * carga las facturas nuevas (las repetidas se saltean).
 */

import { NextResponse } from "next/server";
import { leerMisComprobantes } from "@/lib/arca-comprobantes";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { importar, planificar } from "@/lib/facturas-compra";
import { FINANCE_ROLES } from "@/lib/roles";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const authError = await verifyAuth(request, FINANCE_ROLES);
  if (authError) return authError;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error:
          "El archivo es muy grande (máximo 4 MB). Descargá un mes por vez.",
      },
      { status: 400 },
    );
  }

  const lectura = leerMisComprobantes(await file.arrayBuffer());
  if (!lectura.ok)
    return NextResponse.json({ error: lectura.error }, { status: 400 });

  const plan = await planificar(lectura.comprobantes);
  const suma = (k: "netTaxed" | "iva" | "total") =>
    Math.round(plan.nuevos.reduce((s, c) => s + c[k], 0) * 100) / 100;
  const fechas = plan.nuevos.map((c) => c.date).sort();
  const vistaPrevia = {
    leidas: lectura.comprobantes.length,
    nuevas: plan.nuevos.length,
    repetidas: plan.repetidos,
    errores: lectura.errores.slice(0, 50),
    totalErrores: lectura.errores.length,
    desde: fechas[0] ?? null,
    hasta: fechas.at(-1) ?? null,
    netTaxed: suma("netTaxed"),
    iva: suma("iva"),
    total: suma("total"),
    proveedores: plan.proveedores,
  };

  if (form?.get("confirm") !== "1")
    return NextResponse.json({ preview: vistaPrevia });

  const session = await getServerSession();
  const resultado = await importar(plan, session?.user.id ?? null);
  return NextResponse.json({ preview: vistaPrevia, result: resultado });
}
