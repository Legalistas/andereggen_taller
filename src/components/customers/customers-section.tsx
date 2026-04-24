"use client"

import { useState } from "react"
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
import {
    Search,
    Plus,
    MoreVertical,
    Eye,
    Edit,
    Trash2,
    Phone,
    Mail,
    MapPin,
    User,
    CreditCard,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"

type Customer = {
    id: number
    name: string
    phone: string
    email: string
    countryId: string
    stateId: string
    city: string
    address: string
    cp: string
    dni: string
    dniType: string
    createdAt: string
    totalServices: number
}

const mockCustomers: Customer[] = [
    {
        id: 1,
        name: "Carlos Mendoza",
        phone: "+54 9 11 2345-6789",
        email: "carlos.mendoza@email.com",
        countryId: "1",
        stateId: "1",
        city: "Buenos Aires",
        address: "Av. Corrientes 1234",
        cp: "1043",
        dni: "12345678",
        dniType: "DNI",
        createdAt: "2024-01-15",
        totalServices: 12,
    },
    {
        id: 2,
        name: "María García",
        phone: "+54 9 11 8765-4321",
        email: "maria.garcia@email.com",
        countryId: "1",
        stateId: "1",
        city: "La Plata",
        address: "Calle 7 No. 456",
        cp: "1900",
        dni: "87654321",
        dniType: "DNI",
        createdAt: "2024-02-20",
        totalServices: 8,
    },
    {
        id: 3,
        name: "Juan Pérez",
        phone: "+54 9 351 123-4567",
        email: "juan.perez@email.com",
        countryId: "1",
        stateId: "2",
        city: "Córdoba",
        address: "Av. Colón 789",
        cp: "5000",
        dni: "23456789",
        dniType: "DNI",
        createdAt: "2024-03-10",
        totalServices: 5,
    },
    {
        id: 4,
        name: "Ana Martínez",
        phone: "+54 9 341 987-6543",
        email: "ana.martinez@email.com",
        countryId: "1",
        stateId: "3",
        city: "Rosario",
        address: "San Martín 321",
        cp: "2000",
        dni: "98765432",
        dniType: "DNI",
        createdAt: "2024-03-25",
        totalServices: 15,
    },
    {
        id: 5,
        name: "Roberto Silva",
        phone: "+54 9 11 5555-6666",
        email: "roberto.silva@email.com",
        countryId: "1",
        stateId: "1",
        city: "Buenos Aires",
        address: "Rivadavia 999",
        cp: "1034",
        dni: "34567890",
        dniType: "DNI",
        createdAt: "2024-04-05",
        totalServices: 3,
    },
]

export default function CustomersSection() {
    const [customers] = useState<Customer[]>(mockCustomers)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCustomers, setSelectedCustomers] = useState<number[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Filtrar customers
    const filteredCustomers = customers.filter((customer) => {
        const searchLower = searchTerm.toLowerCase()
        return (
            customer.name.toLowerCase().includes(searchLower) ||
            customer.email.toLowerCase().includes(searchLower) ||
            customer.phone.includes(searchTerm) ||
            customer.city.toLowerCase().includes(searchLower)
        )
    })

    // Paginación
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex)

    // Selección
    const toggleCustomer = (id: number) => {
        setSelectedCustomers((prev) => (prev.includes(id) ? prev.filter((customerId) => customerId !== id) : [...prev, id]))
    }

    const toggleAllCustomers = () => {
        if (selectedCustomers.length === paginatedCustomers.length) {
            setSelectedCustomers([])
        } else {
            setSelectedCustomers(paginatedCustomers.map((c) => c.id))
        }
    }

    const isAllSelected = selectedCustomers.length === paginatedCustomers.length && paginatedCustomers.length > 0
    const isSomeSelected = selectedCustomers.length > 0 && selectedCustomers.length < paginatedCustomers.length

    const handleItemsPerPageChange = (value: number) => {
        setItemsPerPage(value)
        setCurrentPage(1)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <Breadcrumbs items={[{ label: "Clientes" }]} />
                    <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gestiona la información de tus clientes</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nuevo Cliente
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Agregar Nuevo Cliente</DialogTitle>
                            <DialogDescription>Complete los datos del cliente para agregarlo al sistema</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nombre completo *</Label>
                                <Input id="name" placeholder="Ej: Juan Pérez" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="phone">Teléfono *</Label>
                                    <Input id="phone" placeholder="+54 9 11 1234-5678" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" placeholder="cliente@email.com" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="dniType">Tipo de documento *</Label>
                                    <Select>
                                        <SelectTrigger id="dniType">
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="dni">DNI</SelectItem>
                                            <SelectItem value="pasaporte">Pasaporte</SelectItem>
                                            <SelectItem value="cuil">CUIL</SelectItem>
                                            <SelectItem value="cuit">CUIT</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="dni">Número de documento *</Label>
                                    <Input id="dni" placeholder="12345678" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="country">País *</Label>
                                    <Select>
                                        <SelectTrigger id="country">
                                            <SelectValue placeholder="Seleccionar país" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Argentina</SelectItem>
                                            <SelectItem value="2">Chile</SelectItem>
                                            <SelectItem value="3">Uruguay</SelectItem>
                                            <SelectItem value="4">Paraguay</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="state">Provincia/Estado *</Label>
                                    <Select>
                                        <SelectTrigger id="state">
                                            <SelectValue placeholder="Seleccionar provincia" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Buenos Aires</SelectItem>
                                            <SelectItem value="2">Córdoba</SelectItem>
                                            <SelectItem value="3">Santa Fe</SelectItem>
                                            <SelectItem value="4">Mendoza</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="city">Ciudad *</Label>
                                    <Input id="city" placeholder="Ej: Buenos Aires" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="cp">Código Postal *</Label>
                                    <Input id="cp" placeholder="1234" />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="address">Dirección *</Label>
                                <Input id="address" placeholder="Calle, número, piso, depto" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={() => setIsDialogOpen(false)}>Guardar Cliente</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Total Clientes</p>
                            <p className="text-2xl font-bold text-foreground">{customers.length}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-500" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Nuevos (mes)</p>
                            <p className="text-2xl font-bold text-foreground">3</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <Plus className="h-5 w-5 text-green-500" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Servicios Total</p>
                            <p className="text-2xl font-bold text-foreground">43</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-purple-500" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Promedio Servicios</p>
                            <p className="text-2xl font-bold text-foreground">8.6</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <MapPin className="h-5 w-5 text-orange-500" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Search and Filters */}
            <Card className="p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre, email, ciudad..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex gap-2">
                        {selectedCustomers.length > 0 ? (
                            <>
                                <span className="text-sm text-muted-foreground self-center">
                                    {selectedCustomers.length} seleccionado{selectedCustomers.length > 1 ? "s" : ""}
                                </span>
                                <Button variant="outline" size="sm">
                                    Exportar
                                </Button>
                                <Button variant="outline" size="sm" className="text-destructive bg-transparent">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" size="sm">
                                    Filtrar
                                </Button>
                                <Button variant="outline" size="sm">
                                    Ordenar
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </Card>

            {/* Clients Table */}
            <Card className="py-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={toggleAllCustomers}
                                    aria-label="Seleccionar todos"
                                    className={isSomeSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                />
                            </TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Ubicación</TableHead>
                            <TableHead>Servicios</TableHead>
                            <TableHead>Registrado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedCustomers.map((customer) => (
                            <TableRow key={customer.id}>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedCustomers.includes(customer.id)}
                                        onCheckedChange={() => toggleCustomer(customer.id)}
                                        aria-label={`Seleccionar ${customer.name}`}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <User className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="font-medium text-foreground">{customer.name}</div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Phone className="h-3 w-3" />
                                            {customer.phone}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Mail className="h-3 w-3" />
                                            {customer.email}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium">{customer.dniType}</span>
                                        <span className="text-xs text-muted-foreground">{customer.dni}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1 text-sm">
                                        <MapPin className="h-3 w-3 text-muted-foreground" />
                                        <span>{customer.city}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">CP: {customer.cp}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <span className="font-medium text-foreground">{customer.totalServices}</span>
                                        <span className="text-xs text-muted-foreground">servicios</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className="text-sm text-muted-foreground">{customer.createdAt}</span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem className="gap-2">
                                                <Eye className="h-4 w-4" />
                                                Ver perfil
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="gap-2">
                                                <Edit className="h-4 w-4" />
                                                Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="gap-2">
                                                <Phone className="h-4 w-4" />
                                                Contactar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="gap-2 text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                                Eliminar
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t px-4 py-4">
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                            Mostrando {startIndex + 1} a {Math.min(endIndex, filteredCustomers.length)} de {filteredCustomers.length}{" "}
                            clientes
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
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
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
            </Card>
        </div>
    )
}
