/**
 * spec 13 · Lector del Excel (o CSV) de "Mis Comprobantes Recibidos" de ARCA.
 *
 * Las columnas se buscan por nombre y no por posición, porque ARCA cambió el
 * formato más de una vez (el nuevo separa el neto y el IVA por alícuota). Las
 * notas de crédito salen en negativo y los comprobantes en otra moneda se
 * pasan a pesos con su tipo de cambio.
 */

import * as XLSX from "xlsx";

export type ComprobanteArca = {
  /** Fila del archivo (como la ve Excel), para los mensajes de error. */
  row: number;
  date: string; // AAAA-MM-DD
  typeCode: number;
  typeName: string;
  pointOfSale: number;
  number: number;
  cae: string | null;
  issuerCuit: string;
  issuerName: string;
  currency: string;
  exchangeRate: number;
  netTaxed: number;
  netUntaxed: number;
  exempt: number;
  otherTaxes: number;
  iva: number;
  total: number;
};

export type LecturaArca =
  | {
      ok: true;
      comprobantes: ComprobanteArca[];
      errores: { row: number; motivo: string }[];
    }
  | { ok: false; error: string };

/** Nombres de los tipos más comunes, para cuando el archivo trae solo el código. */
const TIPOS: Record<number, string> = {
  1: "Factura A",
  2: "Nota de Débito A",
  3: "Nota de Crédito A",
  6: "Factura B",
  7: "Nota de Débito B",
  8: "Nota de Crédito B",
  11: "Factura C",
  12: "Nota de Débito C",
  13: "Nota de Crédito C",
  51: "Factura M",
  52: "Nota de Débito M",
  53: "Nota de Crédito M",
  201: "Factura de Crédito Electrónica A",
  203: "Nota de Crédito Electrónica A",
  206: "Factura de Crédito Electrónica B",
  208: "Nota de Crédito Electrónica B",
  211: "Factura de Crédito Electrónica C",
  213: "Nota de Crédito Electrónica C",
};

const normalizar = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Encabezados normalizados (sin tildes ni puntos, en minúscula).
const COLUMNAS = {
  fecha: /^fecha/,
  tipo: /^tipo( de comprobante)?$/,
  puntoVenta: /^punto de venta$/,
  numero: /^numero( desde)?$/,
  cae: /autorizacion/,
  cuit: /^(nro |numero )?doc(umento)? (emisor|vendedor)$/,
  nombre: /^denominacion (emisor|vendedor)$/,
  moneda: /^moneda/,
  tipoCambio: /^tipo (de )?cambio/,
  netoGravado: /^(imp |importe )?neto gravado( total)?$/,
  netoNoGravado: /^(imp |importe )?neto no gravado$/,
  exento: /^(imp |importe )?op(eraciones)? exentas$/,
  otrosTributos: /^(imp |importe )?otros tributos$/,
  iva: /^(total iva|iva|imp total iva|importe total iva)$/,
  total: /^(imp|importe) total$/,
} as const;
// Formato nuevo: el neto y el IVA vienen además separados por alícuota.
const NETO_POR_ALICUOTA = /^(imp |importe )?neto gravado iva \d/;
const IVA_POR_ALICUOTA = /^iva \d/;

/** Importe en formato argentino ("$ 1.234,56", "-", 1234.56) a número. */
export function importe(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "")
    .replace(/[$\s ]/g, "")
    .trim();
  if (s === "" || s === "-") return 0;
  const n = Number(
    s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s,
  );
  if (!Number.isFinite(n)) throw new Error(`importe inválido "${String(v)}"`);
  return n;
}

function fecha(v: unknown): string {
  // En el Excel la fecha llega como número de serie; en el CSV, como texto.
  if (typeof v === "number") {
    // Los comprobantes no tienen hora: unos segundos antes de la medianoche
    // (error de zona horaria de quien generó el archivo) son el día siguiente.
    const d = XLSX.SSF.parse_date_code(Math.floor(v + 0.001));
    if (d)
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v ?? "").trim();
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy)
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  throw new Error(`fecha inválida "${s}"`);
}

const entero = (v: unknown, que: string) => {
  const n = Number(String(v ?? "").replace(/\D/g, ""));
  if (!Number.isInteger(n) || n <= 0)
    throw new Error(`${que} inválido "${String(v ?? "")}"`);
  return n;
};

export function leerMisComprobantes(archivo: ArrayBuffer): LecturaArca {
  let filas: unknown[][];
  try {
    const bytes = new Uint8Array(archivo);
    // Excel (.xlsx es un zip, .xls un OLE) o CSV. Al CSV se lo decodifica
    // antes para no perder las tildes de los encabezados, y `raw` evita que
    // SheetJS lea "05/09/2026" como fecha en formato yanqui.
    const esExcel =
      (bytes[0] === 0x50 && bytes[1] === 0x4b) ||
      (bytes[0] === 0xd0 && bytes[1] === 0xcf);
    const libro = esExcel
      ? XLSX.read(bytes, { type: "array", raw: true })
      : XLSX.read(decodificar(bytes), { type: "string", raw: true });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
      header: 1,
      raw: true,
      defval: "",
    });
  } catch {
    return {
      ok: false,
      error:
        "No se pudo leer el archivo. Subí el Excel o el CSV que descarga ARCA.",
    };
  }

  // El encabezado no siempre está en la primera fila (arriba va el título con el CUIT).
  const iEncabezado = filas.slice(0, 15).findIndex((f) => {
    const celdas = f.map(normalizar);
    return (
      celdas.some((c) => COLUMNAS.fecha.test(c)) &&
      celdas.some((c) => COLUMNAS.tipo.test(c))
    );
  });
  if (iEncabezado < 0) {
    return {
      ok: false,
      error:
        "No es el archivo de Mis Comprobantes: no encuentro las columnas Fecha y Tipo.",
    };
  }
  const encabezado = filas[iEncabezado].map(normalizar);
  const col = (re: RegExp) => encabezado.findIndex((c) => re.test(c));
  const cols = Object.fromEntries(
    Object.entries(COLUMNAS).map(([k, re]) => [k, col(re)]),
  ) as Record<keyof typeof COLUMNAS, number>;
  const netoAlicuotas = encabezado.flatMap((c, i) =>
    NETO_POR_ALICUOTA.test(c) ? [i] : [],
  );
  const ivaAlicuotas = encabezado.flatMap((c, i) =>
    IVA_POR_ALICUOTA.test(c) ? [i] : [],
  );

  if (cols.cuit < 0 && encabezado.some((c) => /receptor/.test(c))) {
    return {
      ok: false,
      error:
        "Este archivo es de comprobantes emitidos. Descargá el de Mis Comprobantes Recibidos.",
    };
  }
  const faltan = (["numero", "cuit", "nombre", "total"] as const).filter(
    (k) => cols[k] < 0,
  );
  if (faltan.length > 0) {
    return {
      ok: false,
      error: `Al archivo le faltan columnas: ${faltan.join(", ")}.`,
    };
  }

  const comprobantes: ComprobanteArca[] = [];
  const errores: { row: number; motivo: string }[] = [];
  filas.slice(iEncabezado + 1).forEach((f, i) => {
    const row = iEncabezado + i + 2;
    if (f.every((c) => String(c ?? "").trim() === "")) return;
    const celda = (k: keyof typeof COLUMNAS) =>
      cols[k] >= 0 ? f[cols[k]] : "";
    try {
      // Tipo: "11 - Factura C", 11 o "Factura C".
      const tipoTexto = String(celda("tipo")).trim();
      const codigo = Number(tipoTexto.match(/^(\d+)/)?.[1]);
      const typeCode =
        codigo ||
        Number(
          Object.entries(TIPOS).find(
            ([, n]) => normalizar(n) === normalizar(tipoTexto),
          )?.[0],
        );
      if (!typeCode)
        throw new Error(`tipo de comprobante desconocido "${tipoTexto}"`);
      const typeName =
        tipoTexto.replace(/^\d+\s*-\s*/, "") ||
        TIPOS[typeCode] ||
        `Tipo ${typeCode}`;

      // Número: columnas separadas o "00001-00000106".
      const numeroTexto = String(celda("numero")).trim();
      const partes = numeroTexto.match(/^(\d+)-(\d+)$/);
      const pointOfSale = partes
        ? entero(partes[1], "punto de venta")
        : entero(celda("puntoVenta"), "punto de venta");
      const number = entero(partes ? partes[2] : numeroTexto, "número");

      const issuerCuit = String(celda("cuit")).replace(/\D/g, "");
      if (issuerCuit.length < 7 || issuerCuit.length > 11)
        throw new Error(`CUIT inválido "${String(celda("cuit"))}"`);
      const issuerName = String(celda("nombre")).trim();
      if (!issuerName) throw new Error("falta la denominación del emisor");

      const monedaTexto = normalizar(celda("moneda"));
      const enPesos =
        monedaTexto === "" ||
        ["$", "pes", "ars", "peso", "pesos"].includes(monedaTexto);
      const exchangeRate = enPesos ? 1 : importe(celda("tipoCambio")) || 1;
      if (!enPesos && exchangeRate === 1)
        throw new Error(`comprobante en ${monedaTexto} sin tipo de cambio`);

      // "Factura de Crédito Electrónica" es una factura, no una nota de crédito.
      const esCredito =
        [3, 8, 13, 53, 203, 208, 213].includes(typeCode) ||
        (/credito/.test(normalizar(typeName)) &&
          !/factura/.test(normalizar(typeName)));
      const signo = esCredito ? -1 : 1;
      const monto = (v: number) =>
        Math.round(signo * Math.abs(v) * exchangeRate * 100) / 100;
      const suma = (indices: number[]) =>
        indices.reduce((s, j) => s + importe(f[j]), 0);

      comprobantes.push({
        row,
        date: fecha(celda("fecha")),
        typeCode,
        typeName,
        pointOfSale,
        number,
        cae: String(celda("cae")).replace(/\D/g, "") || null,
        issuerCuit,
        issuerName,
        currency: enPesos ? "PES" : monedaTexto.toUpperCase(),
        exchangeRate,
        netTaxed: monto(
          cols.netoGravado >= 0
            ? importe(celda("netoGravado"))
            : suma(netoAlicuotas),
        ),
        netUntaxed: monto(importe(celda("netoNoGravado"))),
        exempt: monto(importe(celda("exento"))),
        otherTaxes: monto(importe(celda("otrosTributos"))),
        iva: monto(cols.iva >= 0 ? importe(celda("iva")) : suma(ivaAlicuotas)),
        total: monto(importe(celda("total"))),
      });
    } catch (e) {
      errores.push({
        row,
        motivo: e instanceof Error ? e.message : "fila inválida",
      });
    }
  });

  return { ok: true, comprobantes, errores };
}

/**
 * CUIT (o documento) de un proveedor cargado a mano: solo dígitos, entre 7 y
 * 11. Vacío → null; inválido → undefined.
 */
export function limpiarCuit(v: unknown): string | null | undefined {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const digitos = String(v).replace(/[\s.-]/g, "");
  return /^\d{7,11}$/.test(digitos) ? digitos : undefined;
}

/** CSV en UTF-8 o, si no lo es, en la codificación de Windows. */
function decodificar(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Nombre comparable entre ARCA y la ficha del proveedor ("Repuestos Sur S.R.L." = "REPUESTOS SUR SRL"). */
export const nombreComparable = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
