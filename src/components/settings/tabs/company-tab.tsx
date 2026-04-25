"use client";

import { AlertCircle, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type AppSettings, TabHeader } from "../settings-section";

type Props = {
  settings: AppSettings;
  onSave: (
    patch: Partial<AppSettings>,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export default function CompanyTab({ settings, onSave }: Props) {
  const [form, setForm] = useState({
    companyName: settings.companyName,
    companyAddress: settings.companyAddress,
    companyCuit: settings.companyCuit ?? "",
    companyPhone: settings.companyPhone ?? "",
    companyEmail: settings.companyEmail ?? "",
    companyWebsite: settings.companyWebsite ?? "",
    companyLogoUrl: settings.companyLogoUrl ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const res = await onSave({
      companyName: form.companyName.trim(),
      companyAddress: form.companyAddress.trim(),
      companyCuit: form.companyCuit || null,
      companyPhone: form.companyPhone || null,
      companyEmail: form.companyEmail || null,
      companyWebsite: form.companyWebsite || null,
      companyLogoUrl: form.companyLogoUrl || null,
    });
    setBusy(false);
    setMsg(
      res.ok
        ? { ok: true, text: "Datos de la empresa guardados." }
        : { ok: false, text: res.error ?? "Error" },
    );
  };

  return (
    <Card className="p-6">
      <TabHeader
        title="Datos de la empresa"
        desc="Se usan en la cabecera de los presupuestos, emails automáticos y pie de página de PDFs."
        icon={Building2}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="companyName">Nombre comercial *</Label>
          <Input
            id="companyName"
            value={form.companyName}
            onChange={(e) =>
              setForm((f) => ({ ...f, companyName: e.target.value }))
            }
          />
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="companyAddress">Dirección</Label>
          <Textarea
            id="companyAddress"
            rows={2}
            value={form.companyAddress}
            onChange={(e) =>
              setForm((f) => ({ ...f, companyAddress: e.target.value }))
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="companyCuit">CUIT</Label>
          <Input
            id="companyCuit"
            value={form.companyCuit}
            onChange={(e) =>
              setForm((f) => ({ ...f, companyCuit: e.target.value }))
            }
            placeholder="30-12345678-9"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="companyPhone">Teléfono</Label>
          <Input
            id="companyPhone"
            value={form.companyPhone}
            onChange={(e) =>
              setForm((f) => ({ ...f, companyPhone: e.target.value }))
            }
            placeholder="(03492) 155-90753"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="companyEmail">Email</Label>
          <Input
            id="companyEmail"
            type="email"
            value={form.companyEmail}
            onChange={(e) =>
              setForm((f) => ({ ...f, companyEmail: e.target.value }))
            }
            placeholder="contacto@empresa.com"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="companyWebsite">Sitio web</Label>
          <Input
            id="companyWebsite"
            value={form.companyWebsite}
            onChange={(e) =>
              setForm((f) => ({ ...f, companyWebsite: e.target.value }))
            }
            placeholder="https://empresa.com"
          />
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="companyLogoUrl">URL del logo</Label>
          <Input
            id="companyLogoUrl"
            value={form.companyLogoUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, companyLogoUrl: e.target.value }))
            }
            placeholder="https://…/logo.png"
          />
          <p className="text-xs text-muted-foreground">
            Se usa en la cabecera de los PDFs de presupuesto.
          </p>
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
