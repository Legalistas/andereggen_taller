import type { Metadata } from "next";
import ProductionList from "@/components/production/production-list";

export const metadata: Metadata = { title: "Lista de reparaciones" };

export default function ProduccionListaPage() {
  return <ProductionList />;
}
