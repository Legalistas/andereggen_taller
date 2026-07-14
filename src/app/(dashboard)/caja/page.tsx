import CajaSection from "@/components/caja/caja-section";

export const metadata = { title: "Caja" };

export default function CajaPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Caja</h1>
        <p className="text-sm text-slate-500">
          Cobros por vehículo y flujo entre las 5 cajas. Los cobros
          registrados en la ficha del vehículo entran acá automáticamente.
        </p>
      </div>
      <CajaSection />
    </div>
  );
}
