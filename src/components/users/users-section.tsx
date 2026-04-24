"use client"

import type React from "react"

import { useCallback, useEffect, useState } from "react"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
    AlertCircle,
    AlertTriangle,
    Ban,
    Calendar,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Edit,
    Eye,
    Loader2,
    Lock,
    LockOpen,
    Mail,
    MoreVertical,
    Phone,
    Plus,
    Search,
    Send,
    Shield,
    ShieldCheck,
    Trash2,
    UserCheck,
    UserCog,
    UserIcon,
    Wrench,
} from "lucide-react"

type UserDataType = {
    id: string
    name: string | null
    email: string | null
    isActive: boolean
    role: { id: string; name: string } | null
    createdAt: string
}

type RoleStyle = { label: string; color: string; icon: React.ComponentType<{ className?: string }> }

const roleConfig: Record<string, RoleStyle> = {
    admin: { label: "Administrador", color: "bg-purple-500/10 text-purple-700 border-purple-200", icon: ShieldCheck },
    internal: { label: "Interno", color: "bg-indigo-500/10 text-indigo-700 border-indigo-200", icon: Shield },
    manager: { label: "Gerente", color: "bg-blue-500/10 text-blue-700 border-blue-200", icon: Shield },
    mechanic: { label: "Mecánico", color: "bg-orange-500/10 text-orange-700 border-orange-200", icon: Wrench },
    receptionist: {
        label: "Recepcionista",
        color: "bg-green-500/10 text-green-700 border-green-200",
        icon: UserCheck,
    },
    quality_control: { label: "Control de Calidad", color: "bg-cyan-500/10 text-cyan-700 border-cyan-200", icon: UserCog },
    customer: { label: "Cliente", color: "bg-slate-500/10 text-slate-700 border-slate-200", icon: UserIcon },
}

const DEFAULT_ROLE_STYLE: RoleStyle = {
    label: "Sin rol",
    color: "bg-muted text-muted-foreground border-border",
    icon: UserIcon,
}

type Role = { id: string; name: string }

type Props = {
    currentUserId: string | null
}

export default function UsersSection({ currentUserId }: Props) {
    const [users, setUsers] = useState<UserDataType[]>([])
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [filterRole, setFilterRole] = useState<string>("all")
    const [selectedUsers, setSelectedUsers] = useState<string[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Roles disponibles para el select de "Cambiar rol"
    const [roles, setRoles] = useState<Role[]>([])

    // Dialogs de cada acción — cada uno guarda el user "target"
    const [profileUser, setProfileUser] = useState<UserDataType | null>(null)
    const [editUser, setEditUser] = useState<UserDataType | null>(null)
    const [editName, setEditName] = useState("")
    const [editEmail, setEditEmail] = useState("")
    const [roleUser, setRoleUser] = useState<UserDataType | null>(null)
    const [roleSelectValue, setRoleSelectValue] = useState<string>("")
    const [blockUser, setBlockUser] = useState<UserDataType | null>(null)
    const [deleteUser, setDeleteUser] = useState<UserDataType | null>(null)
    const [actionBusy, setActionBusy] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)

    const fetchUsers = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setLoadError(null)
        try {
            const res = await fetch("/api/users", { signal })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = (await res.json()) as { users: UserDataType[] }
            setUsers(data.users)
        } catch (e) {
            if ((e as Error).name !== "AbortError") {
                setLoadError(e instanceof Error ? e.message : "Error al cargar usuarios")
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const ac = new AbortController()
        fetchUsers(ac.signal)
        return () => ac.abort()
    }, [fetchUsers])

    // Fetch de roles (una sola vez; lo usamos en el dialog "Cambiar rol")
    useEffect(() => {
        const ac = new AbortController()
        fetch("/api/roles", { signal: ac.signal })
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data?.roles)) setRoles(data.roles as Role[])
            })
            .catch(() => {})
        return () => ac.abort()
    }, [])

    const isSelf = (u: UserDataType | null) => !!u && !!currentUserId && u.id === currentUserId

    // ── Handlers de cada acción ───────────────────────────────────────────

    const openProfile = (u: UserDataType) => {
        setActionError(null)
        setProfileUser(u)
    }

    const openEdit = (u: UserDataType) => {
        setActionError(null)
        setEditUser(u)
        setEditName(u.name ?? "")
        setEditEmail(u.email ?? "")
    }

    const submitEdit = async () => {
        if (!editUser) return
        setActionBusy(true)
        setActionError(null)
        try {
            const res = await fetch(`/api/users/${editUser.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName, email: editEmail }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
            setEditUser(null)
            await fetchUsers()
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "Error al guardar")
        } finally {
            setActionBusy(false)
        }
    }

    const openRole = (u: UserDataType) => {
        setActionError(null)
        setRoleUser(u)
        setRoleSelectValue(u.role?.id ?? "")
    }

    const submitRole = async () => {
        if (!roleUser) return
        setActionBusy(true)
        setActionError(null)
        try {
            const res = await fetch(`/api/users/${roleUser.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roleId: roleSelectValue || null }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
            setRoleUser(null)
            await fetchUsers()
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "Error al cambiar rol")
        } finally {
            setActionBusy(false)
        }
    }

    const openBlock = (u: UserDataType) => {
        setActionError(null)
        setBlockUser(u)
    }

    const submitBlock = async () => {
        if (!blockUser) return
        setActionBusy(true)
        setActionError(null)
        try {
            const res = await fetch(`/api/users/${blockUser.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !blockUser.isActive }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
            setBlockUser(null)
            await fetchUsers()
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "Error")
        } finally {
            setActionBusy(false)
        }
    }

    const openDelete = (u: UserDataType) => {
        setActionError(null)
        setDeleteUser(u)
    }

    const submitDelete = async () => {
        if (!deleteUser) return
        setActionBusy(true)
        setActionError(null)
        try {
            const res = await fetch(`/api/users/${deleteUser.id}`, { method: "DELETE" })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
            setDeleteUser(null)
            await fetchUsers()
        } catch (e) {
            setActionError(e instanceof Error ? e.message : "Error al eliminar")
        } finally {
            setActionBusy(false)
        }
    }

    // Dialog "Enviar email de prueba"
    const [emailDialogOpen, setEmailDialogOpen] = useState(false)
    const [emailTo, setEmailTo] = useState("")
    const [emailName, setEmailName] = useState("")
    const [emailSending, setEmailSending] = useState(false)
    const [emailResult, setEmailResult] = useState<{ ok: boolean; msg: string } | null>(null)

    const openEmailDialog = (email: string, name: string) => {
        setEmailTo(email)
        setEmailName(name)
        setEmailResult(null)
        setEmailDialogOpen(true)
    }

    const handleSendTestEmail = async () => {
        if (!emailTo) {
            setEmailResult({ ok: false, msg: "Ingresá una dirección de email." })
            return
        }
        setEmailSending(true)
        setEmailResult(null)
        try {
            const res = await fetch("/api/email/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: emailTo, name: emailName || "Usuario" }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(body?.error ?? `HTTP ${res.status}`)
            }
            setEmailResult({
                ok: true,
                msg: `Enviado a ${body.accepted?.join(", ") ?? emailTo}. Message-ID: ${body.messageId ?? "-"}`,
            })
        } catch (e) {
            setEmailResult({ ok: false, msg: e instanceof Error ? e.message : "Error al enviar" })
        } finally {
            setEmailSending(false)
        }
    }

    // Filtrar usuarios
    const filteredUsers = users.filter((user) => {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch =
            !searchLower ||
            (user.name ?? "").toLowerCase().includes(searchLower) ||
            (user.email ?? "").toLowerCase().includes(searchLower)
        const matchesRole = filterRole === "all" || user.role?.name === filterRole
        return matchesSearch && matchesRole
    })

    // Paginación
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

    // Selección
    const toggleUser = (id: string) => {
        setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((userId) => userId !== id) : [...prev, id]))
    }

    const toggleAllUsers = () => {
        if (selectedUsers.length === paginatedUsers.length) {
            setSelectedUsers([])
        } else {
            setSelectedUsers(paginatedUsers.map((u) => u.id))
        }
    }

    const isAllSelected = selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0
    const isSomeSelected = selectedUsers.length > 0 && selectedUsers.length < paginatedUsers.length

    const handleItemsPerPageChange = (value: number) => {
        setItemsPerPage(value)
        setCurrentPage(1)
    }

    // Estadísticas
    const stats = {
        total: users.length,
        active: users.filter((u) => u.isActive).length,
        admins: users.filter((u) => u.role?.name === "admin").length,
        mechanics: users.filter((u) => u.role?.name === "mechanic").length,
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <Breadcrumbs items={[{ label: "Usuarios" }]} />
                    <h1 className="text-3xl font-bold text-foreground">Gestión de usuarios</h1>
                    <p className="text-sm text-muted-foreground mt-1">Administrar usuarios, roles y permisos del sistema</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nuevo Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Agregar Nuevo Usuario</DialogTitle>
                            <DialogDescription>Complete los datos del usuario y asigne un rol en el sistema</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="userName">Nombre completo *</Label>
                                <Input id="userName" placeholder="Ej: Juan Pérez" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="userEmail">Email *</Label>
                                    <Input id="userEmail" type="email" placeholder="usuario@taller.com" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="userPhone">Teléfono *</Label>
                                    <Input id="userPhone" placeholder="+54 9 11 1234-5678" />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="userRole">Rol *</Label>
                                <Select>
                                    <SelectTrigger id="userRole">
                                        <SelectValue placeholder="Seleccionar rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="h-4 w-4 text-purple-600" />
                                                <span>Administrador</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="manager">
                                            <div className="flex items-center gap-2">
                                                <Shield className="h-4 w-4 text-blue-600" />
                                                <span>Gerente</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="mechanic">
                                            <div className="flex items-center gap-2">
                                                <Wrench className="h-4 w-4 text-orange-600" />
                                                <span>Mecánico</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="receptionist">
                                            <div className="flex items-center gap-2">
                                                <UserCheck className="h-4 w-4 text-green-600" />
                                                <span>Recepcionista</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="quality">
                                            <div className="flex items-center gap-2">
                                                <UserCog className="h-4 w-4 text-cyan-600" />
                                                <span>Control de Calidad</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="border rounded-lg p-4 bg-muted/30">
                                <h4 className="font-semibold text-sm mb-3">Permisos del Rol</h4>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    <p className="font-medium text-foreground">Seleccione un rol para ver los permisos</p>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        <li>Los permisos se asignan automáticamente según el rol</li>
                                        <li>Los administradores tienen acceso completo al sistema</li>
                                        <li>Los gerentes pueden gestionar producción y reportes</li>
                                        <li>Los mecánicos solo acceden a sus trabajos asignados</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="password">Contraseña temporal *</Label>
                                    <Input id="password" type="password" placeholder="Mínimo 8 caracteres" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
                                    <Input id="confirmPassword" type="password" placeholder="Repetir contraseña" />
                                </div>
                            </div>

                            <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/30">
                                <div>
                                    <Label htmlFor="activeUser" className="cursor-pointer">
                                        Usuario activo
                                    </Label>
                                    <p className="text-xs text-muted-foreground">El usuario podrá acceder al sistema inmediatamente</p>
                                </div>
                                <Switch id="activeUser" defaultChecked />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={() => setIsDialogOpen(false)}>Crear Usuario</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Total Usuarios</p>
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <UserIcon className="h-5 w-5 text-blue-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Usuarios Activos</p>
                            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <UserCheck className="h-5 w-5 text-green-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Administradores</p>
                            <p className="text-2xl font-bold text-foreground">{stats.admins}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5 text-purple-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Mecánicos</p>
                            <p className="text-2xl font-bold text-foreground">{stats.mechanics}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <Wrench className="h-5 w-5 text-orange-600" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters and Search */}
            <Card className="p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre, email o teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex gap-2">
                        {selectedUsers.length > 0 ? (
                            <>
                                <span className="text-sm text-muted-foreground self-center">
                                    {selectedUsers.length} seleccionado{selectedUsers.length > 1 ? "s" : ""}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        const first = users.find((u) => selectedUsers.includes(u.id))
                                        openEmailDialog(first?.email ?? "", first?.name ?? "Usuario")
                                    }}
                                >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Enviar correo
                                </Button>
                                <Button size="sm" variant="outline">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Cambiar rol
                                </Button>
                                <Button size="sm" variant="outline">
                                    Exportar
                                </Button>
                                <Button size="sm" variant="outline" className="text-destructive bg-transparent">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Select value={filterRole} onValueChange={setFilterRole}>
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Filtrar por rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los roles</SelectItem>
                                        <SelectItem value="admin">Administrador</SelectItem>
                                        <SelectItem value="internal">Interno</SelectItem>
                                        <SelectItem value="manager">Gerente</SelectItem>
                                        <SelectItem value="mechanic">Mecánico</SelectItem>
                                        <SelectItem value="receptionist">Recepcionista</SelectItem>
                                        <SelectItem value="quality_control">Control de Calidad</SelectItem>
                                    </SelectContent>
                                </Select>
                            </>
                        )}
                    </div>
                </div>
            </Card>

            {/* Users Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={toggleAllUsers}
                                    aria-label="Seleccionar todos"
                                    className={isSomeSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                />
                            </TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Creado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && paginatedUsers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">
                                    Cargando usuarios…
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && paginatedUsers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">
                                    {loadError ?? "Sin usuarios para mostrar."}
                                </TableCell>
                            </TableRow>
                        )}
                        {paginatedUsers.map((user) => {
                            const roleStyle = (user.role && roleConfig[user.role.name]) ?? DEFAULT_ROLE_STYLE
                            const RoleIcon = roleStyle.icon
                            return (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedUsers.includes(user.id)}
                                            onCheckedChange={() => toggleUser(user.id)}
                                            aria-label={`Seleccionar ${user.name ?? user.email ?? user.id}`}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                <UserIcon className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">
                                                    {user.name ?? <span className="italic text-muted-foreground">sin nombre</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Mail className="h-3 w-3" />
                                            {user.email ?? "—"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`gap-1 ${roleStyle.color}`}>
                                            <RoleIcon className="h-3 w-3" />
                                            {roleStyle.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.isActive ? (
                                            <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 border-green-200">
                                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                                Activo
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="gap-1 bg-gray-500/10 text-gray-700 border-gray-200">
                                                <div className="h-2 w-2 rounded-full bg-gray-500" />
                                                Inactivo
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(user.createdAt).toLocaleDateString("es-AR")}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem className="gap-2" onClick={() => openProfile(user)}>
                                                    <Eye className="h-4 w-4" />
                                                    Ver perfil
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="gap-2" onClick={() => openEdit(user)}>
                                                    <Edit className="h-4 w-4" />
                                                    Editar usuario
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="gap-2"
                                                    disabled={isSelf(user)}
                                                    onClick={() => openRole(user)}
                                                >
                                                    <Shield className="h-4 w-4" />
                                                    Cambiar rol
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="gap-2"
                                                    onClick={() => openEmailDialog(user.email ?? "", user.name ?? "")}
                                                >
                                                    <Mail className="h-4 w-4" />
                                                    Enviar correo
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="gap-2"
                                                    disabled={isSelf(user)}
                                                    onClick={() => openBlock(user)}
                                                >
                                                    {user.isActive ? (
                                                        <Ban className="h-4 w-4" />
                                                    ) : (
                                                        <LockOpen className="h-4 w-4" />
                                                    )}
                                                    {user.isActive ? "Bloquear usuario" : "Desbloquear usuario"}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="gap-2 text-destructive"
                                                    disabled={isSelf(user)}
                                                    onClick={() => openDelete(user)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Eliminar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t px-4 py-4">
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                            Mostrando {startIndex + 1} a {Math.min(endIndex, filteredUsers.length)} de {filteredUsers.length} usuarios
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Mostrar</span>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 gap-1 bg-transparent">
                                        {itemsPerPage}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuItem onClick={() => handleItemsPerPageChange(10)}>10</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleItemsPerPageChange(25)}>25</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleItemsPerPageChange(50)}>50</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <span className="text-sm text-muted-foreground">por página</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                        </Button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <Button
                                    key={page}
                                    variant={currentPage === page ? "default" : "outline"}
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Dialog: Ver perfil */}
            <Dialog open={!!profileUser} onOpenChange={(v) => { if (!v) setProfileUser(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserIcon className="h-5 w-5 text-[#003b73]" />
                            Perfil del usuario
                        </DialogTitle>
                        <DialogDescription>Información de la cuenta.</DialogDescription>
                    </DialogHeader>
                    {profileUser && (
                        <div className="space-y-4 py-2">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                    <UserIcon className="h-8 w-8 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-semibold text-lg truncate">
                                        {profileUser.name ?? <span className="italic text-muted-foreground">sin nombre</span>}
                                    </div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {profileUser.email ?? "—"}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
                                <div>
                                    <div className="text-xs text-muted-foreground mb-1">Rol</div>
                                    {(() => {
                                        const rs = (profileUser.role && roleConfig[profileUser.role.name]) ?? DEFAULT_ROLE_STYLE
                                        const Icon = rs.icon
                                        return (
                                            <Badge variant="outline" className={`gap-1 ${rs.color}`}>
                                                <Icon className="h-3 w-3" /> {rs.label}
                                            </Badge>
                                        )
                                    })()}
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground mb-1">Estado</div>
                                    {profileUser.isActive ? (
                                        <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 border-green-200">
                                            <div className="h-2 w-2 rounded-full bg-green-500" /> Activo
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="gap-1 bg-gray-500/10 text-gray-700 border-gray-200">
                                            <div className="h-2 w-2 rounded-full bg-gray-500" /> Inactivo
                                        </Badge>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <div className="text-xs text-muted-foreground mb-1">Creado</div>
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                        {new Date(profileUser.createdAt).toLocaleString("es-AR")}
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-xs text-muted-foreground mb-1">ID</div>
                                    <code className="text-xs break-all">{profileUser.id}</code>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProfileUser(null)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Editar usuario */}
            <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) { setEditUser(null); setActionError(null) } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5 text-[#003b73]" />
                            Editar usuario
                        </DialogTitle>
                        <DialogDescription>Actualizá nombre y email del usuario.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="editName">Nombre</Label>
                            <Input
                                id="editName"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                disabled={actionBusy}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="editEmail">Email</Label>
                            <Input
                                id="editEmail"
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                disabled={actionBusy}
                            />
                        </div>
                        {actionError && (
                            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>{actionError}</span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditUser(null)} disabled={actionBusy}>Cancelar</Button>
                        <Button onClick={submitEdit} disabled={actionBusy} className="gap-2">
                            {actionBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Cambiar rol */}
            <Dialog open={!!roleUser} onOpenChange={(v) => { if (!v) { setRoleUser(null); setActionError(null) } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-[#003b73]" />
                            Cambiar rol
                        </DialogTitle>
                        <DialogDescription>
                            {roleUser && `Asignar un nuevo rol a ${roleUser.name ?? roleUser.email}.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Rol</Label>
                            <Select value={roleSelectValue} onValueChange={setRoleSelectValue} disabled={actionBusy}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                                <SelectContent>
                                    {roles.map((r) => (
                                        <SelectItem key={r.id} value={r.id}>
                                            {roleConfig[r.name]?.label ?? r.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {actionError && (
                            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>{actionError}</span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRoleUser(null)} disabled={actionBusy}>Cancelar</Button>
                        <Button onClick={submitRole} disabled={actionBusy || !roleSelectValue} className="gap-2">
                            {actionBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Cambiar rol"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Bloquear / Desbloquear */}
            <Dialog open={!!blockUser} onOpenChange={(v) => { if (!v) { setBlockUser(null); setActionError(null) } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {blockUser?.isActive ? <Ban className="h-5 w-5 text-destructive" /> : <LockOpen className="h-5 w-5 text-green-600" />}
                            {blockUser?.isActive ? "Bloquear usuario" : "Desbloquear usuario"}
                        </DialogTitle>
                        <DialogDescription>
                            {blockUser && blockUser.isActive
                                ? `El usuario ${blockUser.name ?? blockUser.email} no podrá iniciar sesión hasta que lo desbloquees.`
                                : blockUser
                                    ? `${blockUser.name ?? blockUser.email} podrá volver a iniciar sesión normalmente.`
                                    : ""}
                        </DialogDescription>
                    </DialogHeader>
                    {actionError && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{actionError}</span>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBlockUser(null)} disabled={actionBusy}>Cancelar</Button>
                        <Button
                            onClick={submitBlock}
                            disabled={actionBusy}
                            variant={blockUser?.isActive ? "destructive" : "default"}
                            className="gap-2"
                        >
                            {actionBusy ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Aplicando…</>
                            ) : blockUser?.isActive ? (
                                <><Lock className="h-4 w-4" /> Bloquear</>
                            ) : (
                                <><LockOpen className="h-4 w-4" /> Desbloquear</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Eliminar usuario */}
            <Dialog open={!!deleteUser} onOpenChange={(v) => { if (!v) { setDeleteUser(null); setActionError(null) } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Eliminar usuario
                        </DialogTitle>
                        <DialogDescription>
                            Esta acción es permanente. Si el usuario tiene leads o presupuestos asociados, se
                            recomienda <b>bloquearlo</b> en lugar de eliminarlo.
                        </DialogDescription>
                    </DialogHeader>
                    {deleteUser && (
                        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                            <div className="font-medium">{deleteUser.name ?? "sin nombre"}</div>
                            <div className="text-xs text-muted-foreground">{deleteUser.email}</div>
                        </div>
                    )}
                    {actionError && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{actionError}</span>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={actionBusy}>Cancelar</Button>
                        <Button onClick={submitDelete} disabled={actionBusy} variant="destructive" className="gap-2">
                            {actionBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando…</> : <><Trash2 className="h-4 w-4" /> Eliminar</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: enviar email de prueba */}
            <Dialog
                open={emailDialogOpen}
                onOpenChange={(v) => {
                    setEmailDialogOpen(v)
                    if (!v) setEmailResult(null)
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Send className="h-5 w-5 text-[#003b73]" />
                            Enviar email de prueba
                        </DialogTitle>
                        <DialogDescription>
                            Dispara la plantilla <code className="text-xs">SampleEmail</code> vía SMTP. Los usuarios
                            actuales son mock — editá el destinatario si querés que te llegue a vos.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="emailTo">Destinatario (email)</Label>
                            <Input
                                id="emailTo"
                                type="email"
                                value={emailTo}
                                onChange={(e) => setEmailTo(e.target.value)}
                                placeholder="tu@correo.com"
                                disabled={emailSending}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="emailName">Nombre en el saludo</Label>
                            <Input
                                id="emailName"
                                value={emailName}
                                onChange={(e) => setEmailName(e.target.value)}
                                placeholder="Pablo"
                                disabled={emailSending}
                            />
                        </div>

                        {emailResult && (
                            <div
                                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${emailResult.ok
                                    ? "border-green-500/40 bg-green-500/10 text-green-700"
                                    : "border-destructive/40 bg-destructive/10 text-destructive"
                                    }`}
                            >
                                {emailResult.ok ? (
                                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                )}
                                <span className="break-all">{emailResult.msg}</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEmailDialogOpen(false)}
                            disabled={emailSending}
                        >
                            Cerrar
                        </Button>
                        <Button onClick={handleSendTestEmail} disabled={emailSending} className="gap-2">
                            {emailSending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Enviando…
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Enviar
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
