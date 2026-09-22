"use client";

import { Car, Check, ChevronsUpDown, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loadInsuranceCompanies } from "@/lib/client-cache";
import { cn } from "@/lib/utils";
import { BrandField, ModelField, YearField } from "./vehicle-fields";

type InsuranceOption = { id: string; name: string };

interface VehicleFormProps {
  brand: string;
  model: string;
  year: string;
  plate: string;
  insurance: string;
  thirdPartyInsurance: string;
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onPlateChange: (value: string) => void;
  onInsuranceChange: (value: string) => void;
  onThirdPartyInsuranceChange: (value: string) => void;
  /**
   * Cobertura del seguro propio: "" | "todo_riesgo" | "terceros".
   * Opcional: solo el alta de solicitud la pide, porque es el momento en que
   * se toma el presupuesto y hace falta saber si hay franquicia.
   */
  coverageType?: string;
  /** Importe de franquicia. Solo aplica con cobertura "todo_riesgo". */
  franchise?: string;
  onCoverageTypeChange?: (value: string) => void;
  onFranchiseChange?: (value: string) => void;
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
  coverageType = "",
  franchise = "",
  onCoverageTypeChange,
  onFranchiseChange,
}: VehicleFormProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Car className="h-5 w-5 text-primary" />
        </div>
        <h3 className="font-semibold">Datos del Vehículo</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <BrandField
          label="Marca *"
          value={brand}
          onSave={(v) => {
            onBrandChange(v);
            // Reset del modelo si cambia la marca (texto) a otra distinta
            if (v.trim().toLowerCase() !== brand.trim().toLowerCase()) {
              onModelChange("");
            }
          }}
        />
        <ModelField
          label="Modelo *"
          value={model}
          brand={brand}
          onSave={onModelChange}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <YearField label="Año *" value={year} onSave={onYearChange} />
        <div className="grid gap-1">
          <Label htmlFor="plate" className="flex items-center gap-1">
            Patente *
          </Label>
          <Input
            id="plate"
            placeholder="ABC123 o AA 123 AA"
            value={plate}
            onChange={(e) => {
              const value = e.target.value.toUpperCase();
              const filtered = value.replace(/[^A-Z0-9\s]/g, "");
              onPlateChange(filtered);
            }}
            maxLength={11}
            className="font-mono uppercase tracking-wider"
          />
          <span className="text-xs text-muted-foreground">
            Formatos: ABC123 o AA 123 AA
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InsuranceCombobox
          label="Seguro"
          value={insurance}
          onChange={onInsuranceChange}
        />
        <InsuranceCombobox
          label="Seguro del tercero"
          value={thirdPartyInsurance}
          onChange={onThirdPartyInsuranceChange}
        />
      </div>

      {/* Qué cobertura tiene: define si el cliente pone franquicia, dato que
          el taller necesita desde que toma el presupuesto. */}
      {onCoverageTypeChange && (
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>¿Qué seguro tiene?</Label>
            <Select
              value={coverageType || "none"}
              onValueChange={(v) => {
                const next = v === "none" ? "" : v;
                onCoverageTypeChange(next);
                // Contra terceros no lleva franquicia: la limpiamos para no
                // arrastrar un importe que no corresponde.
                if (next !== "todo_riesgo") onFranchiseChange?.("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin definir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin definir</SelectItem>
                <SelectItem value="todo_riesgo">
                  Contra todo riesgo (franquicia)
                </SelectItem>
                <SelectItem value="terceros">Contra terceros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {coverageType === "todo_riesgo" && (
            <div className="grid gap-2">
              <Label htmlFor="franchise">Importe de franquicia</Label>
              <Input
                id="franchise"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={franchise}
                onChange={(e) => onFranchiseChange?.(e.target.value)}
                className="tabular-nums"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InsuranceCombobox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<InsuranceOption[]>([]);
  const [query, setQuery] = useState("");

  // Perf audit: cache module-level compartido con lead-canvas/repair-canvas.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadInsuranceCompanies()
      .then((list) => {
        if (!cancelled) {
          setOptions(list.map((c) => ({ id: c.id, name: c.name })));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options;

  const exactMatch =
    query && !options.some((o) => o.name.toLowerCase() === query.toLowerCase());

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
              {value || (
                <span className="text-muted-foreground">
                  Sin seguro asignado
                </span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
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
                      onChange("");
                      setOpen(false);
                      setQuery("");
                    }}
                    className="text-muted-foreground"
                  >
                    <span className="mr-2 h-4 w-4" />— Sin seguro —
                  </CommandItem>
                )}
                {filtered.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={o.name}
                    onSelect={() => {
                      onChange(o.name);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === o.name ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {o.name}
                  </CommandItem>
                ))}
                {exactMatch && (
                  <CommandItem
                    value={`__custom_${query}`}
                    onSelect={() => {
                      onChange(query);
                      setOpen(false);
                      setQuery("");
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
  );
}
