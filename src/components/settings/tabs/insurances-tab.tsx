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
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Edit, Loader2, Mail, Phone, Plus, ShieldCheck, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { TabHeader } from "../settings-section"

type Company = {
    id: string
    name: string
    phone: string | null
    email: string | null
    contactName: string | null
    notes: string | null
    isActive: boolean
    createdAt: string
}

export default function InsurancesTab() {
    const [companies, setCompanies] = useState<Company[]>([])
    const [loading, setLoading] = useState(true)

    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<Company | null>(null)
    const [form, setForm] = useState({ name: "", phone: "", email: "", contactName: "", notes: "", isActive: true })
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
    const [deleteBusy, setDeleteBusy] = useState(false)

    const fetchCompanies = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/insurance-companies")
            const body = await res.json()
            setCompanies(body.companies ?? [])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchCompanies() }, [fetchCompanies])

    const openCreate = () => {
        setEditing(null)
        setForm({ name: "", phone: "", email: "", contactName: "", notes: "", isActive: true })
        setError(null)
        setFormOpen(true)
    }

    const openEdit = (c: Company) => {
        setEditing(c)
        setForm({
            name: c.name,
            phone: c.phone ?? "",
            email: c.email ?? "",
            contactName: c.contactName ?? "",
            notes: c.notes ?? "",
            isActive: c.isActive,
        })
        setError(null)
        setFormOpen(true)
    }

    const submit = async () => {
        if (!form.name.trim()) {
            setError("El nombre es obligatorio")
            return
        }
        setBusy(true); setError(null)
        try {
            const url = editing ? `/api/insurance-companies/${editing.id}` : "/api/insurance-companies"
            const res = await fetch(url, {
                method: editing ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    phone: form.phone || null,
                    email: form.email || null,
                    contactName: form.contactName || null,
                    notes: form.notes || null,
                    isActive: form.isActive,
                }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
            setFormOpen(false)
            await fetchCompanies()
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
            await fetch(`/api/insurance-companies/${deleteTarget.id}`, { method: "DELETE" })
            setDeleteTarget(null)
            await fetchCompanies()
        } finally {
            setDeleteBusy(false)
        }
    }

    return (
        <Card className="p-6">
            <TabHeader
                title="Aseguradoras"
                desc="Lista de compañías con las que trabaja el taller. Se usan como autocomplete al cargar un vehículo."
                icon={ShieldCheck}
            />

            <div className="flex justify-end mb-4">
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="h-4 w-4" /> Nueva aseguradora
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && companies.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Cargando…
                            </TableCell>
                        </TableRow>
                    )}
                    {!loading && companies.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                                Sin aseguradoras todavía.
                            </TableCell>
                        </TableRow>
                    )}
                    {companies.map((c) => (
                        <TableRow key={c.id}>
                            <TableCell>
                                <div className="font-medium">{c.name}</div>
                                {c.contactName && <div className="text-xs text-muted-foreground">{c.contactName}</div>}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                    {c.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</div>}
                                    {c.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</div>}
                                </div>
                            </TableCell>
                            <TableCell>
                                {c.isActive ? (
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
                                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="h-8 w-8 p-0">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)} className="h-8 w-8 p-0 text-destructive">
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
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editing ? <Edit className="h-5 w-5 text-[#003b73]" /> : <Plus className="h-5 w-5 text-[#003b73]" />}
                            {editing ? "Editar aseguradora" : "Nueva aseguradora"}
                        </DialogTitle>
                        <DialogDescription>Los datos se usan al cargar vehículos y en notificaciones a la aseguradora.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="insName">Nombre *</Label>
                            <Input id="insName" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label htmlFor="insPhone">Teléfono</Label>
                                <Input id="insPhone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="insEmail">Email</Label>
                                <Input id="insEmail" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="insContact">Contacto</Label>
                            <Input id="insContact" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} placeholder="Mesa de siniestros" />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="insNotes">Notas</Label>
                            <Textarea id="insNotes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                            <Label htmlFor="insActive" className="cursor-pointer">Activa</Label>
                            <Switch id="insActive" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
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

            {/* Dialog de eliminar */}
            <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Eliminar aseguradora</DialogTitle>
                        <DialogDescription>
                            {deleteTarget && <>¿Seguro querés eliminar <b>{deleteTarget.name}</b>? Esta acción no se puede deshacer.</>}
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
