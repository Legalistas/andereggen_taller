/**
 * Ficha de Ingreso/Egreso — PDF que firma el cliente al ingresar el auto
 * y al retirarlo. Una sola hoja A4 con dos secciones:
 *   1. FICHA INGRESO (acepta presupuesto, declara objetos, condición de pago)
 *   2. CONFORMIDAD DE REPARACIONES (al retirar)
 *
 * Los campos resaltados en amarillo son los que la UI permite editar antes
 * de imprimir (seguro, seg. técnico, monto franquicia).
 *
 * Estilo: mismo header/typography que budget-pdf para mantener look-and-feel.
 */

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type FichaIngresoData = {
  date: string; // ya formateada DD/MM/YYYY
  budgetNumber: number;
  customer: {
    name: string;
    address: string;
    locality: string;
    phone: string;
    dni?: string | null;
  };
  vehicle: {
    brandModel: string;
    year: string;
    domain: string;
  };
  /** Resaltados — editables en el dialog antes de imprimir */
  highlights: {
    insurance: string; // "LA SEGUNDA"
    technicalInsurance: string; // "SAN CRISTOBAL" — seguro del tercero o seg. técnico
    franchiseAmount: string; // "$ 250.000,00" o "-"
  };
  paymentCondition: string;
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
  highlight: "#fff4a3", // amarillo marcador
} as const;

const s = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: C.slate700,
    lineHeight: 1.4,
  },
  // ─── Header con logo + contacto + badge ──────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.brand,
    marginBottom: 14,
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

  // ─── Datos cliente/vehículo (estilo budget) ──────────────────────
  sectionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: C.brand,
    marginBottom: 6,
    marginTop: 4,
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
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  label: {
    fontSize: 8,
    fontWeight: "bold",
    color: C.slate500,
    width: 65,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  value: { fontSize: 9, color: C.ink, flex: 1 },
  highlight: {
    backgroundColor: C.highlight,
    paddingHorizontal: 3,
    paddingVertical: 0,
    fontWeight: "bold",
  },

  // ─── Manifiesto y firmas ─────────────────────────────────────────
  manifiestoBlock: { marginTop: 12, marginBottom: 8 },
  paragraph: { marginBottom: 5, lineHeight: 1.45 },
  paragraphLast: { marginBottom: 5 },
  franchiseRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    marginBottom: 6,
  },
  franchiseLabel: { fontWeight: "bold" },
  signatureRow: {
    flexDirection: "row",
    marginTop: 22,
    gap: 24,
  },
  signatureField: {
    flexDirection: "row",
    alignItems: "flex-end",
    flex: 1,
  },
  signatureLabel: {
    fontWeight: "bold",
    marginRight: 6,
    fontSize: 9,
  },
  signatureLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: C.slate700,
    height: 1,
  },

  // ─── Sección Conformidad ─────────────────────────────────────────
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.slate200,
    marginVertical: 14,
  },
  conformidadTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: C.brand,
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});

/** Field con label en negrita seguido de valor (con o sin highlight) */
function Field({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      {highlight ? (
        <Text style={[s.value, s.highlight]}>{value}</Text>
      ) : (
        <Text style={s.value}>{value}</Text>
      )}
    </View>
  );
}

/** Línea horizontal con label en negrita para firmar */
function SignField({ label, flex = 1 }: { label: string; flex?: number }) {
  return (
    <View style={[s.signatureField, { flex }]}>
      <Text style={s.signatureLabel}>{label}</Text>
      <View style={s.signatureLine} />
    </View>
  );
}

export function FichaIngresoPdf({ data }: { data: FichaIngresoData }) {
  return (
    <Document
      title={`Ficha Ingreso #${data.budgetNumber}`}
      author={data.company.name}
      subject={`Ficha de Ingreso/Egreso #${data.budgetNumber} — ${data.customer.name}`}
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
            <Text style={s.badgeTitle}>Ficha Ingreso</Text>
            <Text style={s.badgeNumber}>#{data.budgetNumber}</Text>
            <Text style={s.badgeDate}>Fecha: {data.date}</Text>
          </View>
        </View>

        {/* Cliente + Vehículo en dos boxes con sectionTitle (estilo budget) */}
        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Cliente</Text>
            <View style={s.box}>
              <Field label="Titular" value={data.customer.name.toUpperCase()} />
              <Field label="Dirección" value={data.customer.address} />
              <Field
                label="Localidad"
                value={data.customer.locality.toUpperCase()}
              />
              <Field label="Teléfono" value={data.customer.phone} />
              {data.customer.dni ? (
                <Field label="DNI" value={data.customer.dni} />
              ) : null}
            </View>
          </View>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Vehículo</Text>
            <View style={s.box}>
              <Field label="Vehículo" value={data.vehicle.brandModel} />
              <Field label="Dominio" value={data.vehicle.domain} />
              <Field label="Año" value={data.vehicle.year} />
              <Field
                label="Seguro"
                value={data.highlights.insurance || "—"}
                highlight
              />
              <Field
                label="Seg. Tec."
                value={data.highlights.technicalInsurance || "—"}
                highlight
              />
            </View>
          </View>
        </View>

        {/* Manifiesto */}
        <View style={s.manifiestoBlock}>
          <Text style={s.paragraph}>
            Manifiesto aceptación para la realización del trabajo conforme al
            presupuesto N°{" "}
            <Text style={{ fontWeight: "bold", color: C.ink }}>
              {data.budgetNumber}
            </Text>{" "}
            enviado y aprobado por mi compañía de seguros.
          </Text>
          <Text style={s.paragraph}>
            Declaro no poseer objetos de valor en el vehículo.
          </Text>
          <Text style={s.paragraph}>
            Condición de pago: {data.paymentCondition}.
          </Text>
          <View style={s.franchiseRow}>
            <Text style={s.franchiseLabel}>
              Monto de franquicia a abonar en efectivo al retirar el rodado:{" "}
            </Text>
            <Text style={s.highlight}>
              {data.highlights.franchiseAmount || "-"}
            </Text>
          </View>
        </View>

        <View style={s.signatureRow}>
          <SignField label="Fecha:" flex={1} />
        </View>
        <View style={s.signatureRow}>
          <SignField label="Firma:" flex={1.2} />
          <SignField label="Aclaración:" flex={1.5} />
        </View>
        <View style={s.signatureRow}>
          <SignField label="D.N.I.:" flex={1.2} />
        </View>

        <View style={s.divider} />

        {/* Conformidad de Reparaciones */}
        <Text style={s.conformidadTitle}>Conformidad de Reparaciones</Text>

        <Text style={s.paragraph}>
          Por medio del presente manifiesto conformidad con las reparaciones
          efectuadas sobre el vehículo mencionado, recibiendo el mismo en este
          acto, no teniendo nada que objetar ni reclamar de mi parte ni de su
          titular.
        </Text>
        <Text style={s.paragraph}>
          En el eventual caso de que mi compañía de seguro no pague el importe
          correspondiente, me obligo a abonarlo en un plazo de 10 días.
        </Text>

        <View style={s.signatureRow}>
          <SignField label="Fecha:" flex={1} />
        </View>
        <View style={s.signatureRow}>
          <SignField label="Firma:" flex={1.2} />
          <SignField label="Aclaración:" flex={1.5} />
        </View>
      </Page>
    </Document>
  );
}
