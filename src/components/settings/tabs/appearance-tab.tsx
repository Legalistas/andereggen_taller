"use client";

import { AlertCircle, CheckCircle2, Loader2, Palette } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type AppSettings, TabHeader } from "../settings-section";

type Props = {
  settings: AppSettings;
  onSave: (
    patch: Partial<AppSettings>,
  ) => Promise<{ ok: boolean; error?: string }>;
};

const LOCALES = [
  { key: "es-AR", label: "Español (Argentina)" },
  { key: "es-MX", label: "Español (México)" },
  { key: "es-ES", label: "Español (España)" },
  { key: "pt-BR", label: "Português (Brasil)" },
  { key: "en-US", label: "English (US)" },
];

const CURRENCIES = [
  { key: "ARS", label: "ARS · Peso argentino" },
  { key: "USD", label: "USD · Dólar" },
  { key: "BRL", label: "BRL · Real" },
  { key: "EUR", label: "EUR · Euro" },
];

const TIMEZONES = [
  "America/Argentina/Buenos_Aires",
  "America/Argentina/Cordoba",
  "America/Argentina/Mendoza",
  "America/Montevideo",
  "America/Sao_Paulo",
  "America/Santiago",
  "America/Mexico_City",
  "UTC",
];

export default function AppearanceTab({ settings, onSave }: Props) {
  const [form, setForm] = useState({
    locale: settings.locale,
    currency: settings.currency,
    timezone: settings.timezone,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const res = await onSave({
      locale: form.locale,
      currency: form.currency,
      timezone: form.timezone,
    });
    setBusy(false);
    setMsg(
      res.ok
        ? { ok: true, text: "Preferencias guardadas." }
        : { ok: false, text: res.error ?? "Error" },
    );
  };

  return (
    <Card className="p-6">
      <TabHeader
        title="Apariencia y localización"
        desc="Idioma, moneda y zona horaria. El tema (claro/oscuro) se maneja desde el header del dashboard."
        icon={Palette}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <Label>Idioma</Label>
          <Select
            value={form.locale}
            onValueChange={(v) => setForm((f) => ({ ...f, locale: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l.key} value={l.key}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Moneda</Label>
          <Select
            value={form.currency}
            onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Zona horaria</Label>
          <Select
            value={form.timezone}
            onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 rounded-md border bg-muted/30 p-3 text-sm">
        <div className="font-medium">Vista previa</div>
        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
          <div>
            Moneda:{" "}
            <b>
              {new Intl.NumberFormat(form.locale, {
                style: "currency",
                currency: form.currency,
              }).format(123456.78)}
            </b>
          </div>
          <div>
            Fecha/hora:{" "}
            <b>
              {new Intl.DateTimeFormat(form.locale, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: form.timezone,
              }).format(new Date())}
            </b>
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${msg.ok ? "border-green-500/40 bg-green-500/10 text-green-700" : "border-destructive/40 bg-destructive/10 text-destructive"}`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="flex justify-end pt-6">
        <Button onClick={submit} disabled={busy} className="gap-2">
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </div>
    </Card>
  );
}
