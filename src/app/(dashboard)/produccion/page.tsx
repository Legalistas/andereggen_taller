import type { Metadata } from "next";
import ProductionSection from "@/components/production/production-section";

export const metadata: Metadata = { title: "Producción" };

export default function ProduccionPage() {
  return <ProductionSection />;
}
