/**
 * PDF landscape del tablero de KPIs — spec KPIs jul '26.
 * Usa `@react-pdf/renderer` (misma stack que Ficha Técnica).
 */

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { FlatRow } from "./export";

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 7,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#003b73",
  },
  subtitle: {
    fontSize: 8,
    color: "#666",
    marginBottom: 8,
  },
  row: { flexDirection: "row" },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    color: "white",
    padding: 3,
  },
  headerCell: {
    fontSize: 6,
    fontWeight: "bold",
    color: "white",
    textAlign: "right",
    padding: 2,
  },
  headerLabelCell: {
    fontSize: 6,
    fontWeight: "bold",
    color: "white",
    padding: 2,
    flex: 3,
  },
  currentCol: { backgroundColor: "#003b73" },
  groupRow: {
    flexDirection: "row",
    backgroundColor: "#3b6ba5",
    padding: 3,
  },
  groupLabel: {
    fontSize: 7,
    color: "white",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  subGroupRow: {
    flexDirection: "row",
    backgroundColor: "#dbe6f2",
    padding: 2,
  },
  subGroupLabel: {
    fontSize: 6,
    color: "#0f172a",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  dataRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    padding: 2,
  },
  labelCell: {
    fontSize: 7,
    flex: 3,
    color: "#0f172a",
  },
  numCell: {
    fontSize: 7,
    flex: 1,
    textAlign: "right",
    padding: 1,
  },
  numCellCurrent: {
    fontSize: 7,
    flex: 1,
    textAlign: "right",
    padding: 1,
    backgroundColor: "#dbeafe",
    fontWeight: "bold",
  },
  accCell: {
    fontSize: 7,
    flex: 1.2,
    textAlign: "right",
    padding: 1,
    backgroundColor: "#f1f5f9",
    fontWeight: "bold",
  },
  vmaGreen: { backgroundColor: "#d1fae5", color: "#065f46" },
  vmaYellow: { backgroundColor: "#fef3c7", color: "#92400e" },
  vmaRed: { backgroundColor: "#fee2e2", color: "#991b1b" },
  vmaNa: { backgroundColor: "#f3f4f6", color: "#6b7280" },
});

export function KpiPdfDocument({
  year,
  currentMonthIndex,
  rows,
}: {
  year: number;
  currentMonthIndex: number;
  rows: FlatRow[];
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Tablero de KPIs · Andereggen {year}</Text>
        <Text style={styles.subtitle}>
          Mes en curso resaltado en azul. VMA = variación vs mes anterior
          (verde ≥ 0, amarillo -5 a 0, rojo ≤ -5).
        </Text>

        <View style={styles.headerRow}>
          <Text style={styles.headerLabelCell}>Métrica</Text>
          <Text style={{ ...styles.headerCell, flex: 1.2 }}>Acum.</Text>
          {MONTH_LABELS.map((m, i) => (
            <Text
              key={m}
              style={{
                ...styles.headerCell,
                flex: 1,
                ...(i === currentMonthIndex ? styles.currentCol : {}),
              }}
            >
              {m}
            </Text>
          ))}
          <Text style={{ ...styles.headerCell, flex: 1 }}>VMA</Text>
        </View>

        {rows.map((r, idx) => {
          if (r.kind === "group") {
            return (
              <View key={`g-${idx}`} style={styles.groupRow}>
                <Text style={styles.groupLabel}>{r.label}</Text>
              </View>
            );
          }
          if (r.kind === "subGroup") {
            return (
              <View key={`s-${idx}`} style={styles.subGroupRow}>
                <Text style={styles.subGroupLabel}>{r.label}</Text>
              </View>
            );
          }
          const vmaStyle =
            r.vmaSemaphore === "green"
              ? styles.vmaGreen
              : r.vmaSemaphore === "yellow"
                ? styles.vmaYellow
                : r.vmaSemaphore === "red"
                  ? styles.vmaRed
                  : styles.vmaNa;
          return (
            <View key={`m-${idx}`} style={styles.dataRow}>
              <Text style={styles.labelCell}>{r.label}</Text>
              <Text style={styles.accCell}>
                {r.accumulated === null || r.accumulated === undefined
                  ? "—"
                  : formatForType(r.accumulated, r.metric?.type ?? "number")}
              </Text>
              {(r.values ?? Array(12).fill(null)).map((v, i) => (
                <Text
                  key={i}
                  style={
                    i === currentMonthIndex
                      ? styles.numCellCurrent
                      : styles.numCell
                  }
                >
                  {v === null || v === undefined
                    ? "—"
                    : formatForType(v, r.metric?.type ?? "number")}
                </Text>
              ))}
              <Text style={{ ...styles.numCell, ...vmaStyle }}>
                {r.vmaText ?? "—"}
              </Text>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

function formatForType(value: number, type: string): string {
  const int = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
  const dec1 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
  const ars = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
  switch (type) {
    case "currency":
      return ars.format(value);
    case "percent":
      return `${dec1.format(value)}%`;
    case "days":
      return `${dec1.format(value)}d`;
    default:
      return int.format(value);
  }
}
