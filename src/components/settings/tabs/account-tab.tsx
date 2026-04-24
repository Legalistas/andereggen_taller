"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import { useState } from "react"
import { TabHeader } from "../settings-section"

export default function AccountTab() {
    const [current, setCurrent] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    const submit = async () => {
        setMsg(null)
        if (newPassword.length < 8) {
            setMsg({ ok: false, text: "La contraseña nueva debe tener al menos 8 caracteres." })
            return
        }
        if (newPassword !== confirm) {
            setMsg({ ok: false, text: "La confirmación no coincide." })
            return
        }
        setBusy(true)
        try {
            const res = await fetch("/api/users/me/password", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: current, newPassword }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
            setMsg({ ok: true, text: "Contraseña actualizada." })
            setCurrent("")
            setNewPassword("")
            setConfirm("")
        } catch (e) {
            setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" })
        } finally {
            setBusy(false)
        }
    }

    return (
        <Card className="p-6">
            <TabHeader
                title="Cambiar contraseña"
                desc="Se aplica a tu propia cuenta. Mínimo 8 caracteres."
                icon={KeyRound}
            />

            <div className="grid gap-4 max-w-md">
                <div className="grid gap-1.5">
                    <Label htmlFor="currentPw">Contraseña actual</Label>
                    <div className="relative">
                        <Input
                            id="currentPw"
                            type={showCurrent ? "text" : "password"}
                            value={current}
                            onChange={(e) => setCurrent(e.target.value)}
                            autoComplete="current-password"
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowCurrent((v) => !v)}
                            aria-label={showCurrent ? "Ocultar" : "Mostrar"}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                            tabIndex={-1}
                        >
                            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <div className="grid gap-1.5">
                    <Label htmlFor="newPw">Nueva contraseña</Label>
                    <div className="relative">
                        <Input
                            id="newPw"
                            type={showNew ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            autoComplete="new-password"
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowNew((v) => !v)}
                            aria-label={showNew ? "Ocultar" : "Mostrar"}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                            tabIndex={-1}
                        >
                            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <div className="grid gap-1.5">
                    <Label htmlFor="confirmPw">Confirmar nueva contraseña</Label>
                    <Input
                        id="confirmPw"
                        type={showNew ? "text" : "password"}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                    />
                </div>

                {msg && (
                    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${msg.ok ? "border-green-500/40 bg-green-500/10 text-green-700" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
                        {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                        <span>{msg.text}</span>
                    </div>
                )}

                <div className="flex justify-end">
                    <Button onClick={submit} disabled={busy} className="gap-2">
                        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Actualizando…</> : <><KeyRound className="h-4 w-4" /> Cambiar contraseña</>}
                    </Button>
                </div>
            </div>
        </Card>
    )
}
