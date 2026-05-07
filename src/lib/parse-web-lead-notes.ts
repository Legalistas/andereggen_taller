/**
 * Parser de las notas que el endpoint público `/api/public/leads` graba cuando
 * llega un envío del formulario de contacto del landing.
 *
 * El formato es plano y predecible (ver `buildNotes` en
 * `src/app/api/public/leads/route.ts`):
 *
 *   --- Solicitud desde el formulario web ---
 *   Marca: Toyota
 *   Modelo: Yaris
 *   Año: 2025
 *   Seguro propio: Sancor Seguros
 *   Seguro del tercero: -
 *
 *   Descripción del trabajo:
 *   <texto libre, puede tener varias líneas>
 *
 * Lo usamos para pre-llenar el modal "Cargar vehículo" cuando el staff
 * convierte una solicitud web en un lead completo.
 */

export type ParsedWebLeadNotes = {
  brand: string;
  model: string;
  year: string;
  insurance: string;
  thirdPartyInsurance: string;
  description: string;
  /** True si la nota tiene el header del formulario web. */
  isWebForm: boolean;
};

const WEB_HEADER = "--- Solicitud desde el formulario web ---";

function pickLine(text: string, label: string): string {
  const re = new RegExp(`^${label}:\\s*(.*)$`, "im");
  const m = text.match(re);
  return m?.[1]?.trim() ?? "";
}

export function parseWebLeadNotes(
  notes: string | null | undefined,
): ParsedWebLeadNotes {
  const empty: ParsedWebLeadNotes = {
    brand: "",
    model: "",
    year: "",
    insurance: "",
    thirdPartyInsurance: "",
    description: "",
    isWebForm: false,
  };
  if (!notes) return empty;

  const isWebForm = notes.includes(WEB_HEADER);

  // Descripción: todo lo que viene después de la línea "Descripción del trabajo:"
  let description = "";
  const descMatch = notes.match(
    /Descripci[oó]n del trabajo:\s*\n([\s\S]*)$/i,
  );
  if (descMatch) {
    description = descMatch[1].trim();
  }

  return {
    brand: pickLine(notes, "Marca"),
    model: pickLine(notes, "Modelo"),
    year: pickLine(notes, "Año"),
    insurance: pickLine(notes, "Seguro propio"),
    thirdPartyInsurance: pickLine(notes, "Seguro del tercero"),
    description,
    isWebForm,
  };
}
