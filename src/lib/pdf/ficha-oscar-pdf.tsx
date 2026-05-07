/**
 * Ficha Oscar — PDF interno que se imprime ANTES de enviar el presupuesto
 * al cliente. Va a manos de Oscar/Alfredo para que finalicen la cotización
 * (revisión técnica, ajuste de precios, etc.) sobre lo que pre-armó la
 * administración.
 *
 * Contenido:
 *   - Datos cliente: titular, vehículo, dominio, ppto nro, fecha,
 *     seguro y seg. técnico.
 *   - Notas (observaciones del presupuesto).
 *   - Detalle del trabajo (mismas secciones DESCRIPTIVAS que el budget).
 *   - Repuestos: items de la pestaña Administrativa con cotizaciones de
 *     proveedores (si las hay).
 *
 * Estilo: simple/funcional, igual que ficha-ingreso. NUNCA va al cliente.
 */

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type FichaOscarSection = {
  title: string;
  bullets: string[];
};

export type FichaOscarQuote = {
  supplierName: string;
  /** Precio bruto formateado en ARS */
  price: string;
  /** Precio neto formateado en ARS — igual a price si no hay descuento */
  netPrice: string;
  /** Porcentaje 0–100 (null si no se cargó) */
  discount: number | null;
  partCode: string | null;
  availability: string | null;
  photos: string[];
  notes: string | null;
};

export type FichaOscarPart = {
  description: string;
  notes: string | null;
  quotes: FichaOscarQuote[];
};

export type FichaOscarData = {
  date: string;
  budgetNumber: number;
  customer: { name: string };
  vehicle: { brandModel: string; domain: string; year: string };
  highlights: { insurance: string; technicalInsurance: string };
  notes: string;
  sections: FichaOscarSection[];
  parts: FichaOscarPart[];
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
  slate500: "#64748b",
  slate200: "#e2e8f0",
  slate50: "#f8fafc",
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
    marginBottom: 12,
    marginTop: 4,
  },

  // Datos cliente/vehículo
  dataBlock: { marginBottom: 10 },
  dataRow: { flexDirection: "row", marginBottom: 3 },
  dataCol: { flexDirection: "row", flex: 1, alignItems: "flex-start" },
  dataLabel: { fontWeight: "bold", marginRight: 4 },
  dataValue: { flex: 1 },

  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.slate200,
    marginVertical: 8,
  },

  // Notas
  notesBlock: {
    marginTop: 6,
    marginBottom: 8,
    padding: 8,
    backgroundColor: C.slate50,
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 3,
  },
  blockTitle: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    color: C.slate500,
  },
  notesText: { fontSize: 10, lineHeight: 1.45 },

  // Detalle del trabajo
  detailTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 4,
    marginBottom: 4,
  },
  workSectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 6,
    marginBottom: 2,
  },
  workSectionTitleFirst: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: "row",
    paddingLeft: 10,
    marginBottom: 1,
  },
  bulletDot: {
    marginRight: 5,
    fontWeight: "bold",
  },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.4 },

  // Repuestos
  partsTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 6,
  },
  partItem: {
    marginBottom: 6,
    paddingBottom: 4,
  },
  partDesc: {
    fontSize: 10,
    fontWeight: "bold",
  },
  partNotes: { fontSize: 9, color: C.slate500, marginTop: 1 },
  quoteRow: {
    flexDirection: "row",
    paddingLeft: 12,
    marginTop: 1,
  },
  quoteDash: { marginRight: 5 },
  quoteSupplier: { flex: 1, fontSize: 9 },
  quotePrice: { fontSize: 9, fontWeight: "bold", marginLeft: 6 },
  quotePriceStrike: {
    fontSize: 8,
    color: C.slate500,
    textDecoration: "line-through",
    marginLeft: 6,
  },
  quoteDiscount: {
    fontSize: 8,
    color: C.slate500,
    marginLeft: 4,
  },
  quoteMeta: {
    fontSize: 8,
    color: C.slate500,
    paddingLeft: 22,
    marginTop: 1,
  },
  quoteNotes: { fontSize: 8, color: C.slate500, marginLeft: 12 },

  empty: {
    fontSize: 9,
    fontStyle: "italic",
    color: C.slate500,
    paddingLeft: 6,
  },
});

function ArrowSection({
  title,
  bullets,
  isFirst,
}: {
  title: string;
  bullets: string[];
  isFirst: boolean;
}) {
  return (
    <View wrap={false}>
      <Text style={isFirst ? s.workSectionTitleFirst : s.workSectionTitle}>
        {`→ ${title}`}
      </Text>
      {bullets.map((b, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: orden estable
          key={`${title}-${i}`}
          style={s.bulletRow}
        >
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

export function FichaOscarPdf({ data }: { data: FichaOscarData }) {
  return (
    <Document
      title={`Ficha Oscar #${data.budgetNumber}`}
      author={data.company.name}
    >
      <Page size="A4" style={s.page}>
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

        <Text style={s.title}>FICHA OSCAR</Text>

        {/* Datos cliente / vehículo */}
        <View style={s.dataBlock}>
          <View style={s.dataRow}>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Titular:</Text>
              <Text style={s.dataValue}>
                {data.customer.name.toUpperCase()}
              </Text>
            </View>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Ppto Nro:</Text>
              <Text style={s.dataValue}>{data.budgetNumber}</Text>
            </View>
          </View>
          <View style={s.dataRow}>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Vehículo:</Text>
              <Text style={s.dataValue}>
                {`${data.vehicle.brandModel} ${data.vehicle.year}`.trim()}
              </Text>
            </View>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Dominio:</Text>
              <Text style={s.dataValue}>{data.vehicle.domain}</Text>
            </View>
          </View>
          <View style={s.dataRow}>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Fecha:</Text>
              <Text style={s.dataValue}>{data.date}</Text>
            </View>
            <View style={s.dataCol} />
          </View>
          <View style={s.dataRow}>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Seguro:</Text>
              <Text style={s.dataValue}>{data.highlights.insurance || "—"}</Text>
            </View>
            <View style={s.dataCol}>
              <Text style={s.dataLabel}>Seg. Tec.:</Text>
              <Text style={s.dataValue}>
                {data.highlights.technicalInsurance || "—"}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Notas */}
        {data.notes.trim() !== "" && (
          <View style={s.notesBlock}>
            <Text style={s.blockTitle}>Notas</Text>
            <Text style={s.notesText}>{data.notes.trim()}</Text>
          </View>
        )}

        {/* Detalle del trabajo */}
        <Text style={s.detailTitle}>Detalle:</Text>
        {data.sections.length === 0 ? (
          <Text style={s.empty}>Sin secciones cargadas en el presupuesto.</Text>
        ) : (
          data.sections.map((sec, idx) => (
            <ArrowSection
              key={sec.title}
              title={sec.title}
              bullets={sec.bullets}
              isFirst={idx === 0}
            />
          ))
        )}

        {/* Repuestos */}
        {data.parts.length > 0 && (
          <>
            <Text style={s.partsTitle}>Repuestos:</Text>
            {data.parts.map((p, idx) => (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: orden estable
                key={`part-${idx}`}
                style={s.partItem}
                wrap={false}
              >
                <Text style={s.partDesc}>• {p.description}</Text>
                {p.notes ? (
                  <Text style={s.partNotes}>{p.notes}</Text>
                ) : null}
                {p.quotes.length > 0 ? (
                  p.quotes.map((q, qi) => {
                    const supplierLine = [
                      q.supplierName,
                      q.partCode ? `cód. ${q.partCode}` : null,
                      q.availability ?? null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    const hasDiscount =
                      q.discount !== null && q.discount > 0;
                    const metaLine = [
                      q.notes ? `(${q.notes})` : null,
                      q.photos.length > 0
                        ? `Fotos: ${q.photos.join(" | ")}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join("   ");
                    return (
                      <View
                        // biome-ignore lint/suspicious/noArrayIndexKey: orden estable
                        key={`q-${idx}-${qi}`}
                      >
                        <View style={s.quoteRow}>
                          <Text style={s.quoteDash}>—</Text>
                          <Text style={s.quoteSupplier}>{supplierLine}</Text>
                          {hasDiscount && (
                            <>
                              <Text style={s.quotePriceStrike}>{q.price}</Text>
                              <Text style={s.quoteDiscount}>
                                -{q.discount}%
                              </Text>
                            </>
                          )}
                          <Text style={s.quotePrice}>{q.netPrice}</Text>
                        </View>
                        {metaLine !== "" && (
                          <Text style={s.quoteMeta}>{metaLine}</Text>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={s.empty}>Sin cotizaciones.</Text>
                )}
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}
