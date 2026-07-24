"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { CashBoxSummary } from "./caja-section";

/**
 * spec 4.3 v2 · Dialog para registrar un INGRESO o EGRESO manual en una
 * caja. Los cobros vinculados a facturas NO pasan por acá, se crean desde
 * la ficha del vehículo.
 */

type Props = {
  type: "INGRESO" | "EGRESO";
  cashBoxId: string;
  boxes: CashBoxSummary[];
  onClose: () => void;
  onSaved: () => void;
};

const METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "MERCADOPAGO", label: "Mercado Pago" },
  { value: "OTRO", label: "Otro" },
];

// spec v2 · Catálogo de conceptos de EGRESO que el taller usa por mes.
// El operador elige uno o "Otro…" para escribir libre. Al listar movimientos
// esto permite agrupar/filtrar por rubro sin depender del texto libre.
const EGRESO_CONCEPTS = [
  "Flete",
  "Aportes entidades",
  "Gastos administrativos",
  "Inversiones construcción",
  "Publicidad",
  "Repuestos",
  "Albañiles",
  "Particular",
  "Varios",
  "Mano de obra tercerizada",
  "Mejoras de edificio",
  "Impuestos (luz/gas/agua/TGI/API/patentes/seguros vehículos)",
  "AP seguros",
  "Gastos jefes de obras",
  "Alquileres",
  "Marketing",
  "Brixar",
];
const EGRESO_OTHER = "__otro__";

export default function MovementDialog({
  type,
  cashBoxId,
  boxes,
  onClose,
  onSaved,
}: Props) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [concept, setConcept] = useState("");
  // Para EGRESO usamos un select del catálogo con opción "Otro…" que
  // habilita el input libre. INGRESO usa texto libre directo.
  const [conceptChoice, setConceptChoice] = useState<string>("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedBoxId, setSelectedBoxId] = useState(cashBoxId);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = type === "INGRESO" ? "Registrar ingreso" : "Registrar egreso";
  const buttonLabel = type === "INGRESO" ? "Guardar ingreso" : "Guardar egreso";

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/caja/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashBoxId: selectedBoxId,
          type,
          amount: Number(amount),
          method,
          concept,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          paidAt,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    Number(amount) > 0 &&
    concept.trim().length > 0 &&
    selectedBoxId &&
    !saving;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Caja</Label>
            <Select value={selectedBoxId} onValueChange={setSelectedBoxId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {boxes.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Importe</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "EGRESO" ? (
            <div className="grid gap-1">
              <Label className="text-xs">Concepto</Label>
              <Select
                value={conceptChoice}
                onValueChange={(v) => {
                  setConceptChoice(v);
                  // Si eligen un preset, ese texto es el concepto final.
                  // Si es "Otro…", limpiamos el concepto para que escriban.
                  setConcept(v === EGRESO_OTHER ? "" : v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí el rubro del egreso" />
                </SelectTrigger>
                <SelectContent>
                  {EGRESO_CONCEPTS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value={EGRESO_OTHER}>Otro…</SelectItem>
                </SelectContent>
              </Select>
              {conceptChoice === EGRESO_OTHER && (
                <Input
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Detalle del egreso"
                  className="mt-1"
                />
              )}
            </div>
          ) : (
            <div className="grid gap-1">
              <Label className="text-xs">Concepto</Label>
              <Input
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ej: aporte, venta, ajuste…"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Fecha</Label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Referencia</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Nº comprobante"
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Notas</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle opcional"
            />
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
