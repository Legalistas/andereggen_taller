/**
 * Template para enviar un presupuesto al cliente / perito / productor de seguros.
 * Incluye resumen del trabajo, total y un link a reenviar la aceptación.
 * El PDF completo viaja como attachment.
 */

import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

type Role = "customer" | "inspector" | "insurance" | "other";

type Props = {
  role: Role;
  recipientName?: string | null;
  customerName: string;
  budgetNumber: number;
  vehicleSummary: string; // ej. "Toyota Yaris 2025 · AA 123 BC"
  grandTotal: string; // ya formateado $
  validityDays: number;
  customMessage?: string | null;
  taller: {
    name: string;
    phone: string;
    email: string;
  };
};

export function BudgetSentEmail({
  role,
  recipientName,
  customerName,
  budgetNumber,
  vehicleSummary,
  grandTotal,
  validityDays,
  customMessage,
  taller,
}: Props) {
  const preview = `Presupuesto #${budgetNumber} de ${taller.name}`;
  const greeting = recipientName ? `Hola ${recipientName},` : "Hola,";

  const intro = (() => {
    switch (role) {
      case "customer":
        return (
          <Text className="text-slate-700 text-sm m-0 mt-2">
            Te enviamos el presupuesto <strong>#{budgetNumber}</strong> por la
            reparación de tu vehículo <strong>{vehicleSummary}</strong>. Podés
            revisar el detalle en el PDF adjunto.
          </Text>
        );
      case "inspector":
        return (
          <Text className="text-slate-700 text-sm m-0 mt-2">
            Te compartimos el presupuesto <strong>#{budgetNumber}</strong>{" "}
            correspondiente al vehículo <strong>{vehicleSummary}</strong> del
            cliente <strong>{customerName}</strong>. PDF adjunto para tu
            revisión.
          </Text>
        );
      case "insurance":
        return (
          <Text className="text-slate-700 text-sm m-0 mt-2">
            Te enviamos el presupuesto <strong>#{budgetNumber}</strong> del
            siniestro del cliente <strong>{customerName}</strong> (
            <strong>{vehicleSummary}</strong>). PDF adjunto con el detalle
            completo.
          </Text>
        );
      default:
        return (
          <Text className="text-slate-700 text-sm m-0 mt-2">
            Te compartimos el presupuesto <strong>#{budgetNumber}</strong> de{" "}
            <strong>{customerName}</strong> — <strong>{vehicleSummary}</strong>.
          </Text>
        );
    }
  })();

  return (
    <EmailLayout preview={preview}>
      <Heading as="h2" className="text-xl font-bold text-slate-900 m-0">
        Presupuesto #{budgetNumber}
      </Heading>
      <Text className="text-slate-500 text-xs m-0 mt-1">{greeting}</Text>

      {intro}

      {customMessage ? (
        <Section className="mt-4 px-4 py-3 bg-slate-50 border-l-4 border-slate-300 rounded">
          <Text className="text-slate-700 text-sm m-0 whitespace-pre-wrap">
            {customMessage}
          </Text>
        </Section>
      ) : null}

      <Section className="mt-5 p-4 bg-[#003b73]/5 border border-[#003b73]/20 rounded">
        <Text className="text-[10px] uppercase tracking-wider text-slate-500 m-0">
          Total del presupuesto
        </Text>
        <Text className="text-2xl font-bold text-[#003b73] m-0 mt-1">
          {grandTotal}
        </Text>
        <Text className="text-[11px] text-slate-500 m-0 mt-2">
          Validez: {validityDays} día(s) desde la fecha de emisión.
        </Text>
      </Section>

      {role === "customer" ? (
        <Text className="text-slate-700 text-sm m-0 mt-5">
          Si querés avanzar con el trabajo, respondé este correo o contactanos
          por WhatsApp/teléfono al <strong>{taller.phone}</strong>. Estamos a
          disposición por cualquier consulta.
        </Text>
      ) : (
        <Text className="text-slate-700 text-sm m-0 mt-5">
          Quedamos atentos a tus comentarios. Ante cualquier duda respondé este
          correo o escribinos al <strong>{taller.phone}</strong>.
        </Text>
      )}

      <Section className="mt-5">
        <Button
          href={`mailto:${taller.email}?subject=Consulta%20presupuesto%20%23${budgetNumber}`}
          className="bg-[#003b73] text-white text-xs font-semibold px-4 py-2 rounded no-underline"
        >
          Responder por email
        </Button>
      </Section>
    </EmailLayout>
  );
}
