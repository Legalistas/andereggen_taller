"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Bot, CheckCircle2, Info, Loader2 } from "lucide-react"
import { useState } from "react"
import { TabHeader, type AppSettings } from "../settings-section"

type Props = {
    settings: AppSettings
    onSave: (patch: Partial<AppSettings>) => Promise<{ ok: boolean; error?: string }>
}

export default function IntegrationsTab({ settings, onSave }: Props) {
    const [form, setForm] = useState({
        whatsappEnabled: settings.whatsappEnabled,
        whatsappNumber: settings.whatsappNumber ?? "",
        whatsappApiKey: settings.whatsappApiKey ?? "",
        mpEnabled: settings.mpEnabled,
        mpAccessToken: settings.mpAccessToken ?? "",
        afipEnabled: settings.afipEnabled,
        afipCuit: settings.afipCuit ?? "",
        afipCertNote: settings.afipCertNote ?? "",
    })
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    const submit = async () => {
        setBusy(true); setMsg(null)
        const res = await onSave({
            whatsappEnabled: form.whatsappEnabled,
            whatsappNumber: form.whatsappNumber || null,
            whatsappApiKey: form.whatsappApiKey || null,
            mpEnabled: form.mpEnabled,
            mpAccessToken: form.mpAccessToken || null,
            afipEnabled: form.afipEnabled,
            afipCuit: form.afipCuit || null,
            afipCertNote: form.afipCertNote || null,
        })
        setBusy(false)
        setMsg(res.ok ? { ok: true, text: "Integraciones guardadas." } : { ok: false, text: res.error ?? "Error" })
    }

    return (
        <div className="space-y-4">
            <Card className="p-6">
                <TabHeader
                    title="Integraciones"
                    desc="Feature flags y credenciales de servicios externos. Los tokens se guardan en texto plano — considerá rotarlos si se exponen."
                    icon={Bot}
                />

                <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm mb-4">
                    <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="text-xs">Estas integraciones están listas para configurar pero los conectores aún no ejecutan llamadas reales. Cuando activemos cada una, las credenciales de acá se van a usar automáticamente.</span>
                </div>

                {/* WhatsApp */}
                <IntegrationCard
                    name="WhatsApp Business"
                    enabled={form.whatsappEnabled}
                    onEnabledChange={(v) => setForm((f) => ({ ...f, whatsappEnabled: v }))}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="waNumber">Número de WhatsApp</Label>
                            <Input id="waNumber" value={form.whatsappNumber} onChange={(e) => setForm((f) => ({ ...f, whatsappNumber: e.target.value }))} placeholder="+54 9 3492 155-9075" />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="waKey">API key / Token</Label>
                            <Input id="waKey" type="password" value={form.whatsappApiKey} onChange={(e) => setForm((f) => ({ ...f, whatsappApiKey: e.target.value }))} />
                        </div>
                    </div>
                </IntegrationCard>

                {/* MercadoPago */}
                <IntegrationCard
                    name="MercadoPago"
                    enabled={form.mpEnabled}
                    onEnabledChange={(v) => setForm((f) => ({ ...f, mpEnabled: v }))}
                >
                    <div className="grid gap-1.5">
                        <Label htmlFor="mpToken">Access Token</Label>
                        <Input id="mpToken" type="password" value={form.mpAccessToken} onChange={(e) => setForm((f) => ({ ...f, mpAccessToken: e.target.value }))} placeholder="APP_USR-…" />
                        <p className="text-xs text-muted-foreground">Generalo en la consola de MercadoPago → Credenciales de producción.</p>
                    </div>
                </IntegrationCard>

                {/* AFIP */}
                <IntegrationCard
                    name="AFIP (facturación electrónica)"
                    enabled={form.afipEnabled}
                    onEnabledChange={(v) => setForm((f) => ({ ...f, afipEnabled: v }))}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="afipCuit">CUIT emisor</Label>
                            <Input id="afipCuit" value={form.afipCuit} onChange={(e) => setForm((f) => ({ ...f, afipCuit: e.target.value }))} placeholder="30-12345678-9" />
                        </div>
                        <div className="grid gap-1.5 md:col-span-2">
                            <Label htmlFor="afipCert">Notas del certificado</Label>
                            <Textarea id="afipCert" rows={2} value={form.afipCertNote} onChange={(e) => setForm((f) => ({ ...f, afipCertNote: e.target.value }))} placeholder="Ubicación del .pfx, fecha de vencimiento, contraseña..." />
                            <p className="text-xs text-muted-foreground">El certificado .pfx real NO se sube desde acá; se carga por ENV / filesystem del server.</p>
                        </div>
                    </div>
                </IntegrationCard>

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
        </div>
    )
}

function IntegrationCard({
    name,
    enabled,
    onEnabledChange,
    children,
}: {
    name: string
    enabled: boolean
    onEnabledChange: (v: boolean) => void
    children: React.ReactNode
}) {
    return (
        <div className="border rounded-lg p-4 space-y-3 mb-3">
            <div className="flex items-center justify-between">
                <div className="font-semibold">{name}</div>
                <Switch checked={enabled} onCheckedChange={onEnabledChange} />
            </div>
            {enabled && <div className="pt-2 border-t">{children}</div>}
        </div>
    )
}
