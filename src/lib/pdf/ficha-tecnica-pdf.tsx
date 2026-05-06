/**
 * Ficha Técnica — PDF interno que se imprime y se pega en el auto cuando
 * ingresa al taller. NO va al cliente.
 *
 * Datos: Nro de presupuesto + datos del vehículo + detalle de trabajo
 * agrupado por categoría con bullets de subdetalles.
 *
 * Estilo: mismo header/typography que budget-pdf y ficha-ingreso-pdf
 * (logo + contacto + barra brand color + badge con número).
 *
 * Editable: la UI permite agregar/quitar/modificar bullets antes de imprimir
 * (los overrides llegan ya armados al payload `sections`).
 */

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type FichaTecnicaSection = {
  /** Header del bloque, ej: "DESMONTAR Y RESTAURAR" */
  title: string;
  /** Bullets — texto libre, ya en mayúscula/casing como deba imprimirse */
  bullets: string[];
};

export type FichaTecnicaData = {
  number: number;
  vehicle: {
    brand: string;
    model: string;
    year: string;
    domain: string;
    color: string | null;
  };
  sections: FichaTecnicaSection[];
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string | null;
  };
};

const C = {
  brand: "#003b73",
  ink: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate200: "#e2e8f0",
  slate50: "#f8fafc",
} as const;

const s = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: C.slate700,
    lineHeight: 1.4,
  },

  // ─── Header (mismo patrón que budget-pdf) ──────────────────────────
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
  logo: { width: 138, height: 48, marginBottom: 8, objectFit: "contain" },
  companyLine: { fontSize: 8, color: C.slate500 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: C.brand,
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

  // ─── Datos del vehículo en box (estilo budget) ─────────────────────
  sectionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: C.brand,
    marginBottom: 6,
    marginTop: 4,
  },
  box: {
    padding: 10,
    backgroundColor: C.slate50,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.slate200,
  },
  fieldsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  fieldCell: {
    flexDirection: "row",
    paddingVertical: 2,
    paddingRight: 16,
  },
  fieldLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: C.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginRight: 4,
  },
  fieldValue: { fontSize: 10, color: C.ink },

  // ─── Detalle ───────────────────────────────────────────────────────
  detailBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "white",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.slate200,
  },
  detailTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: C.brand,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  workSectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: C.ink,
    marginTop: 10,
    marginBottom: 4,
  },
  workSectionTitleFirst: {
    fontSize: 11,
    fontWeight: "bold",
    color: C.ink,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: "row",
    paddingLeft: 14,
    marginBottom: 2,
  },
  bulletDot: {
    marginRight: 6,
    color: C.brand,
    fontWeight: "bold",
  },
  bulletText: { flex: 1, fontSize: 10, color: C.ink, lineHeight: 1.5 },

  // ─── Footer ────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 8,
    color: C.slate500,
    textAlign: "right",
    borderTopWidth: 1,
    borderTopColor: C.slate200,
    paddingTop: 6,
  },
});

function fmtDate(d: Date) {
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Field con label en negrita seguido de valor */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.fieldCell}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{value || "—"}</Text>
    </View>
  );
}

export function FichaTecnicaPdf({ data }: { data: FichaTecnicaData }) {
  return (
    <Document
      title={`Ficha Técnica #${data.number}`}
      author={data.company.name}
    >
      <Page size="A4" style={s.page}>
        {/* Header — mismo estilo que el presupuesto */}
        <View style={s.header}>
          <View style={s.companyBlock}>
            {data.company.logoUrl ? (
              <Image src={data.company.logoUrl} style={s.logo} />
            ) : null}
            <Text style={s.companyLine}>{data.company.address}</Text>
            <Text style={s.companyLine}>
              Tel: {data.company.phone} · {data.company.email}
            </Text>
          </View>
          <View style={s.badge}>
            <Text style={s.badgeTitle}>Ficha Técnica</Text>
            <Text style={s.badgeNumber}>#{data.number}</Text>
            <Text style={s.badgeDate}>Emitida: {fmtDate(new Date())}</Text>
          </View>
        </View>

        {/* Datos del vehículo en un box estilo budget */}
        <Text style={s.sectionTitle}>Vehículo</Text>
        <View style={s.box}>
          <View style={s.fieldsGrid}>
            <Field
              label="Vehículo"
              value={`${data.vehicle.brand} ${data.vehicle.model}`.trim()}
            />
            <Field label="Año" value={data.vehicle.year} />
            <Field label="Color" value={data.vehicle.color ?? ""} />
            <Field label="Dominio" value={data.vehicle.domain} />
          </View>
        </View>

        {/* Detalle del trabajo */}
        <View style={s.detailBox}>
          <Text style={s.detailTitle}>Detalle del trabajo a realizar</Text>
          {data.sections.length === 0 ? (
            <Text style={{ fontSize: 10, fontStyle: "italic", color: C.slate500 }}>
              Sin secciones cargadas.
            </Text>
          ) : (
            data.sections.map((sec, idx) => (
              <View key={sec.title} wrap={false}>
                <Text
                  style={
                    idx === 0 ? s.workSectionTitleFirst : s.workSectionTitle
                  }
                >
                  {`→ ${sec.title}`}
                </Text>
                {sec.bullets.map((b, bIdx) => (
                  <View
                    // biome-ignore lint/suspicious/noArrayIndexKey: orden estable
                    key={`${sec.title}-${bIdx}`}
                    style={s.bulletRow}
                  >
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>

        <Text style={s.footer} fixed>
          {data.company.name} · Impresa {fmtDate(new Date())}
        </Text>
      </Page>
    </Document>
  );
}
