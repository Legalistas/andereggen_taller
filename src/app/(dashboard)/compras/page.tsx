import PurchasesSection from "@/components/compras/purchases-section";

export const metadata = { title: "Compras" };

export default function ComprasPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compras</h1>
        <p className="text-sm text-slate-500">
          Ciclo completo de compra de repuestos: cotización, decisión,
          proveedor, flete y pago. Cada compra vive dentro de un ítem de
          presupuesto administrativo y avanza por 7 estados (podés retroceder
          si hay devoluciones).
        </p>
      </div>
      <PurchasesSection />
    </div>
  );
}
