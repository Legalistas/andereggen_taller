"use client";

import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Mode = "totp" | "otp" | "backup";

export default function TwoFactorPage() {
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [error, setError] = useState("");

  const requestOtp = async () => {
    setIsLoading(true);
    setError("");
    const { error: err } = await authClient.twoFactor.sendOtp();
    setIsLoading(false);
    if (err) {
      setError(err.message ?? "No se pudo enviar el código.");
      return;
    }
    setOtpRequested(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const call =
      mode === "totp"
        ? authClient.twoFactor.verifyTotp({ code })
        : mode === "otp"
          ? authClient.twoFactor.verifyOtp({ code })
          : authClient.twoFactor.verifyBackupCode({ code });

    const { error: err } = await call;
    setIsLoading(false);

    if (err) {
      setError(err.message ?? "Código inválido.");
      return;
    }
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-200 p-4">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-xl">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-[#003b73] flex items-center justify-center shadow-md">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Verificación en dos pasos
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresá tu código de autenticación
          </p>
        </div>

        <div className="flex gap-2 text-xs">
          <button
            type="button"
            className={`flex-1 rounded-md border px-3 py-2 transition-colors ${mode === "totp" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}
            onClick={() => {
              setMode("totp");
              setError("");
            }}
          >
            App autenticadora
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md border px-3 py-2 transition-colors ${mode === "otp" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}
            onClick={() => {
              setMode("otp");
              setError("");
            }}
          >
            Email
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md border px-3 py-2 transition-colors ${mode === "backup" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}
            onClick={() => {
              setMode("backup");
              setError("");
            }}
          >
            Código de respaldo
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === "otp" && !otpRequested && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isLoading}
              onClick={requestOtp}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Enviarme un código"
              )}
            </Button>
          )}

          {(mode !== "otp" || otpRequested) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">
                  {mode === "backup"
                    ? "Código de respaldo"
                    : "Código de 6 dígitos"}
                </Label>
                <Input
                  id="code"
                  required
                  autoComplete="one-time-code"
                  inputMode={mode === "backup" ? "text" : "numeric"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={mode === "backup" ? "xxxx-xxxx" : "123456"}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verificar"
                )}
              </Button>
            </>
          )}
        </form>

        <p className="text-center text-xs text-muted-foreground pt-2 border-t">
          <Link
            href="/auth/signin"
            className="text-primary font-medium hover:underline"
          >
            Cancelar e ir al login
          </Link>
        </p>
      </Card>
    </div>
  );
}
