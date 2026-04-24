"use client"

import { useState } from "react"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Search,
    MoreVertical,
    Eye,
    Edit,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
    Calendar,
    CheckCircle2,
    Wrench,
    Paintbrush,
    Shield,
    Package,
    User,
    Save,
    X,
    Car, Phone,
} from "lucide-react"

type ProductionStatus = "assignTurn" | "received" | "bodywork" | "painting" | "quality" | "toDeliver" | "finished"

interface VehicleJob {
    id: string
    customerName: string
    customerPhone: string
    customerEmail: string
    vehicle: string
    plate: string
    status: ProductionStatus
    assignedTechnician?: string
    dateReceived?: string
    estimatedDelivery?: string
    notes?: string
    progress?: number
}

const statusConfig: Record<ProductionStatus, { label: string; color: string; icon: any }> = {
    assignTurn: { label: "Para asignar turno", color: "bg-gray-100 text-gray-700", icon: Calendar },
    received: { label: "Recibido", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
    bodywork: { label: "Chapa", color: "bg-orange-100 text-orange-700", icon: Wrench },
    painting: { label: "Pintura", color: "bg-purple-100 text-purple-700", icon: Paintbrush },
    quality: { label: "Calidad", color: "bg-cyan-100 text-cyan-700", icon: Shield },
    toDeliver: { label: "Para entregar", color: "bg-green-100 text-green-700", icon: Package },
    finished: { label: "Finalizado", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
}

const mockJobs: VehicleJob[] = [
    {
        id: "1",
        customerName: "Carlos Méndez",
        customerPhone: "+54 11 2345-6789",
        customerEmail: "carlos@email.com",
        vehicle: "Toyota Corolla 2019",
        plate: "ABC 123",
        status: "assignTurn",
        estimatedDelivery: "2024-02-01",
    },
    {
        id: "2",
        customerName: "María González",
        customerPhone: "+54 11 2345-6790",
        customerEmail: "maria@email.com",
        vehicle: "Honda Civic 2020",
        plate: "DEF 456",
        status: "received",
        assignedTechnician: "Juan Pérez",
        dateReceived: "2024-01-15",
        estimatedDelivery: "2024-01-25",
    },
    {
        id: "3",
        customerName: "Roberto Silva",
        customerPhone: "+54 11 2345-6791",
        customerEmail: "roberto@email.com",
        vehicle: "Ford F-150 2018",
        plate: "GHI 789",
        status: "bodywork",
        assignedTechnician: "Pedro López",
        dateReceived: "2024-01-10",
        estimatedDelivery: "2024-01-30",
        progress: 45,
        notes: "Reparación de puerta trasera y guardabarro",
    },
    {
        id: "4",
        customerName: "Ana Martínez",
        customerPhone: "+54 11 2345-6792",
        customerEmail: "ana@email.com",
        vehicle: "Mazda 3 2021",
        plate: "JKL 012",
        status: "painting",
        assignedTechnician: "Carlos Ruiz",
        dateReceived: "2024-01-08",
        estimatedDelivery: "2024-01-22",
        progress: 70,
    },
    {
        id: "5",
        customerName: "Luis Fernández",
        customerPhone: "+54 11 2345-6793",
        customerEmail: "luis@email.com",
        vehicle: "Chevrolet Cruze 2017",
        plate: "MNO 345",
        status: "quality",
        assignedTechnician: "Miguel Torres",
        dateReceived: "2024-01-05",
        estimatedDelivery: "2024-01-20",
        progress: 95,
    },
    {
        id: "6",
        customerName: "Patricia López",
        customerPhone: "+54 11 2345-6794",
        customerEmail: "patricia@email.com",
        vehicle: "Nissan Sentra 2020",
        plate: "PQR 678",
        status: "toDeliver",
        assignedTechnician: "Juan Pérez",
        dateReceived: "2024-01-02",
        estimatedDelivery: "2024-01-18",
        progress: 100,
        notes: "Cliente notificado - Documentos listos",
    },
]

const mockMechanics = [
    { id: "1", name: "Juan Pérez", assignedTasks: 3 },
    { id: "2", name: "Pedro López", assignedTasks: 2 },
    { id: "3", name: "Carlos Ruiz", assignedTasks: 5 },
    { id: "4", name: "Miguel Torres", assignedTasks: 1 },
]

export default function ProductionList() {
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [selectedJobs, setSelectedJobs] = useState<string[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [selectedJob, setSelectedJob] = useState<VehicleJob | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editedJob, setEditedJob] = useState<VehicleJob | null>(null)

    const filteredJobs = mockJobs.filter((job) => {
        const matchesSearch =
            job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.plate.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === "all" || job.status === statusFilter
        return matchesSearch && matchesStatus
    })

    const totalPages = Math.ceil(filteredJobs.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentJobs = filteredJobs.slice(startIndex, endIndex)

    const toggleSelectAll = () => {
        if (selectedJobs.length === currentJobs.length) {
            setSelectedJobs([])
        } else {
            setSelectedJobs(currentJobs.map((job) => job.id))
        }
    }

    const toggleSelectJob = (jobId: string) => {
        setSelectedJobs((prev) => (prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]))
    }

    const handleItemsPerPageChange = (value: number) => {
        setItemsPerPage(value)
        setCurrentPage(1)
    }

    const openJobDetail = (job: VehicleJob) => {
        setSelectedJob(job)
        setEditedJob({ ...job })
        setIsDetailOpen(true)
        setIsEditing(false)
    }

    const handleSaveChanges = () => {
        if (editedJob) {
            // Aquí se guardarían los cambios en la base de datos
            console.log("[v0] Guardando cambios:", editedJob)
            setSelectedJob(editedJob)
            setIsEditing(false)
        }
    }

    const handleCancelEdit = () => {
        setEditedJob(selectedJob ? { ...selectedJob } : null)
        setIsEditing(false)
    }

    return (
        <div className="space-y-6">
            <div>
                <Breadcrumbs items={[{ label: "Producción", href: "/produccion" }, { label: "Lista completa" }]} />
                <h1 className="text-3xl font-bold text-foreground">Producción — Lista completa</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Todos los trabajos en proceso organizados en lista.
                </p>
            </div>

            {/* Filtros y búsqueda */}
            <Card className="p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por cliente, vehículo o patente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex gap-2">
                        {selectedJobs.length > 0 ? (
                            <>
                                <span className="text-sm text-muted-foreground self-center">
                                    {selectedJobs.length} seleccionado{selectedJobs.length > 1 ? "s" : ""}
                                </span>
                                <Button variant="outline" size="sm">
                                    Cambiar estado
                                </Button>
                                <Button variant="outline" size="sm">
                                    Notificar clientes
                                </Button>
                                <Button variant="outline" size="sm">
                                    Exportar
                                </Button>
                            </>
                        ) : (
                            <>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-50">
                                        <SelectValue placeholder="Filtrar por estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los estados</SelectItem>
                                        <SelectItem value="assignTurn">Para asignar turno</SelectItem>
                                        <SelectItem value="received">Recibido</SelectItem>
                                        <SelectItem value="bodywork">Chapa</SelectItem>
                                        <SelectItem value="painting">Pintura</SelectItem>
                                        <SelectItem value="quality">Calidad</SelectItem>
                                        <SelectItem value="toDeliver">Para entregar</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="sm">
                                    Ordenar
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </Card>

            {/* Tabla */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={selectedJobs.length === currentJobs.length && currentJobs.length > 0}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label="Seleccionar todos"
                                    className={selectedJobs.length > 0 && selectedJobs.length < currentJobs.length ? "data-[state=checked]:bg-primary/50" : ""}
                                />
                            </TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Vehículo</TableHead>
                            <TableHead>Patente</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Técnico</TableHead>
                            <TableHead>Progreso</TableHead>
                            <TableHead>Entrega Est.</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentJobs.map((job) => {
                            const StatusIcon = statusConfig[job.status].icon
                            return (
                                <TableRow key={job.id}>
                                    <TableCell>
                                        <Checkbox checked={selectedJobs.includes(job.id)} onCheckedChange={() => toggleSelectJob(job.id)} />
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium text-foreground">{job.customerName}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Phone className="h-3 w-3" />
                                                {job.customerPhone}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Car className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm">{job.vehicle}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{job.plate}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`gap-1 ${statusConfig[job.status].color}`}>
                                            <StatusIcon className="h-3 w-3" />
                                            {statusConfig[job.status].label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {job.assignedTechnician ? (
                                            <div className="flex items-center gap-2 text-sm">
                                                <User className="h-3 w-3 text-muted-foreground" />
                                                {job.assignedTechnician}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Sin asignar</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {job.progress !== undefined ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary transition-all" style={{ width: `${job.progress}%` }} />
                                                </div>
                                                <span className="text-xs font-medium">{job.progress}%</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {job.estimatedDelivery ? (
                                            <div className="text-sm">{job.estimatedDelivery}</div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openJobDetail(job)} className="gap-2">
                                                    <Eye className="h-4 w-4" />
                                                    Ver detalles
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="gap-2">
                                                    <Edit className="h-4 w-4" />
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="gap-2">
                                                    <MessageSquare className="h-4 w-4" />
                                                    Notificar cliente
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>

                {/* Paginación */}
                <div className="border-t px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-muted-foreground">
                                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredJobs.length)} de {filteredJobs.length} trabajos
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
                                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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
                                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                            >
                                Siguiente
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>



            {/* Modal de detalles */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle>Detalles del Trabajo</DialogTitle>
                            {!isEditing ? (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                                        <X className="h-4 w-4 mr-2" />
                                        Cancelar
                                    </Button>
                                    <Button size="sm" onClick={handleSaveChanges} className="bg-[#003b73] hover:bg-[#002850]">
                                        <Save className="h-4 w-4 mr-2" />
                                        Guardar cambios
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogHeader>
                    {selectedJob && editedJob && (
                        <div className="space-y-6">
                            {/* Información del cliente y vehículo */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Cliente:</span>
                                    <div className="font-medium">{selectedJob.customerName}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Teléfono:</span>
                                    <div className="font-medium">{selectedJob.customerPhone}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Vehículo:</span>
                                    <div className="font-medium">{selectedJob.vehicle}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Patente:</span>
                                    <div className="font-medium">{selectedJob.plate}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Estado:</span>
                                    <Badge className={`${statusConfig[selectedJob.status].color} mt-1`}>
                                        {statusConfig[selectedJob.status].label}
                                    </Badge>
                                </div>
                                {selectedJob.dateReceived && (
                                    <div>
                                        <span className="text-muted-foreground">Fecha de recepción:</span>
                                        <div className="font-medium">{selectedJob.dateReceived}</div>
                                    </div>
                                )}
                            </div>

                            {(selectedJob.status === "assignTurn" || isEditing) && (
                                <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-[#003b73]" />
                                        Asignación de Turno
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="turnDate">Fecha de turno</Label>
                                            <Input
                                                id="turnDate"
                                                type="date"
                                                value={editedJob.estimatedDelivery || ""}
                                                onChange={(e) => setEditedJob({ ...editedJob, estimatedDelivery: e.target.value })}
                                                disabled={!isEditing}
                                                className="bg-background"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="mechanic">Mecánico asignado</Label>
                                            <Select
                                                value={editedJob.assignedTechnician || ""}
                                                onValueChange={(value) => setEditedJob({ ...editedJob, assignedTechnician: value })}
                                                disabled={!isEditing}
                                            >
                                                <SelectTrigger id="mechanic" className="bg-background">
                                                    <SelectValue placeholder="Seleccionar mecánico" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {mockMechanics.map((mechanic) => (
                                                        <SelectItem key={mechanic.id} value={mechanic.name}>
                                                            <div className="flex items-center justify-between w-full">
                                                                <span>{mechanic.name}</span>
                                                                <span className="text-xs text-muted-foreground ml-2">
                                                                    ({mechanic.assignedTasks} tareas)
                                                                </span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="notes">Observaciones</Label>
                                {isEditing ? (
                                    <Textarea
                                        id="notes"
                                        value={editedJob.notes || ""}
                                        onChange={(e) => setEditedJob({ ...editedJob, notes: e.target.value })}
                                        placeholder="Agregar observaciones sobre el trabajo..."
                                        rows={4}
                                        className="bg-background"
                                    />
                                ) : (
                                    <div className="p-3 bg-muted/50 rounded-lg text-sm min-h-25">
                                        {selectedJob.notes || "Sin observaciones"}
                                    </div>
                                )}
                            </div>

                            {/* Información adicional */}
                            {selectedJob.progress !== undefined && (
                                <div className="space-y-2">
                                    <Label>Progreso del trabajo</Label>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[#003b73] transition-all"
                                                style={{ width: `${selectedJob.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium w-12 text-right">{selectedJob.progress}%</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
