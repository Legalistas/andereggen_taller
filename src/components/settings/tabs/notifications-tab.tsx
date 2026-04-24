"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Bell, CheckCircle2, Info, Loader2, Send } from "lucide-react"
import { useState } from "react"
import { TabHeader, type AppSettings } from "../settings-section"

type Props = {
    settings: AppSettings
    onSave: (patch: Partial<AppSettings>) => Promise<{ ok: boolean; error?: string }>
}

type TestResult = { ok: boolean; text: string } | null

export default function NotificationsTab({ settings, onSave }: Props) {
    const [form, setForm] = useState({
        notifyOnLeadCreated: settings.notifyOnLeadCreated,
        notifyOnBudgetSent: settings.notifyOnBudgetSent,
        notifyOnBudgetReminder: settings.notifyOnBudgetReminder,
        notifyOnStageChange: settings.notifyOnStageChange,
        reminderDaysAfterSent: String(settings.reminderDaysAfterSent),
    })
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<TestResult>(null)

    const [smtpTest, setSmtpTest] = useState<TestResult>(null)
    const [smtpBusy, setSmtpBusy] = useState(false)

    const submit = async () => {
        setBusy(true); setMsg(null)
        const res = await onSave({
            notifyOnLeadCreated: form.notifyOnLeadCreated,
            notifyOnBudgetSent: form.notifyOnBudgetSent,
            notifyOnBudgetReminder: form.notifyOnBudgetReminder,
            notifyOnStageChange: form.notifyOnStageChange,
            reminderDaysAfterSent: Number(form.reminderDaysAfterSent),
        })
        setBusy(false)
        setMsg(res.ok ? { ok: true, text: "Preferencias guardadas." } : { ok: false, text: res.error ?? "Error" })
    }

    const testSmtp = async () => {
        setSmtpBusy(true); setSmtpTest(null)
        try {
            const res = await fetch("/api/email/test")
            const body = await res.json().catch(() => ({}))
            if (!res.ok || !body.ok) {
                throw new Error(body?.error ?? "SMTP no responde")
            }
            setSmtpTest({ ok: true, text: `SMTP OK · provider: ${body.provider ?? "-"}` })
        } catch (e) {
            setSmtpTest({ ok: false, text: e instanceof Error ? e.message : "Error" })
        } finally {
            setSmtpBusy(false)
        }
    }

    const toggle = (key: keyof typeof form) => (v: boolean) => setForm((f) => ({ ...f, [key]: v }))

    return (
        <div className="space-y-4">
            <Card className="p-6">
                <TabHeader
                    title="Notificaciones automáticas"
                    desc="Qué correos dispara el sistema automáticamente ante eventos del CRM y producción."
                    icon={Bell}
                />

                <div className="space-y-4">
                    <ToggleRow label="Confirmar al recibir solicitud de presupuesto" desc="Email al cliente cuando se crea un lead nuevo." checked={form.notifyOnLeadCreated} onChange={toggle("notifyOnLeadCreated")} />
                    <ToggleRow label="Notificar cuando se envía un presupuesto" desc="Adjunta el PDF al cliente." checked={form.notifyOnBudgetSent} onChange={toggle("notifyOnBudgetSent")} />
                    <ToggleRow label="Recordatorio de presupuesto sin respuesta" desc="Si no respondió después de X días, se le vuelve a escribir." checked={form.notifyOnBudgetReminder} onChange={toggle("notifyOnBudgetReminder")} />
                    <ToggleRow label="Cambios de estado en producción" desc="Avisa al cliente cuando el vehículo pasa de etapa." checked={form.notifyOnStageChange} onChange={toggle("notifyOnStageChange")} />

                    <div className="grid gap-1.5 max-w-xs pt-2 border-t">
                        <Label htmlFor="reminderDays">Días antes del recordatorio</Label>
                        <Input id="reminderDays" type="number" min="1" value={form.reminderDaysAfterSent} onChange={(e) => setForm((f) => ({ ...f, reminderDaysAfterSent: e.target.value }))} />
                        <p className="text-xs text-muted-foreground">Solo aplica si el recordatorio automático está activado.</p>
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

            <Card className="p-6">
                <TabHeader
                    title="Configuración SMTP"
                    desc="Los secretos (usuario, password, host) se leen de .env y no se editan desde acá por seguridad."
                    icon={Send}
                />

                <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                        <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                            <p className="font-medium">SMTP se configura en <code className="text-xs">.env</code></p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Variables: <code className="text-xs">SMTP_PROVIDER</code>, <code className="text-xs">SMTP_USER</code>, <code className="text-xs">SMTP_PASS</code>, <code className="text-xs">SMTP_FROM</code>. Para Gmail generá un App Password.
                            </p>
                        </div>
                    </div>

                    {smtpTest && (
                        <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${smtpTest.ok ? "border-green-500/40 bg-green-500/10 text-green-700" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
                            {smtpTest.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                            <span>{smtpTest.text}</span>
                        </div>
                    )}

                    <Button variant="outline" onClick={testSmtp} disabled={smtpBusy} className="gap-2">
                        {smtpBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Probando…</> : <><Send className="h-4 w-4" /> Probar conexión SMTP</>}
                    </Button>
                </div>
            </Card>
        </div>
    )
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2">
            <div className="flex-1">
                <div className="font-medium text-sm">{label}</div>
                <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    )
}
