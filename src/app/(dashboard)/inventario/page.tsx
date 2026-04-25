import type { Metadata } from "next";
import InventorySection from "@/components/inventory/inventory-section";

export const metadata: Metadata = { title: "Inventario" };

export default function InventoryPage() {
  return <InventorySection />;
}
