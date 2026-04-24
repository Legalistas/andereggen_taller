"use client"

import { useState } from "react"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
    Calendar,
    Clock,
    User,
    Car,
    MessageSquare,
    ImageIcon,
    CheckCircle2,
    AlertCircle,
    Package,
    Wrench,
    Paintbrush,
    Shield,
    Edit,
    Save,
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
    photos?: string[]
    progress?: number
}

const statusConfig: Record<ProductionStatus, { label: string; color: string; icon: any; bgColor: string }> = {
    assignTurn: { label: "Para asignar turno", color: "text-gray-600", icon: Calendar, bgColor: "bg-gray-50" },
    received: { label: "Recibido", color: "text-blue-600", icon: CheckCircle2, bgColor: "bg-blue-50" },
    bodywork: { label: "Chapa", color: "text-orange-600", icon: Wrench, bgColor: "bg-orange-50" },
    painting: { label: "Pintura", color: "text-purple-600", icon: Paintbrush, bgColor: "bg-purple-50" },
    quality: { label: "Calidad", color: "text-cyan-600", icon: Shield, bgColor: "bg-cyan-50" },
    toDeliver: { label: "Para entregar", color: "text-green-600", icon: Package, bgColor: "bg-green-50" },
    finished: { label: "Finalizado", color: "text-emerald-600", icon: CheckCircle2, bgColor: "bg-emerald-50" },
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
    { id: "3", name: "Juan Mecánico", assignedTasks: 5 },
    { id: "6", name: "Laura Mecánica", assignedTasks: 0 },
    { id: "7", name: "Pedro López", assignedTasks: 3 },
    { id: "8", name: "Carlos Ruiz", assignedTasks: 4 },
]

export default function ProductionBoard() {
    const [selectedJob, setSelectedJob] = useState<VehicleJob | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editData, setEditData] = useState<{
        appointmentDate?: string
        assignedTechnician?: string
        notes?: string
    }>({})

    const getJobsByStatus = (status: ProductionStatus) => {
        return mockJobs.filter((job) => job.status === status)
    }

    const openJobDetail = (job: VehicleJob) => {
        setSelectedJob(job)
        setIsDetailOpen(true)
        setIsEditing(false)
        setEditData({
            appointmentDate: job.estimatedDelivery,
            assignedTechnician: job.assignedTechnician,
            notes: job.notes,
        })
    }

    const handleEdit = () => {
        setIsEditing(true)
    }

    const handleSave = () => {
        console.log("[v0] Guardando cambios:", editData)
        setIsEditing(false)
    }

    const columns: ProductionStatus[] = ["assignTurn", "received", "bodywork", "painting", "quality", "toDeliver"]

    return (
        <div className="space-y-4">
            <div>
                <Breadcrumbs items={[{ label: "Producción" }]} />
                <h1 className="text-3xl font-bold">Producción</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Seguimiento del flujo de reparación de vehículos
                </p>
            </div>

            {/* Header con estadísticas rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Car className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{mockJobs.filter((j) => j.status !== "finished").length}</div>
                            <div className="text-sm text-muted-foreground">En proceso</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                            <Wrench className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{getJobsByStatus("bodywork").length}</div>
                            <div className="text-sm text-muted-foreground">En chapa</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Paintbrush className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{getJobsByStatus("painting").length}</div>
                            <div className="text-sm text-muted-foreground">En pintura</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <Package className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{getJobsByStatus("toDeliver").length}</div>
                            <div className="text-sm text-muted-foreground">Para entregar</div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Tablero Kanban */}
            <div className="flex gap-4 overflow-x-auto pb-4">
                {columns.map((status) => {
                    const jobs = getJobsByStatus(status)
                    const StatusIcon = statusConfig[status].icon
                    return (
                        <div key={status} className="shrink-0 w-80">
                            <Card className={`${statusConfig[status].bgColor} border-2`}>
                                <div className="p-4 border-b">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <StatusIcon className={`h-5 w-5 ${statusConfig[status].color}`} />
                                            <h3 className="font-semibold text-sm">{statusConfig[status].label}</h3>
                                        </div>
                                        <Badge variant="secondary" className="rounded-full">
                                            {jobs.length}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="p-2 space-y-2 max-h-150 overflow-y-auto">
                                    {jobs.map((job) => (
                                        <Card
                                            key={job.id}
                                            className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                                            onClick={() => openJobDetail(job)}
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="font-medium text-sm">{job.customerName}</div>
                                                        <div className="text-xs text-muted-foreground">{job.vehicle}</div>
                                                    </div>
                                                    <Badge variant="outline" className="text-xs">
                                                        {job.plate}
                                                    </Badge>
                                                </div>

                                                {job.assignedTechnician && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <User className="h-3 w-3" />
                                                        {job.assignedTechnician}
                                                    </div>
                                                )}

                                                {job.progress !== undefined && (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-muted-foreground">Progreso</span>
                                                            <span className="font-medium">{job.progress}%</span>
                                                        </div>
                                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary transition-all" style={{ width: `${job.progress}%` }} />
                                                        </div>
                                                    </div>
                                                )}

                                                {job.estimatedDelivery && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        Entrega: {job.estimatedDelivery}
                                                    </div>
                                                )}

                                                {job.notes && (
                                                    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                                        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                                        <span className="line-clamp-2">{job.notes}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )
                })}
            </div>

            {/* Modal de detalles */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Editar Trabajo" : "Detalles del Trabajo"}</DialogTitle>
                    </DialogHeader>
                    {selectedJob && (
                        <div className="space-y-6">
                            {/* Cliente */}
                            <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Información del Cliente
                                </h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Nombre:</span>
                                        <span className="font-medium">{selectedJob.customerName}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Teléfono:</span>
                                        <span className="font-medium">{selectedJob.customerPhone}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Email:</span>
                                        <span className="font-medium">{selectedJob.customerEmail}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Vehículo */}
                            <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <Car className="h-4 w-4" />
                                    Vehículo
                                </h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Modelo:</span>
                                        <span className="font-medium">{selectedJob.vehicle}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Patente:</span>
                                        <Badge variant="outline">{selectedJob.plate}</Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Estado */}
                            <div>
                                <h3 className="font-semibold mb-3">Estado y Progreso</h3>
                                <div className="space-y-3">
                                    <Badge className="gap-2">
                                        {(() => {
                                            const StatusIcon = statusConfig[selectedJob.status].icon
                                            return <StatusIcon className="h-3 w-3" />
                                        })()}
                                        {statusConfig[selectedJob.status].label}
                                    </Badge>
                                    {selectedJob.progress !== undefined && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Progreso del trabajo</span>
                                                <span className="font-medium">{selectedJob.progress}%</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary transition-all"
                                                    style={{ width: `${selectedJob.progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {(selectedJob.status === "assignTurn" || isEditing) && (
                                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                                    <h3 className="font-semibold">Asignación de Turno</h3>

                                    <div className="space-y-2">
                                        <Label htmlFor="appointmentDate">Fecha de turno</Label>
                                        {isEditing ? (
                                            <Input
                                                id="appointmentDate"
                                                type="date"
                                                value={editData.appointmentDate || ""}
                                                onChange={(e) => setEditData({ ...editData, appointmentDate: e.target.value })}
                                            />
                                        ) : (
                                            <div className="text-sm font-medium">{selectedJob.estimatedDelivery || "No asignada"}</div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="mechanic">Mecánico asignado</Label>
                                        {isEditing ? (
                                            <Select
                                                value={editData.assignedTechnician || ""}
                                                onValueChange={(value) => setEditData({ ...editData, assignedTechnician: value })}
                                            >
                                                <SelectTrigger id="mechanic">
                                                    <SelectValue placeholder="Seleccionar mecánico..." />
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
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                {selectedJob.assignedTechnician ? (
                                                    <>
                                                        <Avatar>
                                                            <AvatarFallback className="bg-primary/10 text-primary">
                                                                {selectedJob.assignedTechnician
                                                                    .split(" ")
                                                                    .map((n) => n[0])
                                                                    .join("")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{selectedJob.assignedTechnician}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">Sin asignar</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Técnico asignado - Solo para otros estados */}
                            {selectedJob.status !== "assignTurn" && selectedJob.assignedTechnician && !isEditing && (
                                <div>
                                    <h3 className="font-semibold mb-3">Técnico Asignado</h3>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarFallback className="bg-primary/10 text-primary">
                                                {selectedJob.assignedTechnician
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{selectedJob.assignedTechnician}</span>
                                    </div>
                                </div>
                            )}

                            {/* Fechas */}
                            <div>
                                <h3 className="font-semibold mb-3">Fechas</h3>
                                <div className="space-y-2 text-sm">
                                    {selectedJob.dateReceived && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Recibido:</span>
                                            <span className="font-medium">{selectedJob.dateReceived}</span>
                                        </div>
                                    )}
                                    {selectedJob.estimatedDelivery && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Entrega estimada:</span>
                                            <span className="font-medium">{selectedJob.estimatedDelivery}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Observaciones */}
                            <div>
                                <h3 className="font-semibold mb-3">Observaciones</h3>
                                {isEditing ? (
                                    <Textarea
                                        value={editData.notes || ""}
                                        onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                                        placeholder="Agregar observaciones..."
                                        rows={4}
                                    />
                                ) : (
                                    <div className="bg-muted/50 p-3 rounded-lg text-sm">{selectedJob.notes || "Sin observaciones"}</div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-4 border-t">
                                {isEditing ? (
                                    <>
                                        <Button onClick={handleSave} className="gap-2 bg-[#003b73] hover:bg-[#003b73]/90">
                                            <Save className="h-4 w-4" />
                                            Guardar cambios
                                        </Button>
                                        <Button variant="outline" onClick={() => setIsEditing(false)} className="gap-2">
                                            Cancelar
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button variant="outline" onClick={handleEdit} className="gap-2 bg-transparent">
                                            <Edit className="h-4 w-4" />
                                            Editar
                                        </Button>
                                        <Button variant="outline" className="gap-2 bg-transparent">
                                            <MessageSquare className="h-4 w-4" />
                                            Notificar Cliente
                                        </Button>
                                        <Button variant="outline" className="gap-2 bg-transparent">
                                            <ImageIcon className="h-4 w-4" />
                                            Agregar Fotos
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
