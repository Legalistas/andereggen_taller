"use client"

import { useState } from "react"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Eye, ChevronLeft, ChevronRight, Calendar, DollarSign, CheckCircle2, XCircle, Phone, Car } from "lucide-react"

interface FinishedJob {
    id: string
    customerName: string
    customerPhone: string
    vehicle: string
    plate: string
    dateReceived: string
    dateDelivered: string
    assignedTechnician: string
    totalCost: number
    status: "completed" | "cancelled"
    notes?: string
    duration: number // días
}

const mockHistory: FinishedJob[] = [
    {
        id: "1",
        customerName: "Jorge Ramírez",
        customerPhone: "+54 11 2345-6800",
        vehicle: "Volkswagen Gol 2018",
        plate: "STU 901",
        dateReceived: "2023-12-15",
        dateDelivered: "2024-01-05",
        assignedTechnician: "Juan Pérez",
        totalCost: 125000,
        status: "completed",
        duration: 21,
        notes: "Reparación completa de chapa y pintura sector lateral",
    },
    {
        id: "2",
        customerName: "Silvia Torres",
        customerPhone: "+54 11 2345-6801",
        vehicle: "Peugeot 208 2020",
        plate: "VWX 234",
        dateReceived: "2023-12-20",
        dateDelivered: "2024-01-08",
        assignedTechnician: "Pedro López",
        totalCost: 95000,
        status: "completed",
        duration: 19,
    },
    {
        id: "3",
        customerName: "Martín Díaz",
        customerPhone: "+54 11 2345-6802",
        vehicle: "Renault Sandero 2019",
        plate: "YZA 567",
        dateReceived: "2024-01-02",
        dateDelivered: "2024-01-15",
        assignedTechnician: "Carlos Ruiz",
        totalCost: 78000,
        status: "completed",
        duration: 13,
    },
    {
        id: "4",
        customerName: "Carolina Vega",
        customerPhone: "+54 11 2345-6803",
        vehicle: "Fiat Cronos 2021",
        plate: "BCD 890",
        dateReceived: "2023-12-28",
        dateDelivered: "2024-01-10",
        assignedTechnician: "Miguel Torres",
        totalCost: 142000,
        status: "completed",
        duration: 13,
        notes: "Reparación integral de paragolpes y capot",
    },
    {
        id: "5",
        customerName: "Eduardo Morales",
        customerPhone: "+54 11 2345-6804",
        vehicle: "Chevrolet Onix 2020",
        plate: "EFG 123",
        dateReceived: "2024-01-03",
        dateDelivered: "2024-01-05",
        assignedTechnician: "Juan Pérez",
        totalCost: 0,
        status: "cancelled",
        duration: 2,
        notes: "Cliente canceló el servicio - No autoriza presupuesto",
    },
]

export default function ProductionHistory() {
    const [searchTerm, setSearchTerm] = useState("")
    const [monthFilter, setMonthFilter] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [selectedJob, setSelectedJob] = useState<FinishedJob | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    const filteredJobs = mockHistory.filter((job) => {
        const matchesSearch =
            job.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.plate.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesMonth = monthFilter === "all" || job.dateDelivered.startsWith(monthFilter)
        const matchesStatus = statusFilter === "all" || job.status === statusFilter
        return matchesSearch && matchesMonth && matchesStatus
    })

    const totalPages = Math.ceil(filteredJobs.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentJobs = filteredJobs.slice(startIndex, endIndex)

    const totalRevenue = filteredJobs.filter((j) => j.status === "completed").reduce((sum, job) => sum + job.totalCost, 0)

    const avgDuration =
        filteredJobs.filter((j) => j.status === "completed").reduce((sum, job) => sum + job.duration, 0) /
        filteredJobs.filter((j) => j.status === "completed").length || 0

    const openJobDetail = (job: FinishedJob) => {
        setSelectedJob(job)
        setIsDetailOpen(true)
    }

    return (
        <div className="space-y-6">
            <div>
                <Breadcrumbs items={[{ label: "Producción", href: "/produccion" }, { label: "Histórico" }]} />
                <h1 className="text-3xl font-bold text-foreground">Producción — Histórico</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Trabajos finalizados y estadísticas históricas.
                </p>
            </div>

            {/* Estadísticas del histórico */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{filteredJobs.filter((j) => j.status === "completed").length}</div>
                            <div className="text-sm text-muted-foreground">Completados</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <XCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{filteredJobs.filter((j) => j.status === "cancelled").length}</div>
                            <div className="text-sm text-muted-foreground">Cancelados</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                            <div className="text-sm text-muted-foreground">Ingresos totales</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{Math.round(avgDuration)} días</div>
                            <div className="text-sm text-muted-foreground">Duración promedio</div>
                        </div>
                    </div>
                </Card>
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
                        <Select value={monthFilter} onValueChange={setMonthFilter}>
                            <SelectTrigger className="w-45">
                                <SelectValue placeholder="Filtrar por mes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los meses</SelectItem>
                                <SelectItem value="2024-01">Enero 2024</SelectItem>
                                <SelectItem value="2023-12">Diciembre 2023</SelectItem>
                                <SelectItem value="2023-11">Noviembre 2023</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-45">
                                <SelectValue placeholder="Filtrar por estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="completed">Completados</SelectItem>
                                <SelectItem value="cancelled">Cancelados</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm">
                            Exportar
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Tabla de histórico */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Vehículo</TableHead>
                            <TableHead>Patente</TableHead>
                            <TableHead>Fecha Recibido</TableHead>
                            <TableHead>Fecha Entregado</TableHead>
                            <TableHead>Duración</TableHead>
                            <TableHead>Técnico</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentJobs.map((job) => (
                            <TableRow key={job.id}>
                                <TableCell>
                                    <div className="font-medium text-foreground">{job.customerName}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Phone className="h-3 w-3" />
                                            {job.customerPhone}</div>
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
                                    <span className="text-sm text-muted-foreground">{job.dateReceived}</span>
                                </TableCell>
                                <TableCell>
                                    <span className="text-sm text-muted-foreground">{job.dateDelivered}</span>
                                </TableCell>
                                <TableCell>
                                    <span className="text-sm text-muted-foreground">{job.duration} días</span>
                                </TableCell>
                                <TableCell>
                                    <span className="text-sm">{job.assignedTechnician}</span>
                                </TableCell>
                                <TableCell>
                                    <span className="font-medium text-foreground">
                                        {job.status === "completed" ? `$${job.totalCost.toLocaleString()}` : "-"}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {job.status === "completed" ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 gap-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Completado
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-red-100 text-red-700 gap-1">
                                            <XCircle className="h-3 w-3" />
                                            Cancelado
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openJobDetail(job)}>
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

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
                                    <DropdownMenuItem onClick={() => { setItemsPerPage(10); setCurrentPage(1); }}>10</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setItemsPerPage(25); setCurrentPage(1); }}>25</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setItemsPerPage(50); setCurrentPage(1); }}>50</DropdownMenuItem>
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

            {/* Modal de detalles */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detalles del Trabajo Finalizado</DialogTitle>
                    </DialogHeader>
                    {selectedJob && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Cliente:</span>
                                    <div className="font-medium">{selectedJob.customerName}</div>
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
                                    <span className="text-muted-foreground">Técnico asignado:</span>
                                    <div className="font-medium">{selectedJob.assignedTechnician}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Fecha recibido:</span>
                                    <div className="font-medium">{selectedJob.dateReceived}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Fecha entregado:</span>
                                    <div className="font-medium">{selectedJob.dateDelivered}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Duración total:</span>
                                    <div className="font-medium">{selectedJob.duration} días</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Total facturado:</span>
                                    <div className="font-medium text-lg">
                                        {selectedJob.status === "completed" ? `$${selectedJob.totalCost.toLocaleString()}` : "-"}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground">Estado:</span>
                                <div className="mt-1">
                                    {selectedJob.status === "completed" ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 gap-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Completado exitosamente
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-red-100 text-red-700 gap-1">
                                            <XCircle className="h-3 w-3" />
                                            Cancelado
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            {selectedJob.notes && (
                                <div>
                                    <span className="text-sm text-muted-foreground">Observaciones:</span>
                                    <div className="mt-1 p-3 bg-muted/50 rounded-lg text-sm">{selectedJob.notes}</div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
