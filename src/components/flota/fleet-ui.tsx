"use client";

import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type DueStatus, MAX_FILE_BYTES } from "@/lib/fleet";

export const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** fetch JSON que tira Error con el mensaje de la API. */
export async function api<T = unknown>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
  return data as T;
}

// ── Estado de un vencimiento ─────────────────────────────────

const STATUS_STYLE: Record<DueStatus, [string, string]> = {
  PAGADO: ["Pagado", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  VENCIDO: ["Vencido", "bg-red-50 text-red-700 border-red-200"],
  POR_VENCER: ["Por vencer", "bg-amber-50 text-amber-700 border-amber-200"],
  PENDIENTE: ["Pendiente", "bg-slate-50 text-slate-600 border-slate-200"],
};

export function StatusBadge({ status }: { status: DueStatus }) {
  const [label, cls] = STATUS_STYLE[status];
  return (
    <Badge variant="outline" className={cls}>
      {label}
    </Badge>
  );
}

export function TransferBadge({ transferred }: { transferred: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        transferred
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      }
    >
      {transferred ? "Transferido" : "Sin transferir"}
    </Badge>
  );
}

// ── Formulario genérico en diálogo ───────────────────────────

export type FormValues = Record<string, string | boolean>;

export type FormField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "checkbox" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  wide?: boolean;
  /** Si devuelve false el campo no se muestra y se envía vacío. */
  show?: (v: FormValues) => boolean;
};

const NONE = "_none"; // Radix Select no admite value "".

export function FormDialog({
  title,
  fields,
  initial,
  onSubmit,
  onClose,
}: {
  title: string;
  fields: FormField[];
  initial: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  onClose: () => void;
}) {
  const baseId = useId();
  const [values, setValues] = useState<FormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string | boolean) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: FormValues = {};
      for (const f of fields) {
        const visible = f.show?.(values) ?? true;
        payload[f.key] = visible
          ? (values[f.key] ?? "")
          : f.type === "checkbox"
            ? false
            : "";
      }
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => {
              if (f.show && !f.show(values)) return null;
              const id = `${baseId}-${f.key}`;
              const v = values[f.key];
              const wide = f.wide || f.type === "textarea";
              if (f.type === "checkbox")
                return (
                  <label
                    key={f.key}
                    htmlFor={id}
                    className={`flex items-center gap-2 text-sm cursor-pointer self-end pb-2 ${wide ? "sm:col-span-2" : ""}`}
                  >
                    <Checkbox
                      id={id}
                      checked={v === true}
                      onCheckedChange={(c) => set(f.key, c === true)}
                    />
                    {f.label}
                  </label>
                );
              return (
                <div
                  key={f.key}
                  className={`grid gap-1.5 ${wide ? "sm:col-span-2" : ""}`}
                >
                  <Label htmlFor={id} className="text-xs">
                    {f.label}
                  </Label>
                  {f.type === "textarea" ? (
                    <Textarea
                      id={id}
                      rows={2}
                      value={String(v ?? "")}
                      placeholder={f.placeholder}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  ) : f.type === "select" ? (
                    <Select
                      value={String(v || NONE)}
                      onValueChange={(nv) => set(f.key, nv === NONE ? "" : nv)}
                    >
                      <SelectTrigger id={id} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(f.options ?? []).map((o) => (
                          <SelectItem key={o.value} value={o.value || NONE}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={id}
                      type={f.type ?? "text"}
                      inputMode={f.type === "number" ? "decimal" : undefined}
                      min={f.type === "number" ? 0 : undefined}
                      step={f.type === "number" ? "any" : undefined}
                      value={String(v ?? "")}
                      placeholder={f.placeholder}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Archivos (papeles y comprobantes) ────────────────────────

export type FleetFileRow = {
  id: string;
  name: string;
  contentType: string;
  size: number;
};

/** Las fotos de celular pesan más que el tope de Vercel: se achican a ~2000 px en JPEG. */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 1_500_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", 0.85),
    );
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.\w+$/, "")}.jpg`, {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

/**
 * Lista de archivos con link (se abren en otra pestaña), botón para quitar
 * y botón para subir. `target` dice de qué cuelgan: vehículo, pago o trabajo.
 */
export function FileChips({
  files,
  target,
  onChange,
  uploadLabel = "Adjuntar",
  name,
}: {
  files: FleetFileRow[];
  target: { vehicleId?: string; paymentId?: string; maintenanceId?: string };
  onChange: () => void;
  uploadLabel?: string;
  /** Nombre a guardar (ej. "Título"); si no, el del archivo. */
  name?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const original of Array.from(list)) {
        const file = await shrinkImage(original);
        if (file.size > MAX_FILE_BYTES)
          throw new Error(`"${original.name}" supera los 4 MB`);
        const form = new FormData();
        form.set("file", file);
        for (const [k, v] of Object.entries(target)) if (v) form.set(k, v);
        if (name?.trim()) form.set("name", name.trim());
        const res = await fetch("/api/flota/files", {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      onChange();
    }
  };

  const remove = async (f: FleetFileRow) => {
    if (!window.confirm(`¿Eliminar "${f.name}"?`)) return;
    try {
      await api(`/api/flota/files/${f.id}`, "DELETE");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {files.map((f) => (
          <span
            key={f.id}
            className="inline-flex items-center gap-1 rounded-md border bg-muted/40 pl-2 text-xs"
          >
            {f.contentType.startsWith("image/") ? (
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <a
              href={`/api/flota/files/${f.id}`}
              target="_blank"
              rel="noreferrer"
              className="max-w-48 truncate py-1 hover:underline"
            >
              {f.name}
            </a>
            <button
              type="button"
              onClick={() => remove(f)}
              className="p-1 text-muted-foreground hover:text-destructive"
              aria-label={`Eliminar ${f.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          {uploadLabel}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Vehículo (alta en la lista, edición en la ficha) ─────────

export type FleetVehicleBase = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  ownerName: string | null;
  transferred: boolean;
  documentsLocation: string | null;
  notes: string | null;
  isActive: boolean;
};

export const VEHICLE_FIELDS: FormField[] = [
  { key: "plate", label: "Patente *", placeholder: "AB123CD" },
  { key: "brand", label: "Marca" },
  { key: "model", label: "Modelo" },
  { key: "year", label: "Año", type: "number" },
  { key: "color", label: "Color" },
  { key: "chassisNumber", label: "Nº de chasis" },
  { key: "engineNumber", label: "Nº de motor" },
  { key: "ownerName", label: "Titular (a nombre de quién está)" },
  { key: "transferred", label: "Transferido al titular", type: "checkbox" },
  {
    key: "documentsLocation",
    label: "¿Dónde está la documentación física?",
    placeholder: "Ej: carpeta en oficina de Alfredo",
    wide: true,
  },
  { key: "notes", label: "Notas", type: "textarea" },
  {
    key: "isActive",
    label: "Activo (desmarcar si se vendió o dio de baja)",
    type: "checkbox",
    wide: true,
  },
];

export function vehicleValues(v?: FleetVehicleBase): FormValues {
  return {
    plate: v?.plate ?? "",
    brand: v?.brand ?? "",
    model: v?.model ?? "",
    year: v?.year ? String(v.year) : "",
    color: v?.color ?? "",
    chassisNumber: v?.chassisNumber ?? "",
    engineNumber: v?.engineNumber ?? "",
    ownerName: v?.ownerName ?? "",
    transferred: v?.transferred ?? false,
    documentsLocation: v?.documentsLocation ?? "",
    notes: v?.notes ?? "",
    isActive: v?.isActive ?? true,
  };
}
