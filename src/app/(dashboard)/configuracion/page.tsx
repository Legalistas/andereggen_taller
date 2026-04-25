import type { Metadata } from "next";
import SettingsSection from "@/components/settings/settings-section";

export const metadata: Metadata = { title: "Configuración" };

export default function ConfiguracionPage() {
  return <SettingsSection />;
}
