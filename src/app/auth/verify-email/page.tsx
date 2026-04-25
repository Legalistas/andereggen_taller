"use client";

import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

function VerifyEmailForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    const { error: err } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/dashboard",
    });
    setIsLoading(false);
    if (err) {
      setError(err.message ?? "No se pudo reenviar el email.");
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-200 p-4">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-xl">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-[#003b73] flex items-center justify-center shadow-md">
            <Mail className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Verificá tu email
          </h1>
          <p className="text-sm text-muted-foreground">
            Te enviamos un enlace a tu correo. Si no lo recibiste, podés
            reenviarlo.
          </p>
        </div>

        {sent ? (
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-900">
            <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
            <span>Email reenviado. Revisá tu bandeja de entrada.</span>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleResend}>
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Tu email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                "Reenviar email"
              )}
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground pt-2 border-t">
          <Link
            href="/auth/signin"
            className="text-primary font-medium hover:underline"
          >
            Volver al login
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
