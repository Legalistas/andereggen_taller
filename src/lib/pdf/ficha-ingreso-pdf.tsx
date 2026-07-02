/**
 * Ficha de Ingreso/Egreso — PDF que firma el cliente al ingresar el auto
 * y al retirarlo. Una sola hoja A4 con dos secciones:
 *   1. FICHA INGRESO (acepta presupuesto, declara objetos, condición de pago)
 *   2. CONFORMIDAD DE REPARACIONES (al retirar)
 *
 * Layout: el mismo que la planilla original que el taller venía usando.
 * Sin cajas/badges/colores extra — solo logo + contacto, datos en texto
 * plano, manifiesto, firmas, conformidad. Los campos en amarillo son los
 * que la UI permite editar antes de imprimir (seguro, seg. tec., franquicia).
 */

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type FichaIngresoData = {
  date: string;
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
  highlights: {
    insurance: string;
    technicalInsurance: string;
    franchiseAmount: string;
  };
  franchiseLabel: string;
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
} as const;

const s = StyleSheet.create({
  page: {
    paddingHorizontal: 36,
    paddingVertical: 30,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: C.ink,
    lineHeight: 1.4,
  },

  // Header simple: logo izquierda, contacto derecha
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  logo: { width: 150, height: 52, objectFit: "contain" },
  contactBlock: { textAlign: "right", fontSize: 9 },

  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 14,
    marginTop: 4,
  },

  // Datos cliente/vehículo: filas con dos columnas, label bold + valor
  dataBlock: { marginBottom: 10 },
  dataRow: { flexDirection: "row", marginBottom: 3 },
  dataCol: { flexDirection: "row", flex: 1, alignItems: "flex-start" },
  dataLabel: { fontWeight: "bold", marginRight: 4 },
  dataValue: {},
  highlight: {},

  // Manifiesto en texto plano
  paragraph: { marginBottom: 4, lineHeight: 1.45 },
  inlineLabel: { fontWeight: "bold" },

  // Firmas
  signatureRow: {
    flexDirection: "row",
    marginTop: 18,
    gap: 28,
  },
  signatureField: {
    flexDirection: "row",
    alignItems: "flex-end",
    flex: 1,
  },
  signatureLabel: {
    fontWeight: "bold",
    marginRight: 6,
  },
  signatureLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
    height: 1,
  },

  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
    marginVertical: 14,
  },

  conformidadTitle: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    marginTop: 4,
  },
});

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
    >
      <Page size="A4" style={s.page}>
        {/* Header: logo izquierda, contacto derecha. Sin barra de color, sin badge. */}
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

        {/* Datos cliente/vehículo en dos columnas, texto plano */}
        <View style={s.dataBlock}>
          <View style={s.dataRow}>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Fecha:</Text>
              <Text style={s.dataValue}>{data.date}</Text>
            </View>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Vehículo:</Text>
              <Text style={s.dataValue}>{data.vehicle.brandModel}</Text>
            </View>
          </View>
          <View style={s.dataRow}>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Titular:</Text>
              <Text style={s.dataValue}>
                {data.customer.name.toUpperCase()}
              </Text>
            </View>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Dominio:</Text>
              <Text style={s.dataValue}>{data.vehicle.domain}</Text>
              <Text style={[s.dataLabel, { marginLeft: 16 }]}>Año:</Text>
              <Text style={s.dataValue}>{data.vehicle.year}</Text>
            </View>
          </View>
          <View style={s.dataRow}>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Direc.:</Text>
              <Text style={s.dataValue}>{data.customer.address}</Text>
            </View>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Teléfono:</Text>
              <Text style={s.dataValue}>{data.customer.phone}</Text>
            </View>
          </View>
          <View style={s.dataRow}>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Loc.:</Text>
              <Text style={s.dataValue}>
                {data.customer.locality.toUpperCase()}
              </Text>
            </View>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Seguro:</Text>
              <Text style={s.highlight}>{data.highlights.insurance || " "}</Text>
              <Text style={[s.dataLabel, { marginLeft: 12 }]}>Seg. Tec.:</Text>
              <Text style={s.highlight}>
                {data.highlights.technicalInsurance || " "}
              </Text>
            </View>
          </View>
        </View>

        {/* Manifiesto en texto plano */}
        <Text style={s.paragraph}>
          Manifiesto aceptación para la realización del trabajo conforme al
          presupuesto N°{" "}
          <Text style={s.inlineLabel}>{data.budgetNumber}</Text> enviado y
          aprobado por mi compañía de seguros.
        </Text>
        <Text style={s.paragraph}>
          Declaro no poseer objetos de valor en el vehículo.
        </Text>
        <Text style={s.paragraph}>
          Autorizo la difusión de imágenes/videos del vehículo, sin exhibir patente.
        </Text>
        <Text style={s.paragraph}>
          Condición de pago: {data.paymentCondition}.
        </Text>
        <View style={[s.dataRow, { flexWrap: "wrap" }]}>
          <Text style={s.inlineLabel}>{data.franchiseLabel}{" "}</Text>
          <Text style={s.highlight}>
            {data.highlights.franchiseAmount || "-"}
          </Text>
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

        <Text style={s.conformidadTitle}>CONFORMIDAD DE REPARACIONES</Text>

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
