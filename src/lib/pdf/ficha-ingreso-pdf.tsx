/**
 * Ficha de Ingreso/Egreso — PDF que firma el cliente al ingresar el auto
 * y al retirarlo. Una sola hoja A4 con dos secciones:
 *   1. FICHA INGRESO (acepta presupuesto, declara objetos, condición de pago)
 *   2. CONFORMIDAD DE REPARACIONES (al retirar)
 *
 * Los campos resaltados en amarillo son los que la UI permite editar antes
 * de imprimir (seguro, seg. técnico, monto franquicia).
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
  ink: "#000",
  slate700: "#374151",
  slate500: "#6b7280",
  slate200: "#e5e7eb",
  highlight: "#fff4a3", // amarillo tipo marcador
} as const;

const s = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: C.ink,
    lineHeight: 1.4,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  logo: { width: 165, height: 56, objectFit: "contain" },
  contactBlock: { textAlign: "right", fontSize: 9 },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: 1,
  },
  // Datos cliente/vehículo
  metaRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  metaLabel: { fontWeight: "bold", marginRight: 4 },
  highlight: {
    backgroundColor: C.highlight,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
    marginVertical: 14,
  },
  paragraph: { marginBottom: 4 },
  signatureRow: {
    flexDirection: "row",
    marginTop: 28,
    gap: 24,
  },
  signatureField: {
    flexDirection: "row",
    alignItems: "flex-end",
    flex: 1,
  },
  signatureLabel: { fontWeight: "bold", marginRight: 6 },
  signatureLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
    height: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    marginTop: 4,
    letterSpacing: 0.5,
  },
});

/** Field con label en negrita seguido de valor inline */
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
    <View style={s.metaRow}>
      <Text style={s.metaLabel}>{label}</Text>
      {highlight ? (
        <Text style={s.highlight}>{value}</Text>
      ) : (
        <Text>{value}</Text>
      )}
    </View>
  );
}

/** Campo de firma: label + línea horizontal */
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
    <Document title={`Ficha Ingreso #${data.budgetNumber}`}>
      <Page size="A4" style={s.page}>
        {/* Header con logo y contacto */}
        <View style={s.header}>
          {data.company.logoUrl ? (
            <Image src={data.company.logoUrl} style={s.logo} />
          ) : (
            <View />
          )}
          <View style={s.contactBlock}>
            <Text>{data.company.address}</Text>
            <Text>Tel.: {data.company.phone}</Text>
            <Text>E-mail: {data.company.email}</Text>
          </View>
        </View>

        <Text style={s.title}>FICHA INGRESO</Text>

        {/* Datos cliente / vehículo en dos columnas */}
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Field label="Fecha:" value={data.date} />
            <Field label="Titular:" value={data.customer.name.toUpperCase()} />
            <Field label="Direc.:" value={data.customer.address} />
            <Field label="Loc.:" value={data.customer.locality.toUpperCase()} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Vehículo:" value={data.vehicle.brandModel} />
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Field label="Dominio:" value={data.vehicle.domain} />
              <Field label="Año:" value={data.vehicle.year} />
            </View>
            <Field label="Teléfono:" value={data.customer.phone} />
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Field
                label="Seguro:"
                value={data.highlights.insurance || "—"}
                highlight
              />
              <Field
                label="Seg. Tec.:"
                value={data.highlights.technicalInsurance || "—"}
                highlight
              />
            </View>
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={s.paragraph}>
            Manifiesto aceptación para la realización del trabajo conforme al
            presupuesto N°{" "}
            <Text style={{ fontWeight: "bold" }}>{data.budgetNumber}</Text>{" "}
            enviado y aprobado por mi compañía de seguros.
          </Text>
          <Text style={s.paragraph}>
            Declaro no poseer objetos de valor en el vehículo.
          </Text>
          <Text style={s.paragraph}>
            Condición de pago: {data.paymentCondition}.
          </Text>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>
              Monto de franquicia a abonar en efectivo al retirar el rodado:
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
        <Text style={s.sectionTitle}>CONFORMIDAD DE REPARACIONES</Text>

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
