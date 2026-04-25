import type { Metadata } from "next";
import FollowupsSection from "@/components/crm/followups-section";

export const metadata: Metadata = { title: "Seguimiento" };

export default function SeguimientoPage() {
  return <FollowupsSection />;
}
