import type { Metadata } from "next";
import ProductionHistory from "@/components/production/production-history";

export const metadata: Metadata = { title: "Histórico de producción" };

export default function ProduccionHistoricoPage() {
  return <ProductionHistory />;
}
