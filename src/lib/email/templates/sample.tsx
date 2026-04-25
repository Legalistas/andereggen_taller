/**
 * Plantilla de prueba mínima. Útil para el endpoint de smoke test SMTP y como
 * referencia al crear plantillas reales (presupuesto enviado, cambio de estado,
 * recordatorio, etc.).
 */

import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

type Props = {
  name: string;
  message?: string;
  actionUrl?: string;
  actionLabel?: string;
};

export function SampleEmail({
  name,
  message = "Este es un email de prueba para verificar la configuración SMTP.",
  actionUrl,
  actionLabel = "Abrir panel",
}: Props) {
  return (
    <EmailLayout preview={`Hola ${name}, notificación de Andereggen Taller`}>
      <Heading as="h1" className="text-xl font-bold m-0 mb-3 text-slate-900">
        Hola, {name} 👋
      </Heading>

      <Text className="text-sm text-slate-700 leading-relaxed m-0 mb-4">
        {message}
      </Text>

      {actionUrl && (
        <Section className="text-center my-6">
          <Button
            href={actionUrl}
            className="bg-[#003b73] text-white px-6 py-3 rounded-md font-medium text-sm no-underline"
          >
            {actionLabel}
          </Button>
        </Section>
      )}

      <Text className="text-xs text-slate-500 leading-relaxed m-0 mt-6">
        Si tenés cualquier duda, respondé este correo y te contestamos lo antes
        posible.
      </Text>
    </EmailLayout>
  );
}

// Preview para la CLI de react-email (bunx react-email dev)
export default SampleEmail;
