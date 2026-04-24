"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, Edit, Loader2, Plus, Tag, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { TabHeader } from "../settings-section"

type Source = {
    id: string
    key: string
    label: string
    order: number
    isActive: boolean
    createdAt: string
}

export default function SourcesTab() {
    const [sources, setSources] = useState<Source[]>([])
    const [loading, setLoading] = useState(true)

    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<Source | null>(null)
    const [form, setForm] = useState({ key: "", label: "", order: "100", isActive: true })
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [deleteTarget, setDeleteTarget] = useState<Source | null>(null)
    const [deleteBusy, setDeleteBusy] = useState(false)

    const fetchSources = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/lead-sources")
            const body = await res.json()
            setSources(body.sources ?? [])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchSources() }, [fetchSources])

    const openCreate = () => {
        setEditing(null)
        setForm({ key: "", label: "", order: "100", isActive: true })
        setError(null)
        setFormOpen(true)
    }

    const openEdit = (s: Source) => {
        setEditing(s)
        setForm({ key: s.key, label: s.label, order: String(s.order), isActive: s.isActive })
        setError(null)
        setFormOpen(true)
    }

    const submit = async () => {
        if (!form.label.trim()) { setError("El label es obligatorio"); return }
        if (!editing && !form.key.trim()) { setError("La key es obligatoria"); return }
        setBusy(true); setError(null)
        try {
            const url = editing ? `/api/lead-sources/${editing.id}` : "/api/lead-sources"
            const payload: Record<string, unknown> = {
                label: form.label.trim(),
                order: Number(form.order || 100),
                isActive: form.isActive,
            }
            if (!editing) payload.key = form.key.trim()
            const res = await fetch(url, {
                method: editing ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
            setFormOpen(false)
            await fetchSources()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error")
        } finally {
            setBusy(false)
        }
    }

    const submitDelete = async () => {
        if (!deleteTarget) return
        setDeleteBusy(true)
        try {
            await fetch(`/api/lead-sources/${deleteTarget.id}`, { method: "DELETE" })
            setDeleteTarget(null)
            await fetchSources()
        } finally {
            setDeleteBusy(false)
        }
    }

    return (
        <Card className="p-6">
            <TabHeader
                title="Fuentes de lead"
                desc="Etiquetas disponibles al crear un lead (web, WhatsApp, referido, etc.). La key es el identificador estable; no se puede cambiar después."
                icon={Tag}
            />

            <div className="flex justify-end mb-4">
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="h-4 w-4" /> Nueva fuente
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-40">Key</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead className="w-20 text-right">Orden</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && sources.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Cargando…
                            </TableCell>
                        </TableRow>
                    )}
                    {!loading && sources.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                                Sin fuentes todavía.
                            </TableCell>
                        </TableRow>
                    )}
                    {sources.map((s) => (
                        <TableRow key={s.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{s.key}</TableCell>
                            <TableCell className="font-medium">{s.label}</TableCell>
                            <TableCell className="text-right text-sm">{s.order}</TableCell>
                            <TableCell>
                                {s.isActive ? (
                                    <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 border-green-200">
                                        <div className="h-2 w-2 rounded-full bg-green-500" /> Activa
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="gap-1 bg-gray-500/10 text-gray-700 border-gray-200">
                                        <div className="h-2 w-2 rounded-full bg-gray-500" /> Inactiva
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="h-8 w-8 p-0">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(s)} className="h-8 w-8 p-0 text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* Dialog de crear/editar */}
            <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setError(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editing ? <Edit className="h-5 w-5 text-[#003b73]" /> : <Plus className="h-5 w-5 text-[#003b73]" />}
                            {editing ? "Editar fuente" : "Nueva fuente"}
                        </DialogTitle>
                        <DialogDescription>
                            {editing ? "La key no se puede cambiar; sólo label, orden y estado."
                                : "La key se normaliza automáticamente (ej: \"Redes Sociales\" → \"redes_sociales\")."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                        {!editing && (
                            <div className="grid gap-1.5">
                                <Label htmlFor="srcKey">Key *</Label>
                                <Input id="srcKey" value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} placeholder="redes_sociales" />
                            </div>
                        )}
                        <div className="grid gap-1.5">
                            <Label htmlFor="srcLabel">Label visible *</Label>
                            <Input id="srcLabel" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Redes sociales" />
                        </div>
                        <div className="grid gap-1.5 max-w-32">
                            <Label htmlFor="srcOrder">Orden</Label>
                            <Input id="srcOrder" type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))} />
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                            <Label htmlFor="srcActive" className="cursor-pointer">Activa</Label>
                            <Switch id="srcActive" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
                        </div>
                        {error && (
                            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{error}</span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>Cancelar</Button>
                        <Button onClick={submit} disabled={busy} className="gap-2">
                            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete */}
            <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Eliminar fuente</DialogTitle>
                        <DialogDescription>
                            {deleteTarget && <>¿Eliminar <b>{deleteTarget.label}</b> (<code className="text-xs">{deleteTarget.key}</code>)? Los leads existentes con esta fuente conservan el valor pero no aparecerá más en nuevos leads.</>}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>Cancelar</Button>
                        <Button variant="destructive" onClick={submitDelete} disabled={deleteBusy} className="gap-2">
                            {deleteBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando…</> : <><Trash2 className="h-4 w-4" /> Eliminar</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
