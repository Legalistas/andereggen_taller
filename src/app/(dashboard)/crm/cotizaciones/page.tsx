import type { Metadata } from "next";
import QuotesSection from "@/components/crm/quotes-section";

export const metadata: Metadata = { title: "Cotizaciones" };

export default function QuotesPage() {
  return <QuotesSection />;
}
