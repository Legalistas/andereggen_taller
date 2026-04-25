"use client";

import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const errorMessages = {
  AccessDenied: {
    title: "Acceso denegado",
    description:
      "No tenés permisos para acceder a este recurso. Sólo usuarios admin e internos pueden entrar.",
    action: "Contactá al administrador para solicitar acceso.",
  },
  AccountInactive: {
    title: "Cuenta inactiva",
    description: "Tu cuenta fue desactivada.",
    action: "Contactá al administrador para reactivarla.",
  },
  InsufficientPermissions: {
    title: "Permisos insuficientes",
    description: "No tenés los permisos necesarios para realizar esta acción.",
    action: "Contactá al administrador si necesitás permisos adicionales.",
  },
  Default: {
    title: "Error de autenticación",
    description: "Ocurrió un error al autenticarte.",
    action: "Volvé a intentarlo en unos segundos.",
  },
} as const;

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";
  const info =
    errorMessages[error as keyof typeof errorMessages] ?? errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 p-4">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-xl">
        <div className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{info.title}</h1>
          <p className="text-sm text-muted-foreground">{info.description}</p>
          <p className="text-sm text-muted-foreground">{info.action}</p>
        </div>

        <div className="space-y-2">
          <Button asChild className="w-full gap-2">
            <Link href="/auth/signin">
              <ArrowLeft className="h-4 w-4" />
              Volver a iniciar sesión
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Ir al inicio
            </Link>
          </Button>
        </div>

        {error && error !== "Default" && (
          <p className="text-center text-xs text-muted-foreground pt-2 border-t">
            Código de error: <span className="font-mono">{error}</span>
          </p>
        )}
      </Card>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ErrorContent />
    </Suspense>
  );
}
