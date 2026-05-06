/**
 * Ficha Técnica — PDF interno que se imprime y se pega en el auto cuando
 * ingresa al taller. NO va al cliente.
 *
 * Datos: Nro de presupuesto + datos del vehículo + detalle de trabajo
 * agrupado por categoría con bullets de subdetalles.
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
    logoUrl?: string | null;
  };
};

const C = {
  ink: "#000",
  slate700: "#374151",
  slate500: "#6b7280",
  slate300: "#d1d5db",
} as const;

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: C.ink,
    lineHeight: 1.4,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  logo: { width: 220, height: 76, objectFit: "contain" },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 1,
  },
  numberRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
    fontSize: 12,
  },
  numberLabel: { fontWeight: "bold", marginRight: 6 },
  // Tabla simple: 3 columnas (label | value | label2 | value2 — etc.)
  metaTable: {
    borderWidth: 1,
    borderColor: C.ink,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
    minHeight: 22,
  },
  metaRowLast: { borderBottomWidth: 0 },
  metaCell: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: C.ink,
  },
  metaCellLast: { borderRightWidth: 0 },
  metaLabel: { fontWeight: "bold" },
  detailHeader: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 2,
  },
  bullet: {
    flexDirection: "row",
    paddingLeft: 14,
    marginBottom: 1,
  },
  bulletDot: { marginRight: 4 },
});

function fmtDate(d: Date) {
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function FichaTecnicaPdf({ data }: { data: FichaTecnicaData }) {
  return (
    <Document title={`Ficha Técnica #${data.number}`}>
      <Page size="A4" style={s.page}>
        {data.company.logoUrl ? (
          <View style={s.logoWrap}>
            <Image src={data.company.logoUrl} style={s.logo} />
          </View>
        ) : null}

        <Text style={s.title}>FICHA TÉCNICA</Text>

        <View style={s.numberRow}>
          <Text style={s.numberLabel}>Nro.:</Text>
          <Text>{data.number}</Text>
        </View>

        {/* Vehículo / Año / Color en grilla */}
        <View style={s.metaTable}>
          <View style={s.metaRow}>
            <Text style={[s.metaCell, s.metaLabel, { width: 70 }]}>
              Vehículo:
            </Text>
            <Text style={[s.metaCell, { flex: 1 }]}>
              {`${data.vehicle.brand} ${data.vehicle.model}`.trim()}
            </Text>
            <Text style={[s.metaCell, s.metaLabel, { width: 50 }]}>Año:</Text>
            <Text style={[s.metaCell, { width: 60 }]}>
              {data.vehicle.year}
            </Text>
            <Text style={[s.metaCell, s.metaLabel, { width: 55 }]}>
              Color:
            </Text>
            <Text style={[s.metaCell, s.metaCellLast, { width: 90 }]}>
              {data.vehicle.color ?? ""}
            </Text>
          </View>
          <View style={[s.metaRow, s.metaRowLast]}>
            <Text style={[s.metaCell, s.metaLabel, { width: 70 }]}>
              Dominio:
            </Text>
            <Text style={[s.metaCell, s.metaCellLast, { flex: 1 }]}>
              {data.vehicle.domain}
            </Text>
          </View>
        </View>

        <Text style={s.detailHeader}>Detalle:</Text>

        {data.sections.map((sec) => (
          <View key={sec.title} wrap={false}>
            <Text style={s.sectionTitle}>{`→ ${sec.title}:`}</Text>
            {sec.bullets.map((b, idx) => (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: PDF render — orden estable
                key={`${sec.title}-${idx}`}
                style={s.bullet}
              >
                <Text style={s.bulletDot}>•</Text>
                <Text style={{ flex: 1 }}>{b}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text
          style={{
            position: "absolute",
            bottom: 20,
            left: 40,
            right: 40,
            fontSize: 8,
            color: C.slate500,
            textAlign: "right",
          }}
          fixed
        >
          {data.company.name} · Impreso {fmtDate(new Date())}
        </Text>
      </Page>
    </Document>
  );
}
