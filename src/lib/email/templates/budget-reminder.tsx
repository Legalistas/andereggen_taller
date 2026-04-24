/**
 * Recordatorio de presupuesto sin respuesta.
 * Se dispara desde /api/crm/leads/[id]/reminder cuando notifyOnBudgetReminder = true.
 */

import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

type Props = {
    customerName: string;
    budgetNumber: number;
    vehicle: string;
    grandTotal: string; // ya formateado en ARS
    daysAgo: number;
    actionUrl?: string;
};

export function BudgetReminderEmail({
    customerName,
    budgetNumber,
    vehicle,
    grandTotal,
    daysAgo,
    actionUrl,
}: Props) {
    return (
        <EmailLayout preview={`Recordatorio — presupuesto #${budgetNumber}`}>
            <Heading as="h1" className="text-xl font-bold m-0 mb-3 text-slate-900">
                Hola, {customerName} 👋
            </Heading>

            <Text className="text-sm text-slate-700 leading-relaxed m-0 mb-4">
                Hace {daysAgo} días te enviamos el presupuesto{" "}
                <strong>#{budgetNumber}</strong> por <strong>{grandTotal}</strong> para tu{" "}
                <strong>{vehicle}</strong>. Queríamos saber si tuviste chance de revisarlo y si
                tenés alguna consulta.
            </Text>

            <Text className="text-sm text-slate-700 leading-relaxed m-0 mb-4">
                Si necesitás ajustar algún ítem o tenés preguntas, respondé este correo y te
                contestamos en el día.
            </Text>

            {actionUrl && (
                <Section className="text-center my-6">
                    <Button
                        href={actionUrl}
                        className="bg-[#003b73] text-white px-6 py-3 rounded-md font-medium text-sm no-underline"
                    >
                        Ver presupuesto
                    </Button>
                </Section>
            )}

            <Hr className="my-5 border-slate-200" />

            <Text className="text-xs text-slate-500 leading-relaxed m-0">
                Si ya tomaste una decisión o elegiste otro taller, avisanos así cerramos el tema
                desde nuestro lado. ¡Gracias!
            </Text>
        </EmailLayout>
    );
}

export default BudgetReminderEmail;
