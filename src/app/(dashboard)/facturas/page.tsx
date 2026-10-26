import FacturasSection from "@/components/facturas/facturas-section";

export default function FacturasPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Facturas de compra
        </h1>
        <p className="text-sm text-slate-500">
          Facturas de proveedores importadas de Mis Comprobantes Recibidos de
          ARCA, con el IVA de cada mes.
        </p>
      </div>
      <FacturasSection />
    </div>
  );
}
