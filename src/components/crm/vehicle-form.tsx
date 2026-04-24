"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Car, Check, ChevronsUpDown, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

type InsuranceOption = { id: string; name: string }

const brands = [
    "Toyota",
    "Honda",
    "Ford",
    "Chevrolet",
    "Volkswagen",
    "Nissan",
    "Mazda",
    "Hyundai",
    "Kia",
    "Mercedes-Benz",
    "BMW",
    "Audi",
    "Renault",
    "Peugeot",
    "Fiat",
]

const modelsByBrand: Record<string, string[]> = {
    Toyota: ["Corolla", "Camry", "RAV4", "Hilux", "Etios"],
    Honda: ["Civic", "Accord", "CR-V", "HR-V", "Fit"],
    Ford: ["Focus", "Fiesta", "Ranger", "EcoSport", "Mustang"],
    Chevrolet: ["Cruze", "Onix", "Tracker", "S10", "Camaro"],
    Volkswagen: ["Gol", "Polo", "Tiguan", "Amarok", "Vento"],
}

interface VehicleFormProps {
    brand: string
    model: string
    year: string
    plate: string
    insurance: string
    thirdPartyInsurance: string
    onBrandChange: (value: string) => void
    onModelChange: (value: string) => void
    onYearChange: (value: string) => void
    onPlateChange: (value: string) => void
    onInsuranceChange: (value: string) => void
    onThirdPartyInsuranceChange: (value: string) => void
}

export default function VehicleForm({
    brand,
    model,
    year,
    plate,
    insurance,
    thirdPartyInsurance,
    onBrandChange,
    onModelChange,
    onYearChange,
    onPlateChange,
    onInsuranceChange,
    onThirdPartyInsuranceChange,
}: VehicleFormProps) {
    const [openBrand, setOpenBrand] = useState(false)
    const [openModel, setOpenModel] = useState(false)

    const availableModels = brand ? modelsByBrand[brand] || [] : []

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Car className="h-5 w-5 text-primary" /> 
                </div>
                <h3 className="font-semibold">Datos del Vehículo</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Brand Selector */}
                <div className="grid gap-2">
                    <Label>Marca *</Label>
                    <Popover open={openBrand} onOpenChange={setOpenBrand}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openBrand}
                                className="justify-between bg-transparent"
                            >
                                {brand || "Seleccionar marca..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-50 p-0">
                            <Command>
                                <CommandInput placeholder="Buscar marca..." />
                                <CommandList>
                                    <CommandEmpty>No se encontró la marca.</CommandEmpty>
                                    <CommandGroup className="max-h-64 overflow-auto">
                                        {brands.map((brandOption) => (
                                            <CommandItem
                                                key={brandOption}
                                                value={brandOption}
                                                onSelect={(currentValue) => {
                                                    onBrandChange(currentValue === brand ? "" : brandOption)
                                                    onModelChange("") // Reset model when brand changes
                                                    setOpenBrand(false)
                                                }}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", brand === brandOption ? "opacity-100" : "opacity-0")} />
                                                {brandOption}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Model Selector */}
                <div className="grid gap-2">
                    <Label>Modelo *</Label>
                    <Popover open={openModel} onOpenChange={setOpenModel}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openModel}
                                className="justify-between bg-transparent"
                                disabled={!brand}
                            >
                                {model || "Seleccionar modelo..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-50 p-0">
                            <Command>
                                <CommandInput placeholder="Buscar modelo..." />
                                <CommandList>
                                    <CommandEmpty>No se encontró el modelo.</CommandEmpty>
                                    <CommandGroup className="max-h-64 overflow-auto">
                                        {availableModels.map((modelOption) => (
                                            <CommandItem
                                                key={modelOption}
                                                value={modelOption}
                                                onSelect={(currentValue) => {
                                                    onModelChange(currentValue === model ? "" : modelOption)
                                                    setOpenModel(false)
                                                }}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", model === modelOption ? "opacity-100" : "opacity-0")} />
                                                {modelOption}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="year">Año *</Label>
                    <Input
                        id="year"
                        placeholder="2020"
                        value={year}
                        onChange={(e) => onYearChange(e.target.value)}
                        type="number"
                        min="1900"
                        max={new Date().getFullYear() + 1}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="plate">Patente *</Label>
                    <Input
                        id="plate"
                        placeholder="ABC123 o AA 123 AA"
                        value={plate}
                        onChange={(e) => {
                            const value = e.target.value.toUpperCase()
                            // Allow letters, numbers and spaces for both formats
                            const filtered = value.replace(/[^A-Z0-9\s]/g, "")
                            onPlateChange(filtered)
                        }}
                        maxLength={11}
                    />
                    <span className="text-xs text-muted-foreground">Formatos: ABC123 o AA 123 AA</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <InsuranceCombobox label="Seguro" value={insurance} onChange={onInsuranceChange} />
                <InsuranceCombobox label="Seguro Tercero" value={thirdPartyInsurance} onChange={onThirdPartyInsuranceChange} />
            </div>
        </div>
    )
}

function InsuranceCombobox({
    label,
    value,
    onChange,
}: {
    label: string
    value: string
    onChange: (v: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [options, setOptions] = useState<InsuranceOption[]>([])
    const [query, setQuery] = useState("")

    useEffect(() => {
        if (!open) return
        const ac = new AbortController()
        fetch("/api/insurance-companies?active=1", { signal: ac.signal })
            .then((r) => r.json())
            .then((body) => {
                if (Array.isArray(body?.companies)) {
                    setOptions(body.companies.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
                }
            })
            .catch(() => {})
        return () => ac.abort()
    }, [open])

    const filtered = query
        ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
        : options

    const exactMatch = query && !options.some((o) => o.name.toLowerCase() === query.toLowerCase())

    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="justify-between bg-transparent font-normal"
                    >
                        <span className="flex items-center gap-2 truncate">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                            {value || <span className="text-muted-foreground">Sin seguro asignado</span>}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Buscar o tipear aseguradora..."
                            value={query}
                            onValueChange={setQuery}
                        />
                        <CommandList>
                            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                                Sin resultados.
                            </CommandEmpty>
                            <CommandGroup className="max-h-64 overflow-auto">
                                {value && (
                                    <CommandItem
                                        value="__clear__"
                                        onSelect={() => {
                                            onChange("")
                                            setOpen(false)
                                            setQuery("")
                                        }}
                                        className="text-muted-foreground"
                                    >
                                        <span className="mr-2 h-4 w-4" />
                                        — Sin seguro —
                                    </CommandItem>
                                )}
                                {filtered.map((o) => (
                                    <CommandItem
                                        key={o.id}
                                        value={o.name}
                                        onSelect={() => {
                                            onChange(o.name)
                                            setOpen(false)
                                            setQuery("")
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", value === o.name ? "opacity-100" : "opacity-0")} />
                                        {o.name}
                                    </CommandItem>
                                ))}
                                {exactMatch && (
                                    <CommandItem
                                        value={`__custom_${query}`}
                                        onSelect={() => {
                                            onChange(query)
                                            setOpen(false)
                                            setQuery("")
                                        }}
                                        className="italic"
                                    >
                                        <span className="mr-2 h-4 w-4" />
                                        Usar "<b>{query}</b>" (libre)
                                    </CommandItem>
                                )}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
