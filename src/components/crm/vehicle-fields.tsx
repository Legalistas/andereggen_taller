"use client";

import { Calendar, Car, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

// ─────────────────────────────────────────────────────────────
// Tipos y cache por sesión
// ─────────────────────────────────────────────────────────────

type Brand = { id: string; name: string };
type Model = { id: string; name: string; brand: { id: string; name: string } };

let brandsCache: Brand[] | null = null;
let brandsPromise: Promise<Brand[]> | null = null;
const modelsCacheByBrandId = new Map<string, Model[]>();
const modelsPromiseByBrandId = new Map<string, Promise<Model[]>>();

async function loadBrands(): Promise<Brand[]> {
  if (brandsCache) return brandsCache;
  if (brandsPromise) return brandsPromise;
  brandsPromise = fetch("/api/vehicle-brands?active=1")
    .then((r) => r.json())
    .then((b) => (b.brands ?? []) as Brand[])
    .then((brands) => {
      brandsCache = brands;
      return brands;
    })
    .finally(() => {
      brandsPromise = null;
    });
  return brandsPromise;
}

async function loadModelsByBrandName(brandName: string): Promise<Model[]> {
  const brands = await loadBrands();
  const brand = brands.find(
    (b) => b.name.toLowerCase() === brandName.trim().toLowerCase(),
  );
  if (!brand) return [];
  return loadModelsByBrandId(brand.id);
}

async function loadModelsByBrandId(brandId: string): Promise<Model[]> {
  const cached = modelsCacheByBrandId.get(brandId);
  if (cached) return cached;
  const pending = modelsPromiseByBrandId.get(brandId);
  if (pending) return pending;
  const p = fetch(`/api/vehicle-models?active=1&brandId=${brandId}`)
    .then((r) => r.json())
    .then((b) => (b.models ?? []) as Model[])
    .then((models) => {
      modelsCacheByBrandId.set(brandId, models);
      return models;
    })
    .finally(() => {
      modelsPromiseByBrandId.delete(brandId);
    });
  modelsPromiseByBrandId.set(brandId, p);
  return p;
}

// ─────────────────────────────────────────────────────────────
// BrandField: combobox con texto libre permitido
// ─────────────────────────────────────────────────────────────

type ComboProps = {
  label: string;
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  /** Render visual estilo canvas (labels pequeños uppercase) vs. form normal */
  compact?: boolean;
};

export function BrandField({
  label,
  value,
  onSave,
  placeholder = "Escribí o elegí…",
  compact,
}: ComboProps) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Brand[] | null>(null);
  const originalRef = useRef(value);

  useEffect(() => {
    setDraft(value);
    originalRef.current = value;
    setDirty(false);
  }, [value]);

  useEffect(() => {
    if (!open || options !== null) return;
    loadBrands()
      .then(setOptions)
      .catch(() => setOptions([]));
  }, [open, options]);

  const commit = (newValue?: string) => {
    const final = (newValue ?? draft).trim();
    if (final === originalRef.current) {
      setDirty(false);
      return;
    }
    originalRef.current = final;
    setDirty(false);
    onSave(final);
  };

  // Si el usuario no modificó todavía, mostrar el catálogo completo.
  // Cuando empieza a tipear, filtrar con el draft.
  const filtered = dirty
    ? (options ?? []).filter((o) =>
        o.name.toLowerCase().includes(draft.toLowerCase()),
      )
    : (options ?? []);

  return (
    <div className="grid gap-1">
      <Label
        className={
          compact
            ? "text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1"
            : "flex items-center gap-1"
        }
      >
        <Car className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Input
            value={draft}
            onChange={(e) => {
              setDirty(true);
              setDraft(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={(e) => {
              setOpen(true);
              // Seleccionar todo el texto para que tipear reemplace.
              e.currentTarget.select();
            }}
            onBlur={() => {
              setTimeout(() => {
                setOpen(false);
                commit();
              }, 150);
            }}
            placeholder={placeholder}
            className="text-left"
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
        >
          {options === null ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 inline animate-spin" /> Cargando…
            </div>
          ) : options.length === 0 ? (
            <div className="py-3 px-2 text-center text-xs text-muted-foreground">
              <p className="italic mb-1">Catálogo vacío.</p>
              <a
                href="/configuracion"
                className="text-[11px] font-medium text-[#003b73] hover:underline"
              >
                Cargar marcas en Configuración →
              </a>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground italic">
              Sin coincidencias — el texto libre igual se guarda.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDraft(o.name);
                    commit(o.name);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 hover:bg-accent rounded"
                >
                  <Car className="h-3 w-3 text-slate-400 shrink-0" />
                  {o.name}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ModelField: filtra por brand elegido, texto libre permitido
// ─────────────────────────────────────────────────────────────

type ModelProps = ComboProps & {
  brand: string;
};

export function ModelField({
  label,
  value,
  onSave,
  brand,
  placeholder = "Escribí o elegí…",
  compact,
}: ModelProps) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Model[] | null>(null);
  const originalRef = useRef(value);
  const brandRef = useRef(brand);

  useEffect(() => {
    setDraft(value);
    originalRef.current = value;
    setDirty(false);
  }, [value]);

  // Resetear cache al cambiar de marca
  useEffect(() => {
    if (brandRef.current !== brand) {
      brandRef.current = brand;
      setOptions(null);
    }
  }, [brand]);

  useEffect(() => {
    if (!open || options !== null) return;
    if (!brand.trim()) {
      setOptions([]);
      return;
    }
    loadModelsByBrandName(brand)
      .then(setOptions)
      .catch(() => setOptions([]));
  }, [open, options, brand]);

  const commit = (newValue?: string) => {
    const final = (newValue ?? draft).trim();
    if (final === originalRef.current) {
      setDirty(false);
      return;
    }
    originalRef.current = final;
    setDirty(false);
    onSave(final);
  };

  const filtered = dirty
    ? (options ?? []).filter((o) =>
        o.name.toLowerCase().includes(draft.toLowerCase()),
      )
    : (options ?? []);

  return (
    <div className="grid gap-1">
      <Label
        className={
          compact
            ? "text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1"
            : "flex items-center gap-1"
        }
      >
        <Car className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Input
            value={draft}
            onChange={(e) => {
              setDirty(true);
              setDraft(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={(e) => {
              setOpen(true);
              e.currentTarget.select();
            }}
            onBlur={() => {
              setTimeout(() => {
                setOpen(false);
                commit();
              }, 150);
            }}
            placeholder={brand ? placeholder : "Elegí una marca primero…"}
            className="text-left"
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
        >
          {!brand.trim() ? (
            <p className="py-3 text-center text-xs text-muted-foreground italic">
              Primero cargá la marca.
            </p>
          ) : options === null ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 inline animate-spin" /> Cargando…
            </div>
          ) : options.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground italic">
              Sin modelos para {brand}. El texto libre igual se guarda.
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground italic">
              Sin coincidencias — el texto libre igual se guarda.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDraft(o.name);
                    commit(o.name);
                    setOpen(false);
                  }}
                  className="w-full text-left text-xs px-2 py-1.5 hover:bg-accent rounded"
                >
                  {o.name}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// YearField: select con rango 1990 → currentYear + 1
// ─────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1990;
const YEARS: string[] = Array.from(
  { length: CURRENT_YEAR - MIN_YEAR + 2 },
  (_, i) => String(CURRENT_YEAR + 1 - i),
);

export function YearField({
  label,
  value,
  onSave,
  compact,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <Label
        className={
          compact
            ? "text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1"
            : "flex items-center gap-1"
        }
      >
        <Calendar className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> {label}
      </Label>
      <Select value={value || undefined} onValueChange={onSave}>
        <SelectTrigger>
          <SelectValue placeholder="Año" />
        </SelectTrigger>
        <SelectContent>
          {YEARS.map((y) => (
            <SelectItem key={y} value={y}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
