/**
 * PDF del presupuesto usando @react-pdf/renderer.
 * Renderizado server-side: generar Buffer con `renderToBuffer(<BudgetPdf .../>)`.
 */

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { CATEGORY_BY_KEY, subdetailLabel } from "@/lib/budget-catalog";

// ─────────────────────────────────────────────────────────────
// Tipos del snapshot que recibe el PDF (tomados del Budget + relaciones)
// ─────────────────────────────────────────────────────────────

export type BudgetPdfData = {
  number: number;
  createdAt: string | Date;
  customer: {
    name: string;
    email: string;
    phone: string;
    dni?: string | null;
    address?: string | null;
  };
  vehicle: {
    brand: string;
    model: string;
    year: string;
    domain: string;
    chassis?: string | null;
    perladoTricapa?: boolean;
    insurance?: string | null;
    /** "todo_riesgo" | "terceros" | null */
    coverageType?: string | null;
    franchise?: number | string | null;
  };
  concepts: Array<{
    type: "DESCRIPTIVO" | "UNIDADES" | "FIJO";
    category: string;
    subdetails: string[];
    additionalDetail: string | null;
    units: number | string | null;
    unitValue: number | string | null;
    fixedAmount: number | string | null;
    fixedDescription: string | null;
  }>;
  parts: Array<{
    quantity: number | string;
    description: string;
    unitPrice: number | string;
  }>;
  /** Aclaración libre sobre los repuestos (sale debajo de la tabla) */
  partsNote?: string | null;
  totals: {
    laborSubtotal: number;
    ivaRate: number;
    ivaAmount: number;
    laborTotal: number;
    partsSubtotal: number;
    grandTotal: number;
  };
  conditions: {
    validityDays: number;
    deliveryDays: number;
    paymentCondition: string;
    observations?: string | null;
  };
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
    cuit?: string | null;
    /** URL absoluta del logo (PNG/JPG). Si está, se renderiza arriba del nombre. */
    logoUrl?: string | null;
  };
};

// ─────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────

const C = {
  brand: "#003b73",
  slate700: "#334155",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
} as const;

const s = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: C.slate700,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.brand,
    marginBottom: 16,
  },
  companyBlock: { flexDirection: "column", maxWidth: 360 },
  // Logo PNG real: 871×304 (ratio 2.86:1). Mantener proporción.
  logo: { width: 138, height: 48, marginBottom: 8, objectFit: "contain" },
  companyName: {
    fontSize: 14,
    fontWeight: "bold",
    color: C.brand,
    marginBottom: 2,
  },
  companyLine: { fontSize: 8, color: C.slate500 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: C.brand,
    color: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 150,
  },
  badgeTitle: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "white",
    opacity: 0.85,
    marginBottom: 4,
  },
  badgeNumber: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    lineHeight: 1,
    marginBottom: 6,
  },
  badgeDate: { fontSize: 8, color: "white", opacity: 0.9 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: C.brand,
    marginBottom: 6,
    marginTop: 10,
  },
  twoCol: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  box: {
    padding: 8,
    backgroundColor: C.slate50,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.slate200,
  },
  row: { flexDirection: "row", marginBottom: 2 },
  label: {
    width: 70,
    color: C.slate500,
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: { flex: 1, color: C.slate700 },
  table: {
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 4,
    marginTop: 4,
    overflow: "hidden",
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.slate200,
  },
  trHeader: {
    flexDirection: "row",
    backgroundColor: C.slate100,
    borderBottomWidth: 1,
    borderBottomColor: C.slate200,
  },
  th: {
    padding: 6,
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: C.slate500,
    letterSpacing: 0.5,
  },
  td: { padding: 6, fontSize: 9 },
  totalsBox: {
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 4,
    backgroundColor: C.slate50,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsLabel: { color: C.slate500, fontSize: 9 },
  totalsValue: { color: C.slate700, fontSize: 9 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: C.slate200,
  },
  grandTotalLabel: { fontSize: 12, fontWeight: "bold", color: C.slate700 },
  grandTotalValue: { fontSize: 14, fontWeight: "bold", color: C.brand },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 7,
    color: C.slate400,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: C.slate200,
    paddingTop: 6,
  },
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function conceptLineLabel(c: BudgetPdfData["concepts"][number]): string {
  const cat = CATEGORY_BY_KEY[c.category as keyof typeof CATEGORY_BY_KEY];
  const base = cat?.label ?? c.category;
  if (c.type === "DESCRIPTIVO" && c.subdetails.length) {
    const subs = c.subdetails
      .map((k) => subdetailLabel(c.category as never, k))
      .join(", ");
    return `${base}: ${subs}`;
  }
  if (c.type === "FIJO" && c.fixedDescription) {
    return `${base} — ${c.fixedDescription}`;
  }
  return base;
}

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

export function BudgetPdf({ data }: { data: BudgetPdfData }) {
  return (
    <Document
      title={`Presupuesto #${data.number}`}
      author={data.company.name}
      subject={`Presupuesto #${data.number} — ${data.customer.name}`}
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.companyBlock}>
            {data.company.logoUrl ? (
              <Image src={data.company.logoUrl} style={s.logo} />
            ) : null}
            {/* <Text style={s.companyName}>{data.company.name}</Text> */}
            <Text style={s.companyLine}>{data.company.address}</Text>
            <Text style={s.companyLine}>
              Tel: {data.company.phone} · {data.company.email}
            </Text>
            {data.company.cuit ? (
              <Text style={s.companyLine}>CUIT: {data.company.cuit}</Text>
            ) : null}
          </View>
          <View style={s.badge}>
            <Text style={s.badgeTitle}>Presupuesto</Text>
            <Text style={s.badgeNumber}>#{data.number}</Text>
            <Text style={s.badgeDate}>
              Emitido: {formatDate(data.createdAt)}
            </Text>
          </View>
        </View>

        {/* Cliente + Vehículo */}
        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Cliente</Text>
            <View style={s.box}>
              <View style={s.row}>
                <Text style={s.label}>Nombre</Text>
                <Text style={s.value}>{data.customer.name}</Text>
              </View>
              {data.customer.dni ? (
                <View style={s.row}>
                  <Text style={s.label}>DNI</Text>
                  <Text style={s.value}>{data.customer.dni}</Text>
                </View>
              ) : null}
              <View style={s.row}>
                <Text style={s.label}>Email</Text>
                <Text style={s.value}>{data.customer.email}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.label}>Tel</Text>
                <Text style={s.value}>{data.customer.phone}</Text>
              </View>
              {data.customer.address && data.customer.address !== "-" ? (
                <View style={s.row}>
                  <Text style={s.label}>Dirección</Text>
                  <Text style={s.value}>{data.customer.address}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Vehículo</Text>
            <View style={s.box}>
              <View style={s.row}>
                <Text style={s.label}>Marca</Text>
                <Text style={s.value}>{data.vehicle.brand}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.label}>Modelo</Text>
                <Text style={s.value}>{data.vehicle.model}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.label}>Año</Text>
                <Text style={s.value}>{data.vehicle.year}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.label}>Dominio</Text>
                <Text style={s.value}>{data.vehicle.domain}</Text>
              </View>
              {data.vehicle.chassis ? (
                <View style={s.row}>
                  <Text style={s.label}>Chasis</Text>
                  <Text style={s.value}>{data.vehicle.chassis}</Text>
                </View>
              ) : null}
              {data.vehicle.perladoTricapa ? (
                <View style={s.row}>
                  <Text style={s.label}>Pintura</Text>
                  <Text
                    style={[
                      s.value,
                      { fontWeight: "bold", letterSpacing: 0.5 },
                    ]}
                  >
                    PERLADO TRICAPA
                  </Text>
                </View>
              ) : null}
              {data.vehicle.insurance ? (
                <View style={s.row}>
                  <Text style={s.label}>Seguro</Text>
                  <Text style={s.value}>{data.vehicle.insurance}</Text>
                </View>
              ) : null}
              {data.vehicle.coverageType ? (
                <View style={s.row}>
                  <Text style={s.label}>Cobertura</Text>
                  <Text style={s.value}>
                    {data.vehicle.coverageType === "todo_riesgo"
                      ? "Contra todo riesgo"
                      : "Contra terceros"}
                  </Text>
                </View>
              ) : null}
              {data.vehicle.coverageType === "todo_riesgo" &&
              data.vehicle.franchise !== null &&
              data.vehicle.franchise !== undefined &&
              data.vehicle.franchise !== "" ? (
                <View style={s.row}>
                  <Text style={s.label}>Franquicia</Text>
                  <Text style={s.value}>
                    {new Intl.NumberFormat("es-AR", {
                      style: "currency",
                      currency: "ARS",
                      minimumFractionDigits: 2,
                    }).format(Number(data.vehicle.franchise))}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Conceptos */}
        {data.concepts.length > 0 ? (
          <View>
            <Text style={s.sectionTitle}>Mano de obra · Trabajos</Text>
            <View style={s.table}>
              <View style={s.trHeader}>
                <Text style={[s.th, { flex: 1 }]}>Detalle</Text>
                <Text style={[s.th, { width: 60, textAlign: "right" }]}>
                  Unidades
                </Text>
                <Text style={[s.th, { width: 80, textAlign: "right" }]}>
                  V. unit.
                </Text>
                <Text style={[s.th, { width: 80, textAlign: "right" }]}>
                  Subtotal
                </Text>
              </View>
              {data.concepts.map((c, idx) => {
                const u = toNum(c.units);
                const v = toNum(c.unitValue);
                // UNIDADES en "importe directo" — sin desglose, total en
                // fixedAmount. Detectamos por la ausencia de u×v.
                const unidadesFlat =
                  c.type === "UNIDADES" && !(u > 0 && v > 0);
                const subtotal =
                  c.type === "UNIDADES"
                    ? unidadesFlat
                      ? toNum(c.fixedAmount)
                      : u * v
                    : c.type === "FIJO"
                      ? toNum(c.fixedAmount)
                      : 0;
                const isLast = idx === data.concepts.length - 1;
                return (
                  <View
                    // biome-ignore lint/suspicious/noArrayIndexKey: PDF render — el orden es estable y no hay id estable en el snapshot
                    key={idx}
                    style={[s.tr, isLast ? { borderBottomWidth: 0 } : {}]}
                    wrap={false}
                  >
                    <View style={[s.td, { flex: 1 }]}>
                      <Text>{conceptLineLabel(c)}</Text>
                      {c.additionalDetail ? (
                        <Text
                          style={{
                            fontSize: 8,
                            color: C.slate500,
                            marginTop: 2,
                          }}
                        >
                          {c.additionalDetail}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[s.td, { width: 60, textAlign: "right" }]}>
                      {c.type === "UNIDADES" && !unidadesFlat ? u : "—"}
                    </Text>
                    <Text style={[s.td, { width: 80, textAlign: "right" }]}>
                      {c.type === "UNIDADES" && !unidadesFlat
                        ? ARS.format(v)
                        : "—"}
                    </Text>
                    <Text
                      style={[
                        s.td,
                        {
                          width: 80,
                          textAlign: "right",
                          fontWeight: subtotal > 0 ? "bold" : "normal",
                        },
                      ]}
                    >
                      {c.type === "DESCRIPTIVO" ? "—" : ARS.format(subtotal)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Repuestos */}
        {data.parts.length > 0 || data.partsNote ? (
          <View>
            <Text style={s.sectionTitle}>Repuestos</Text>
            {data.parts.length > 0 ? (
              <View style={s.table}>
                <View style={s.trHeader}>
                  <Text style={[s.th, { width: 50, textAlign: "right" }]}>
                    Cant.
                  </Text>
                  <Text style={[s.th, { flex: 1 }]}>Descripción</Text>
                  <Text style={[s.th, { width: 80, textAlign: "right" }]}>
                    P. unit.
                  </Text>
                  <Text style={[s.th, { width: 80, textAlign: "right" }]}>
                    Subtotal
                  </Text>
                </View>
                {data.parts.map((p, idx) => {
                  const subtotal = toNum(p.quantity) * toNum(p.unitPrice);
                  const isLast = idx === data.parts.length - 1;
                  return (
                    <View
                      // biome-ignore lint/suspicious/noArrayIndexKey: PDF render — orden estable, sin id
                      key={idx}
                      style={[s.tr, isLast ? { borderBottomWidth: 0 } : {}]}
                      wrap={false}
                    >
                      <Text style={[s.td, { width: 50, textAlign: "right" }]}>
                        {toNum(p.quantity)}
                      </Text>
                      <Text style={[s.td, { flex: 1 }]}>{p.description}</Text>
                      <Text style={[s.td, { width: 80, textAlign: "right" }]}>
                        {ARS.format(toNum(p.unitPrice))}
                      </Text>
                      <Text
                        style={[
                          s.td,
                          {
                            width: 80,
                            textAlign: "right",
                            fontWeight: "bold",
                          },
                        ]}
                      >
                        {ARS.format(subtotal)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {data.partsNote ? (
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 9,
                  fontStyle: "italic",
                  color: C.slate500,
                }}
              >
                {data.partsNote}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Totales */}
        <View style={s.totalsBox}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotal mano de obra</Text>
            <Text style={s.totalsValue}>
              {ARS.format(data.totals.laborSubtotal)}
            </Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>IVA {data.totals.ivaRate}%</Text>
            <Text style={s.totalsValue}>
              {ARS.format(data.totals.ivaAmount)}
            </Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Mano de obra c/IVA</Text>
            <Text style={s.totalsValue}>
              {ARS.format(data.totals.laborTotal)}
            </Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Repuestos</Text>
            <Text style={s.totalsValue}>
              {ARS.format(data.totals.partsSubtotal)}
            </Text>
          </View>
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>TOTAL</Text>
            <Text style={s.grandTotalValue}>
              {ARS.format(data.totals.grandTotal)}
            </Text>
          </View>
        </View>

        {/* Condiciones */}
        <Text style={s.sectionTitle}>Condiciones</Text>
        <View style={s.box}>
          <View style={s.row}>
            <Text style={s.label}>Validez</Text>
            <Text style={s.value}>
              {data.conditions.validityDays} día(s) desde la fecha de emisión
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Entrega</Text>
            <Text style={s.value}>
              {data.conditions.deliveryDays} día(s) hábiles desde la aceptación
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Pago</Text>
            <Text style={s.value}>{data.conditions.paymentCondition}</Text>
          </View>
          {/* Notas internas omitidas del PDF — son información de la empresa,
              no del cliente. Permanecen guardadas y visibles en el admin. */}
        </View>

        <Text style={s.footer} fixed>
          {data.company.name} · {data.company.address} · Tel:{" "}
          {data.company.phone} · {data.company.email}
        </Text>
      </Page>
    </Document>
  );
}
