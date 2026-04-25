"use client";

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const { error: err } = await authClient.signUp.email({
      email,
      password,
      name,
    });

    setIsLoading(false);

    if (err) {
      setError(err.message ?? "No se pudo crear la cuenta.");
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-200 p-4">
        <Card className="w-full max-w-md p-8 space-y-4 shadow-xl text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
          <h1 className="text-xl font-semibold">Cuenta creada</h1>
          <p className="text-sm text-muted-foreground">
            Te enviamos un email de verificación a <strong>{email}</strong>.
            Confirmá tu cuenta para poder ingresar.
          </p>
          <Link
            href="/auth/signin"
            className="text-sm text-primary hover:underline"
          >
            Volver al login
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-200 p-4">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-xl">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-[#003b73] flex items-center justify-center shadow-md">
            <Wrench className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Crear cuenta</h1>
          <p className="text-sm text-muted-foreground">
            Registrate para acceder al panel
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña (mín. 8)</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full gap-2">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Crear cuenta
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground pt-2 border-t">
          ¿Ya tenés cuenta?{" "}
          <Link
            href="/auth/signin"
            className="text-primary font-medium hover:underline"
          >
            Ingresar
          </Link>
        </p>
      </Card>
    </div>
  );
}
