"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, FileText, Loader2 } from "lucide-react"
import { useState } from "react"
import { TabHeader, type AppSettings } from "../settings-section"

type Props = {
    settings: AppSettings
    onSave: (patch: Partial<AppSettings>) => Promise<{ ok: boolean; error?: string }>
}

export default function BudgetTab({ settings, onSave }: Props) {
    const [form, setForm] = useState({
        defaultIvaRate: String(settings.defaultIvaRate),
        defaultValidityDays: String(settings.defaultValidityDays),
        defaultDeliveryDays: String(settings.defaultDeliveryDays),
        defaultPaymentCondition: settings.defaultPaymentCondition,
    })
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    const submit = async () => {
        setBusy(true); setMsg(null)
        const res = await onSave({
            defaultIvaRate: Number(form.defaultIvaRate),
            defaultValidityDays: Number(form.defaultValidityDays),
            defaultDeliveryDays: Number(form.defaultDeliveryDays),
            defaultPaymentCondition: form.defaultPaymentCondition.trim(),
        })
        setBusy(false)
        setMsg(res.ok ? { ok: true, text: "Defaults de presupuesto actualizados." } : { ok: false, text: res.error ?? "Error" })
    }

    return (
        <Card className="p-6">
            <TabHeader
                title="Defaults de presupuesto"
                desc="Valores que se usan al crear un presupuesto nuevo. Se pueden modificar por presupuesto desde el editor."
                icon={FileText}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                    <Label htmlFor="defaultIvaRate">IVA (%)</Label>
                    <Input id="defaultIvaRate" type="number" min="0" max="100" step="0.01" value={form.defaultIvaRate} onChange={(e) => setForm((f) => ({ ...f, defaultIvaRate: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="defaultValidityDays">Validez (días)</Label>
                    <Input id="defaultValidityDays" type="number" min="1" value={form.defaultValidityDays} onChange={(e) => setForm((f) => ({ ...f, defaultValidityDays: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="defaultDeliveryDays">Plazo de entrega (días)</Label>
                    <Input id="defaultDeliveryDays" type="number" min="1" value={form.defaultDeliveryDays} onChange={(e) => setForm((f) => ({ ...f, defaultDeliveryDays: e.target.value }))} />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                    <Label htmlFor="defaultPaymentCondition">Condición de pago</Label>
                    <Input id="defaultPaymentCondition" value={form.defaultPaymentCondition} onChange={(e) => setForm((f) => ({ ...f, defaultPaymentCondition: e.target.value }))} />
                </div>
            </div>

            {msg && (
                <div className={`mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${msg.ok ? "border-green-500/40 bg-green-500/10 text-green-700" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
                    {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                    <span>{msg.text}</span>
                </div>
            )}

            <div className="flex justify-end pt-6">
                <Button onClick={submit} disabled={busy} className="gap-2">
                    {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Guardar cambios"}
                </Button>
            </div>
        </Card>
    )
}
