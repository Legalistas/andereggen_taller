import type { Metadata } from "next";
import CustomersSection from "@/components/customers/customers-section";

export const metadata: Metadata = { title: "Clientes" };

export default function CustomersPage() {
  return <CustomersSection />;
}
