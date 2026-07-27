"use client";

import { ArrowRight } from "lucide-react";
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
 * spec 4.3 v2 · Dialog para transferir entre 2 cajas. Se registra un
 * TRANSFER_OUT en origen y un TRANSFER_IN en destino, atómico.
 */

type Props = {
  boxes: CashBoxSummary[];
  onClose: () => void;
  onSaved: () => void;
};

/** `YYYY-MM-DD` (input date) → ISO al mediodía LOCAL. Evita el salto de un
 *  día por parsing UTC en el server. */
function paidAtLocalNoon(v: string): string {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export default function TransferDialog({ boxes, onClose, onSaved }: Props) {
  const [fromId, setFromId] = useState(boxes[0]?.id ?? "");
  const [toId, setToId] = useState(boxes[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/caja/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCashBoxId: fromId,
          toCashBoxId: toId,
          amount: Number(amount),
          concept: concept.trim() || undefined,
          notes: notes.trim() || undefined,
          // Interpretamos el YYYY-MM-DD como mediodía local — evita que
          // `new Date(str)` del server lo lea como UTC y quede un día antes.
          paidAt: paidAtLocalNoon(paidAt),
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
    Number(amount) > 0 && fromId && toId && fromId !== toId && !saving;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferencia entre cajas</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">Desde</Label>
              <Select value={fromId} onValueChange={setFromId}>
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
            <ArrowRight className="h-4 w-4 text-slate-400 mb-2" />
            <div className="grid gap-1">
              <Label className="text-xs">Hacia</Label>
              <Select value={toId} onValueChange={setToId}>
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
          </div>

          {fromId === toId && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Elegí cajas distintas de origen y destino.
            </div>
          )}

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
              <Label className="text-xs">Fecha</Label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Concepto (opcional)</Label>
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Se genera automático si lo dejás vacío"
            />
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
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
