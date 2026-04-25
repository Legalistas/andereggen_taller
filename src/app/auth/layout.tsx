import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceso",
  description: "Ingresá al sistema de gestión del Taller Andereggen.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
