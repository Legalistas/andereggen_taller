import type { Metadata } from "next";
import LeadsSection from "@/components/crm/leads-section";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage() {
  return <LeadsSection />;
}
