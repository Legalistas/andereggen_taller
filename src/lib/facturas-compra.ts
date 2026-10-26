/**
 * spec 13 · Importación de facturas de compra desde ARCA.
 *
 * `planificar` arma la vista previa sin escribir nada: qué comprobantes son
 * nuevos, cuáles ya estaban (mismo CUIT, tipo, punto de venta y número) y qué
 * pasa con cada proveedor. `importar` aplica ese plan en una transacción.
 *
 * Proveedores: se buscan por CUIT; si no hay, por nombre entre los que todavía
 * no tienen CUIT (y se les completa); si tampoco, se crean.
 */

import type { ComprobanteArca } from "@/lib/arca-comprobantes";
import { nombreComparable } from "@/lib/arca-comprobantes";
import { prisma } from "@/lib/prisma";

export type ProveedorPlan = {
  cuit: string;
  /** Nombre como figura en ARCA. */
  arcaName: string;
  accion: "existente" | "vincular" | "crear";
  supplierId?: string;
  /** Nombre del proveedor del sistema al que se vincula. */
  supplierName?: string;
};

const clave = (c: {
  issuerCuit: string;
  typeCode: number;
  pointOfSale: number;
  number: number;
}) => `${c.issuerCuit}|${c.typeCode}|${c.pointOfSale}|${c.number}`;

export async function planificar(comprobantes: ComprobanteArca[]) {
  const cuitsArchivo = [...new Set(comprobantes.map((c) => c.issuerCuit))];
  const existentes = await prisma.supplierInvoice.findMany({
    where: { issuerCuit: { in: cuitsArchivo } },
    select: {
      issuerCuit: true,
      typeCode: true,
      pointOfSale: true,
      number: true,
    },
  });
  const vistos = new Set(existentes.map(clave));
  const nuevos: ComprobanteArca[] = [];
  let repetidos = 0;
  for (const c of comprobantes) {
    if (vistos.has(clave(c))) repetidos++;
    else {
      vistos.add(clave(c));
      nuevos.push(c);
    }
  }

  const cuits = [...new Set(nuevos.map((c) => c.issuerCuit))];
  const [conCuit, sinCuit] = await Promise.all([
    prisma.supplier.findMany({
      where: { cuit: { in: cuits } },
      select: { id: true, name: true, cuit: true },
    }),
    prisma.supplier.findMany({
      where: { cuit: null },
      select: { id: true, name: true },
    }),
  ]);
  const porNombre = new Map(sinCuit.map((s) => [nombreComparable(s.name), s]));
  const proveedores: ProveedorPlan[] = cuits.map((cuit) => {
    const arcaName =
      nuevos.find((c) => c.issuerCuit === cuit)?.issuerName ?? cuit;
    const mismo = conCuit.find((s) => s.cuit === cuit);
    if (mismo)
      return {
        cuit,
        arcaName,
        accion: "existente",
        supplierId: mismo.id,
        supplierName: mismo.name,
      };
    const parecido = porNombre.get(nombreComparable(arcaName));
    if (parecido) {
      // Un proveedor sin CUIT se vincula a un solo CUIT.
      porNombre.delete(nombreComparable(arcaName));
      return {
        cuit,
        arcaName,
        accion: "vincular",
        supplierId: parecido.id,
        supplierName: parecido.name,
      };
    }
    return { cuit, arcaName, accion: "crear" };
  });

  return { nuevos, repetidos, proveedores };
}

export async function importar(
  plan: Awaited<ReturnType<typeof planificar>>,
  userId: string | null,
) {
  return prisma.$transaction(
    async (tx) => {
      const ids = new Map<string, string>();
      for (const p of plan.proveedores) {
        if (p.accion === "existente" && p.supplierId)
          ids.set(p.cuit, p.supplierId);
        else if (p.accion === "vincular" && p.supplierId) {
          await tx.supplier.update({
            where: { id: p.supplierId },
            data: { cuit: p.cuit },
          });
          ids.set(p.cuit, p.supplierId);
        } else {
          // El nombre es único: si ya lo usa otro proveedor (con otro CUIT), se le agrega el CUIT.
          const ocupado = await tx.supplier.findUnique({
            where: { name: p.arcaName },
            select: { id: true },
          });
          const creado = await tx.supplier.create({
            data: {
              name: ocupado ? `${p.arcaName} (CUIT ${p.cuit})` : p.arcaName,
              cuit: p.cuit,
            },
            select: { id: true },
          });
          ids.set(p.cuit, creado.id);
        }
      }

      const { count } = await tx.supplierInvoice.createMany({
        data: plan.nuevos.map(({ row: _row, date, ...c }) => ({
          ...c,
          date: new Date(`${date}T00:00:00.000Z`),
          supplierId: ids.get(c.issuerCuit) ?? null,
          importedById: userId,
        })),
        skipDuplicates: true,
      });
      return {
        importadas: count,
        proveedoresCreados: plan.proveedores.filter((p) => p.accion === "crear")
          .length,
        proveedoresVinculados: plan.proveedores.filter(
          (p) => p.accion === "vincular",
        ).length,
      };
    },
    { timeout: 60_000 },
  );
}
