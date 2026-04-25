import type { Metadata } from "next";
import ToolsSection from "@/components/inventory/tools-section";

export const metadata: Metadata = { title: "Herramientas" };

export default function ToolsPage() {
  return <ToolsSection />;
}
