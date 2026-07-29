/**
 * Catálogo del tablero de KPIs — spec jul '26.
 *
 * Fuente única de verdad de qué métricas existen, cómo se agrupan, tipo
 * (`auto` vs `manual`), formato de display y si son "invertidas" (bajar es
 * mejor). El backend agregador (`/api/kpis/matrix`) y el frontend consumen
 * este mismo archivo.
 *
 * Regla del brief: "pocas métricas, bien elegidas y automáticas". Los
 * únicos manuales son los que no se pueden calcular desde el sistema
 * (por ahora: reclamos del mes).
 *
 * Compañías principales del desglose por seguro (spec pide mínimo 4):
 *   El Norte · Sancor · San Cristóbal · La Segunda
 * Todas las demás se agrupan en "Otras" y "Particulares" es su propio bucket.
 */

export type KpiValueType = "number" | "currency" | "percent" | "days";
export type KpiSourceType = "auto" | "manual";

export type KpiMetric = {
  /** Slug estable del catálogo — usado como `metricKey` del backend y como
   *  React key en la matriz. Incluye prefijo del grupo. */
  key: string;
  label: string;
  description?: string;
  type: KpiValueType;
  source: KpiSourceType;
  /** Si true, un valor MÁS BAJO es mejor (ej: reclamos, tiempo en taller).
   *  Cambia la lógica del semáforo de VMA. */
  inverted?: boolean;
};

export type KpiSubGroup = {
  /** Título de la sub-agrupación (ej: "Por compañía" dentro de Cotizaciones).
   *  Si `undefined`, las métricas van directo bajo el grupo. */
  title?: string;
  metrics: KpiMetric[];
};

export type KpiGroup = {
  key: KpiGroupKey;
  title: string;
  responsible: string;
  /** Si `true`, solo lo ven roles de la lista `KPI_RESTRICTED_ROLES`. */
  restricted?: boolean;
  subGroups: KpiSubGroup[];
};

export type KpiGroupKey = "cotizaciones" | "produccion" | "caja" | "compras";

/** Compañías aseguradoras que se muestran desglosadas. Deben coincidir por
 *  substring case-insensitive con `Lead.insuranceCompany.name` (o el
 *  snapshot del vehículo). "Otras" agrupa todo lo demás; "Particulares"
 *  cae cuando `insuranceResponsibility === "particular"`. */
export const KPI_INSURANCE_COMPANIES = [
  { key: "norte", label: "El Norte", match: "norte" },
  { key: "sancor", label: "Sancor", match: "sancor" },
  { key: "san_crist", label: "San Cristóbal", match: "san crist" },
  { key: "segunda", label: "La Segunda", match: "segunda" },
] as const;

export type InsuranceKey =
  | (typeof KPI_INSURANCE_COMPANIES)[number]["key"]
  | "otras"
  | "particulares";

/** Roles que pueden ver las métricas de Caja/Finanzas (restringidas).
 *  Se cruza con `session.user.domainRole?.name`. */
export const KPI_RESTRICTED_ROLES = new Set([
  "contable",
  "admin_taller",
  "super_admin",
]);

// ─────────────────────────────────────────────────────────────
// KPI Groups
// ─────────────────────────────────────────────────────────────

const CAJA_METRICS: KpiMetric[] = [
  {
    key: "caja.facturacion",
    label: "Facturación del mes",
    description: "Total facturado (RepairInvoice) del mes.",
    type: "currency",
    source: "auto",
  },
  {
    key: "caja.ingresos",
    label: "Ingresos del mes",
    description:
      "Total efectivamente cobrado — excluye Caja 2 (línea negra).",
    type: "currency",
    source: "auto",
  },
  {
    key: "caja.egresos",
    label: "Egresos del mes",
    description: "Total de gastos / egresos del mes.",
    type: "currency",
    source: "auto",
    inverted: true,
  },
  {
    key: "caja.pendientes",
    label: "Cobros pendientes",
    description: "Monto por cobrar al cierre del mes (facturado no cobrado).",
    type: "currency",
    source: "auto",
    inverted: true,
  },
];

const CAJA_BY_INSURANCE: KpiMetric[] = [
  ...KPI_INSURANCE_COMPANIES.map<KpiMetric>((c) => ({
    key: `caja.ingresos_${c.key}`,
    label: c.label,
    type: "currency",
    source: "auto",
  })),
  {
    key: "caja.ingresos_otras",
    label: "Otras compañías",
    type: "currency",
    source: "auto",
  },
  {
    key: "caja.ingresos_particulares",
    label: "Particulares",
    type: "currency",
    source: "auto",
  },
];

const COTIZACIONES_MAIN: KpiMetric[] = [
  {
    key: "cotizaciones.creadas",
    label: "Cotizaciones creadas",
    description:
      "Leads abiertos en el mes (por Lead ID, no por presupuesto).",
    type: "number",
    source: "auto",
  },
  {
    key: "cotizaciones.ganadas",
    label: "Cotizaciones ganadas",
    description:
      "Leads que recibieron orden de trabajo, atribuidos al mes de aceptación (`orderReceivedAt`).",
    type: "number",
    source: "auto",
  },
  {
    key: "cotizaciones.conversion",
    label: "Tasa de conversión",
    description: "Ganadas / creadas del período.",
    type: "percent",
    source: "auto",
  },
];

const COTIZACIONES_CREADAS_BY_INSURANCE: KpiMetric[] = [
  ...KPI_INSURANCE_COMPANIES.map<KpiMetric>((c) => ({
    key: `cotizaciones.creadas_${c.key}`,
    label: c.label,
    type: "number",
    source: "auto",
  })),
  {
    key: "cotizaciones.creadas_otras",
    label: "Otras compañías",
    type: "number",
    source: "auto",
  },
  {
    key: "cotizaciones.creadas_particulares",
    label: "Particulares",
    type: "number",
    source: "auto",
  },
];

const COTIZACIONES_GANADAS_BY_INSURANCE: KpiMetric[] = [
  ...KPI_INSURANCE_COMPANIES.map<KpiMetric>((c) => ({
    key: `cotizaciones.ganadas_${c.key}`,
    label: c.label,
    type: "number",
    source: "auto",
  })),
  {
    key: "cotizaciones.ganadas_otras",
    label: "Otras compañías",
    type: "number",
    source: "auto",
  },
  {
    key: "cotizaciones.ganadas_particulares",
    label: "Particulares",
    type: "number",
    source: "auto",
  },
];

const PRODUCCION_METRICS: KpiMetric[] = [
  {
    key: "produccion.ingresados",
    label: "Autos ingresados",
    description:
      "Vehículos que ingresaron físicamente al taller en el mes (`Repair.enteredAt`).",
    type: "number",
    source: "auto",
  },
  {
    key: "produccion.entregados",
    label: "Autos entregados",
    description: "Vehículos entregados en el mes (`Repair.deliveredAt`).",
    type: "number",
    source: "auto",
  },
  {
    key: "produccion.tiempo_taller",
    label: "Tiempo promedio en taller",
    description:
      "Promedio de días entre ingreso y entrega, para autos entregados en el mes.",
    type: "days",
    source: "auto",
    inverted: true,
  },
  {
    key: "produccion.reclamos",
    label: "Reclamos",
    description:
      "Cantidad de reclamos recibidos en el mes. Carga manual.",
    type: "number",
    source: "manual",
    inverted: true,
  },
];

const COMPRAS_METRICS: KpiMetric[] = [
  {
    key: "compras.repuestos",
    label: "Compras de repuestos",
    description:
      "Suma de EGRESOS del mes con concepto = Repuestos (excluye pases).",
    type: "currency",
    source: "auto",
    inverted: true,
  },
  {
    key: "compras.insumos",
    label: "Compras de insumos",
    description:
      "Suma de EGRESOS del mes con concepto = Insumos (excluye pases).",
    type: "currency",
    source: "auto",
    inverted: true,
  },
];

/** Estructura consolidada del tablero — orden de arriba a abajo. */
export const KPI_GROUPS: KpiGroup[] = [
  {
    key: "cotizaciones",
    title: "Cotizaciones",
    responsible: "Brisa",
    subGroups: [
      { metrics: COTIZACIONES_MAIN },
      { title: "Creadas por compañía", metrics: COTIZACIONES_CREADAS_BY_INSURANCE },
      { title: "Ganadas por compañía", metrics: COTIZACIONES_GANADAS_BY_INSURANCE },
    ],
  },
  {
    key: "produccion",
    title: "Producción",
    responsible: "Alfredo",
    subGroups: [{ metrics: PRODUCCION_METRICS }],
  },
  {
    key: "caja",
    title: "Caja / Finanzas",
    responsible: "Ayelén",
    restricted: true,
    subGroups: [
      { metrics: CAJA_METRICS },
      { title: "Ingresos por compañía", metrics: CAJA_BY_INSURANCE },
    ],
  },
  {
    key: "compras",
    title: "Compras",
    responsible: "Mauricio",
    subGroups: [{ metrics: COMPRAS_METRICS }],
  },
];

/** Solo los manuales — usado para validar `metricKey` en el PUT. */
export const MANUAL_KPI_KEYS = new Set(
  KPI_GROUPS.flatMap((g) =>
    g.subGroups.flatMap((s) =>
      s.metrics.filter((m) => m.source === "manual").map((m) => m.key),
    ),
  ),
);

/** Diccionario plano key → metric para lookups. */
export const KPI_METRIC_BY_KEY: Record<string, KpiMetric> = Object.fromEntries(
  KPI_GROUPS.flatMap((g) =>
    g.subGroups.flatMap((s) => s.metrics.map((m) => [m.key, m])),
  ),
);
