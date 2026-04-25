import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://intra.tallerandereggen.ar";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Andereggen Taller Automotor — Backoffice",
    template: "%s · Andereggen Taller",
  },
  description:
    "Sistema de gestión interno del Taller Andereggen Automotor: cotizaciones, producción, inventario y CRM.",
  applicationName: "Andereggen Taller",
  keywords: [
    "Andereggen",
    "Taller Automotor",
    "Rafaela",
    "Chapa y pintura",
    "Backoffice",
  ],
  authors: [{ name: "Andereggen Taller Automotor" }],
  creator: "Andereggen Taller Automotor",
  publisher: "Andereggen Taller Automotor",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // App interna — no queremos que aparezca en Google ni en buscadores.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: "/logo.svg",
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "Andereggen Taller — Backoffice",
    title: "Andereggen Taller Automotor",
    description:
      "Sistema de gestión interno del Taller Andereggen Automotor.",
    images: [
      {
        url: "/logo.svg",
        width: 870,
        height: 303,
        alt: "Andereggen Taller Automotor",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Andereggen Taller — Backoffice",
    description: "Sistema de gestión interno del taller.",
    images: ["/logo.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#003b73",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
