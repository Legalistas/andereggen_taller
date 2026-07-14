import CalendarSection from "@/components/calendar/calendar-section";

export const metadata = { title: "Calendario" };

export default function CalendarPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Calendario</h1>
        <p className="text-sm text-slate-500">
          Turnos coordinados y entregas estimadas del mes. Marcá el traslado
          si el cliente pidió que lo lleven al dejar el vehículo.
        </p>
      </div>
      <CalendarSection />
    </div>
  );
}
