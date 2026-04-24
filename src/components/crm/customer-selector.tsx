"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown, Loader2, Mail, Phone, User } from "lucide-react"
import { cn } from "@/lib/utils"

export type CustomerVehicleLite = {
    id: string
    brand: string
    model: string
    year: string
    domain: string
    secure: string
}

export type Customer = {
    id: string
    name: string
    phone: string
    email: string
    dni: string | null
    dniType: string | null
    vehicles?: CustomerVehicleLite[]
}

interface CustomerSelectorProps {
    selectedCustomer: Customer | null
    onCustomerSelect: (customer: Customer | null) => void
}

export default function CustomerSelector({ selectedCustomer, onCustomerSelect }: CustomerSelectorProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [customers, setCustomers] = useState<Customer[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Fetch con debounce
    useEffect(() => {
        if (!open) return
        const controller = new AbortController()
        const timeout = setTimeout(async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(`/api/customers?search=${encodeURIComponent(search)}&limit=30`, {
                    signal: controller.signal,
                })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data = (await res.json()) as { customers: Customer[] }
                setCustomers(data.customers)
            } catch (e) {
                if ((e as Error).name !== "AbortError") {
                    setError(e instanceof Error ? e.message : "Error")
                }
            } finally {
                setLoading(false)
            }
        }, 200)
        return () => {
            controller.abort()
            clearTimeout(timeout)
        }
    }, [search, open])

    return (
        <div className="grid gap-2">
            <Label>Cliente *</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="justify-between bg-transparent"
                        type="button"
                    >
                        {selectedCustomer ? (
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {selectedCustomer.name}
                            </div>
                        ) : (
                            "Buscar cliente..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[28rem] p-0">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Buscar por nombre, email o DNI..."
                            value={search}
                            onValueChange={setSearch}
                        />
                        <CommandList>
                            {loading && (
                                <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                                </div>
                            )}
                            {!loading && error && (
                                <div className="py-6 text-center text-sm text-destructive">{error}</div>
                            )}
                            {!loading && !error && customers.length === 0 && (
                                <CommandEmpty>
                                    <div className="py-6 text-center">
                                        <p className="text-sm text-muted-foreground mb-2">Cliente no encontrado</p>
                                        <p className="text-xs text-muted-foreground">
                                            Creá el cliente desde la sección <b>Clientes</b> y volvé.
                                        </p>
                                    </div>
                                </CommandEmpty>
                            )}
                            {!loading && !error && customers.length > 0 && (
                                <CommandGroup>
                                    {customers.map((customer) => (
                                        <CommandItem
                                            key={customer.id}
                                            value={customer.id}
                                            onSelect={() => {
                                                onCustomerSelect(customer)
                                                setOpen(false)
                                            }}
                                            className="cursor-pointer"
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0",
                                                )}
                                            />
                                            <div className="flex flex-col">
                                                <span className="font-medium">{customer.name}</span>
                                                <span className="text-xs opacity-70">
                                                    {customer.dniType && customer.dni
                                                        ? `${customer.dniType}: ${customer.dni} | `
                                                        : ""}
                                                    {customer.phone}
                                                </span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {selectedCustomer && (
                <div className="text-xs text-muted-foreground flex flex-col gap-0.5 mt-1">
                    <span>
                        <Mail className="inline-block mr-1 h-4 w-4" />
                        {selectedCustomer.email}
                    </span>
                    <span>
                        <Phone className="inline-block mr-1 h-4 w-4" />
                        {selectedCustomer.phone}
                    </span>
                </div>
            )}
        </div>
    )
}
