"use client";

import {
  Car,
  Check,
  ChevronsUpDown,
  FileText,
  Mail,
  Package,
  Phone,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORIES,
  CATEGORY_BY_KEY,
  computeBudgetTotals,
  computeConceptSubtotal,
  computePartSubtotal,
  customSubdetailLabel,
  DEFAULT_IVA_RATE,
  isCustomSubdetail,
  makeCustomSubdetailKey,
  SUBDETAILS,
} from "@/lib/budget-catalog";
import type {
  ConceptCategory,
  ConceptType,
} from "../../../generated/prisma/client";

type ConceptDraft = {
  localId: string;
  type: ConceptType;
  category: ConceptCategory;
  subdetails: string[];
  additionalDetail: string;
  units: string;
  unitValue: string;
  fixedAmount: string;
  fixedDescription: string;
};

type PartDraft = {
  localId: string;
  partId: string | null;
  quantity: string;
  description: string;
  unitPrice: string;
};

type CatalogPart = {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  salePrice: string | number;
  stockQty: string | number;
  stockMin: string | number;
};

type LeadInfo = {
  customer: { name: string; email: string; phone: string };
  vehicle: {
    brand: string;
    model: string;
    year: string;
    domain: string;
  } | null;
};

type Props = {
  leadId?: string;
  /** Si está, el modal carga el budget existente y al guardar hace PATCH (modo edición). */
  budgetId?: string;
  onSaved?: () => void;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

function num(s: string): number {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function emptyConcept(category: ConceptCategory): ConceptDraft {
  const def = CATEGORY_BY_KEY[category];
  return {
    localId: uid(),
    type: def.type,
    category,
    subdetails: [],
    additionalDetail: "",
    units: "",
    unitValue: "",
    fixedAmount: "",
    fixedDescription: "",
  };
}

export default function BudgetModal({
  leadId,
  budgetId,
  onSaved,
  hideTrigger,
  open: openProp,
  onOpenChange,
}: Props) {
  const isEditing = !!budgetId;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [concepts, setConcepts] = useState<ConceptDraft[]>([]);
  const [parts, setParts] = useState<PartDraft[]>([]);
  const [validityDays, setValidityDays] = useState("10");
  const [deliveryDays, setDeliveryDays] = useState("20");
  const [paymentCondition, setPaymentCondition] = useState(
    "Contado contra entrega",
  );
  const [observations, setObservations] = useState("");
  // Aclaración libre sobre los repuestos a proveer — sale en el PDF al cliente.
  const [partsNote, setPartsNote] = useState("");
  // Pintura perlada tricapa — flag por presupuesto (no por vehículo).
  const [perladoTricapa, setPerladoTricapa] = useState(false);
  const [newCategory, setNewCategory] = useState<ConceptCategory | "">("");
  // IVA rate del budget — al crear se usa el default; al editar se carga
  // el valor guardado (algunos presupuestos importados están con 0).
  const [ivaRate, setIvaRate] = useState<number>(DEFAULT_IVA_RATE);
  // Número de presupuesto: en modo crear, el admin puede sobreescribir el
  // correlativo sugerido (max+1). En modo edición no se permite cambiarlo.
  const [budgetNumber, setBudgetNumber] = useState("");
  const [suggestedNumber, setSuggestedNumber] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);

  // Al abrir en modo crear, sugerir el próximo correlativo (max+1) para
  // pre-poblar el input. Si el admin lo cambia, respetamos lo que escribió.
  useEffect(() => {
    if (!open || isEditing) return;
    let cancelled = false;
    fetch("/api/budgets/next-number")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || typeof data?.next !== "number") return;
        setSuggestedNumber(data.next);
        setBudgetNumber((curr) => (curr === "" ? String(data.next) : curr));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, isEditing]);

  // Fetch info del lead cuando se abre, para mostrar header contextual
  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;
    fetch(`/api/crm/leads/${leadId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.lead) {
          setLeadInfo({
            customer: data.lead.customer,
            vehicle: data.lead.vehicle,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, leadId]);

  // Modo edición: cuando se abre con budgetId, traer el budget completo y
  // poblar concepts/parts/conditions del form. Solo corre una vez por
  // apertura (cuando open pasa a true) para no pisar lo que el usuario edita.
  useEffect(() => {
    if (!open || !budgetId) return;
    let cancelled = false;
    fetch(`/api/budgets/${budgetId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.budget) return;
        const b = data.budget as {
          number: number;
          ivaRate: string | number | null;
          validityDays: number;
          deliveryDays: number;
          paymentCondition: string;
          observations: string | null;
          partsNote: string | null;
          vehiclePerladoTricapa: boolean;
          concepts: Array<{
            type: ConceptType;
            category: ConceptCategory;
            subdetails: string[];
            additionalDetail: string | null;
            units: string | number | null;
            unitValue: string | number | null;
            fixedAmount: string | number | null;
            fixedDescription: string | null;
          }>;
          parts: Array<{
            partId: string | null;
            quantity: string | number;
            description: string;
            unitPrice: string | number;
          }>;
        };
        // IVA del budget — algunos importados están con 0; respetamos el guardado
        if (b.ivaRate !== null) setIvaRate(Number(b.ivaRate));
        setBudgetNumber(String(b.number));
        setValidityDays(String(b.validityDays ?? 10));
        setDeliveryDays(String(b.deliveryDays ?? 20));
        setPaymentCondition(b.paymentCondition ?? "Contado contra entrega");
        setObservations(b.observations ?? "");
        setPartsNote(b.partsNote ?? "");
        setPerladoTricapa(Boolean(b.vehiclePerladoTricapa));
        setConcepts(
          b.concepts.map((c) => ({
            localId: uid(),
            type: c.type,
            category: c.category,
            subdetails: c.subdetails ?? [],
            additionalDetail: c.additionalDetail ?? "",
            units: c.units !== null ? String(c.units) : "",
            unitValue: c.unitValue !== null ? String(c.unitValue) : "",
            fixedAmount: c.fixedAmount !== null ? String(c.fixedAmount) : "",
            fixedDescription: c.fixedDescription ?? "",
          })),
        );
        setParts(
          b.parts.map((p) => ({
            localId: uid(),
            partId: p.partId,
            quantity: String(p.quantity ?? ""),
            description: p.description,
            unitPrice: String(p.unitPrice ?? ""),
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Solo dependemos de open + budgetId — re-fetchear al abrir; no en cada
    // tipeo del usuario.
  }, [open, budgetId]);

  const totals = useMemo(() => {
    return computeBudgetTotals({
      concepts: concepts.map((c) => ({
        type: c.type,
        units: num(c.units),
        unitValue: num(c.unitValue),
        fixedAmount: num(c.fixedAmount),
      })),
      parts: parts.map((p) => ({
        quantity: num(p.quantity),
        unitPrice: num(p.unitPrice),
      })),
      ivaRate,
    });
  }, [concepts, parts, ivaRate]);

  const addConcept = useCallback(() => {
    if (!newCategory) return;
    setConcepts((prev) => [...prev, emptyConcept(newCategory)]);
    setNewCategory("");
  }, [newCategory]);

  const updateConcept = (id: string, patch: Partial<ConceptDraft>) => {
    setConcepts((prev) =>
      prev.map((c) => (c.localId === id ? { ...c, ...patch } : c)),
    );
  };
  const removeConcept = (id: string) =>
    setConcepts((prev) => prev.filter((c) => c.localId !== id));

  const addPart = () =>
    setParts((prev) => [
      ...prev,
      {
        localId: uid(),
        partId: null,
        quantity: "1",
        description: "",
        unitPrice: "",
      },
    ]);
  const updatePart = (id: string, patch: Partial<PartDraft>) =>
    setParts((prev) =>
      prev.map((p) => (p.localId === id ? { ...p, ...patch } : p)),
    );
  const removePart = (id: string) =>
    setParts((prev) => prev.filter((p) => p.localId !== id));

  const resetForm = useCallback(() => {
    setConcepts([]);
    setParts([]);
    setValidityDays("10");
    setDeliveryDays("20");
    setPaymentCondition("Contado contra entrega");
    setObservations("");
    setPartsNote("");
    setPerladoTricapa(false);
    setIvaRate(DEFAULT_IVA_RATE);
    setBudgetNumber("");
    setSuggestedNumber(null);
    setError(null);
    setLeadInfo(null);
  }, []);

  const handleSubmit = async () => {
    if (!leadId) {
      setError("Seleccioná o creá un lead antes de guardar el presupuesto.");
      return;
    }
    if (concepts.length === 0 && parts.length === 0) {
      setError("El presupuesto necesita al menos un concepto o repuesto.");
      return;
    }
    // Validación cliente del Nº manual (aplica al crear y al editar).
    let parsedNumber: number | undefined;
    if (budgetNumber.trim() !== "") {
      const n = Number(budgetNumber);
      if (!Number.isInteger(n) || n <= 0) {
        setError("El número de presupuesto debe ser un entero positivo.");
        return;
      }
      parsedNumber = n;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        number: parsedNumber,
        validityDays: num(validityDays) || 10,
        deliveryDays: num(deliveryDays) || 20,
        paymentCondition,
        observations: observations || null,
        partsNote: partsNote.trim() || null,
        perladoTricapa,
        concepts: concepts.map((c, idx) => ({
          type: c.type,
          category: c.category,
          order: idx,
          subdetails: c.type === "DESCRIPTIVO" ? c.subdetails : [],
          additionalDetail: c.additionalDetail || null,
          units: c.type === "UNIDADES" ? num(c.units) : null,
          unitValue: c.type === "UNIDADES" ? num(c.unitValue) : null,
          fixedAmount: c.type === "FIJO" ? num(c.fixedAmount) : null,
          fixedDescription:
            c.type === "FIJO" ? c.fixedDescription || null : null,
        })),
        parts: parts.map((p, idx) => ({
          order: idx,
          partId: p.partId,
          quantity: num(p.quantity),
          description: p.description,
          unitPrice: num(p.unitPrice),
        })),
      };
      // En modo edición → PATCH al budget; en modo nuevo → POST a leads/{id}/budgets.
      const url = isEditing
        ? `/api/budgets/${budgetId}`
        : `/api/crm/leads/${leadId}/budgets`;
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ error: "Error desconocido" }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      resetForm();
      setOpen(false);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // Limpiar el form cuando el modal se cierra (sino al reabrir queda con
  // los datos del último presupuesto editado).
  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="gap-2 bg-transparent hover:bg-[#003b73] hover:text-white transition-colors"
            disabled={!leadId}
          >
            <FileText className="h-4 w-4" />
            Crear Presupuesto
          </Button>
        </DialogTrigger>
      )}

      <DialogContent
        showCloseButton={false}
        className="max-w-[98vw] sm:max-w-[98vw] w-[98vw] h-[95vh] p-0 gap-0 flex flex-col sm:rounded-xl overflow-hidden"
      >
        {/* DialogTitle + Description para a11y (el header visual está abajo). */}
        <DialogTitle className="sr-only">
          {isEditing ? "Editar presupuesto" : "Nuevo presupuesto"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Editor de presupuesto con conceptos, repuestos y condiciones.
        </DialogDescription>

        {/* Header ancho */}
        <header className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#003b73]/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-[#003b73]" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">
                {isEditing ? "Editar presupuesto" : "Nuevo presupuesto"}
              </h2>
              {leadInfo && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {leadInfo.customer.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {leadInfo.customer.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {leadInfo.customer.phone}
                  </span>
                  {leadInfo.vehicle && (
                    <span className="flex items-center gap-1">
                      <Car className="h-3 w-3" />
                      {leadInfo.vehicle.brand} {leadInfo.vehicle.model}{" "}
                      {leadInfo.vehicle.year} · {leadInfo.vehicle.domain}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        {/* Body: 2 columnas (main + sidebar sticky) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] flex-1 min-h-0">
          {/* Main editor — scrolleable */}
          <section className="overflow-y-auto p-6 space-y-4 bg-muted/20">
            {/* Bloque "Agregar concepto" compacto inline */}
            <Card className="p-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Agregar concepto
                  </Label>
                  <Select
                    value={newCategory}
                    onValueChange={(v) => setNewCategory(v as ConceptCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná una categoría..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroupDivider label="Descriptivas" />
                      {CATEGORIES.filter((c) => c.type === "DESCRIPTIVO").map(
                        (c) => (
                          <SelectItem key={c.key} value={c.key}>
                            {c.label}
                          </SelectItem>
                        ),
                      )}
                      <SelectGroupDivider label="Mano de obra por unidades" />
                      {CATEGORIES.filter((c) => c.type === "UNIDADES").map(
                        (c) => (
                          <SelectItem key={c.key} value={c.key}>
                            {c.label}
                          </SelectItem>
                        ),
                      )}
                      <SelectGroupDivider label="Importe fijo" />
                      {CATEGORIES.filter((c) => c.type === "FIJO").map((c) => (
                        <SelectItem key={c.key} value={c.key}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={addConcept}
                  disabled={!newCategory}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </div>
            </Card>

            {/* Lista de conceptos */}
            {concepts.length === 0 ? (
              <Card className="p-10 text-center border-dashed">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Todavía no agregaste conceptos. Usá el selector de arriba.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {concepts.map((c, idx) => (
                  <ConceptBlock
                    key={c.localId}
                    concept={c}
                    index={idx}
                    onChange={(patch) => updateConcept(c.localId, patch)}
                    onRemove={() => removeConcept(c.localId)}
                  />
                ))}
              </div>
            )}

            {/* Repuestos */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Repuestos</h3>
                  <p className="text-xs text-muted-foreground">
                    Piezas con cantidad, precio unitario y subtotal.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addPart}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar repuesto
                </Button>
              </div>
              {parts.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  Sin repuestos todavía.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Cantidad</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-40">Precio unitario</TableHead>
                      <TableHead className="w-40 text-right">
                        Subtotal
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parts.map((p) => {
                      const st = computePartSubtotal({
                        quantity: num(p.quantity),
                        unitPrice: num(p.unitPrice),
                      });
                      return (
                        <TableRow key={p.localId}>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={p.quantity}
                              onChange={(e) =>
                                updatePart(p.localId, {
                                  quantity: e.target.value,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <PartAutocomplete
                              value={p.description}
                              partId={p.partId}
                              onChangeText={(text) =>
                                updatePart(p.localId, {
                                  description: text,
                                  partId: null, // editar manual desvincula del catálogo
                                })
                              }
                              onSelect={(part) =>
                                updatePart(p.localId, {
                                  partId: part.id,
                                  description: part.sku
                                    ? `${part.sku} — ${part.name}`
                                    : part.name,
                                  unitPrice: String(part.salePrice),
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={p.unitPrice}
                              onChange={(e) =>
                                updatePart(p.localId, {
                                  unitPrice: e.target.value,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {ARS.format(st)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive"
                              onClick={() => removePart(p.localId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              <div className="grid gap-1.5 pt-2 border-t">
                <Label htmlFor="partsNote" className="text-xs">
                  Aclaración sobre los repuestos a proveer
                </Label>
                <Textarea
                  id="partsNote"
                  rows={2}
                  placeholder="Ej: Los repuestos serán provistos por el taller / por la aseguradora / por el cliente..."
                  value={partsNote}
                  onChange={(e) => setPartsNote(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Este texto se incluye en el PDF que recibe el cliente.
                </p>
              </div>
            </Card>
          </section>

          {/* Sidebar sticky */}
          <aside className="border-l bg-background flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Totales */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Resumen
                </h3>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal MO</dt>
                    <dd>{ARS.format(totals.laborSubtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      IVA {totals.ivaRate}%
                    </dt>
                    <dd>{ARS.format(totals.ivaAmount)}</dd>
                  </div>
                  <div className="flex justify-between font-medium">
                    <dt>MO con IVA</dt>
                    <dd>{ARS.format(totals.laborTotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Repuestos</dt>
                    <dd>{ARS.format(totals.partsSubtotal)}</dd>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between items-baseline">
                    <dt className="font-bold">TOTAL</dt>
                    <dd className="font-bold text-lg text-[#003b73]">
                      {ARS.format(totals.grandTotal)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Observaciones */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Condiciones
                </h3>
                <div className="grid gap-1.5">
                  <Label htmlFor="budgetNumber" className="text-xs">
                    Nº de presupuesto
                  </Label>
                  <Input
                    id="budgetNumber"
                    type="number"
                    min="1"
                    step="1"
                    value={budgetNumber}
                    onChange={(e) => setBudgetNumber(e.target.value)}
                    placeholder={
                      !isEditing && suggestedNumber !== null
                        ? String(suggestedNumber)
                        : ""
                    }
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {isEditing
                      ? "Podés cambiar el número; debe ser único."
                      : suggestedNumber !== null
                        ? `Sugerido (max+1): #${suggestedNumber}. Podés sobrescribirlo.`
                        : "Calculando próximo correlativo..."}
                  </p>
                </div>
                {/* Perlado tricapa: flag por presupuesto. Se ve en el PDF
                    del cliente como "PERLADO TRICAPA" en bold uppercase. */}
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/40 px-3 py-2">
                  <Checkbox
                    id="perladoTricapa"
                    checked={perladoTricapa}
                    onCheckedChange={(c) => setPerladoTricapa(Boolean(c))}
                  />
                  <Label
                    htmlFor="perladoTricapa"
                    className="text-xs font-bold uppercase tracking-wider text-amber-800 cursor-pointer"
                  >
                    Perlado tricapa
                  </Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="validityDays" className="text-xs">
                      Validez (días)
                    </Label>
                    <Input
                      id="validityDays"
                      type="number"
                      min="1"
                      value={validityDays}
                      onChange={(e) => setValidityDays(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="deliveryDays" className="text-xs">
                      Entrega (días)
                    </Label>
                    <Input
                      id="deliveryDays"
                      type="number"
                      min="1"
                      value={deliveryDays}
                      onChange={(e) => setDeliveryDays(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="paymentCondition" className="text-xs">
                    Condición de pago
                  </Label>
                  <Input
                    id="paymentCondition"
                    value={paymentCondition}
                    onChange={(e) => setPaymentCondition(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="observations" className="text-xs">
                    Notas adicionales
                  </Label>
                  <Textarea
                    id="observations"
                    rows={3}
                    placeholder="Observaciones libres..."
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>

            {/* Footer de acciones (sticky al fondo del sidebar) */}
            <div className="border-t p-4 bg-muted/30 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !leadId}
                className="flex-1"
              >
                {saving ? "Guardando..." : "Guardar presupuesto"}
              </Button>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SelectGroupDivider({ label }: { label: string }) {
  return (
    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
      {label}
    </div>
  );
}

// =====================================================
// ConceptBlock
// =====================================================

function ConceptBlock({
  concept,
  index,
  onChange,
  onRemove,
}: {
  concept: ConceptDraft;
  index: number;
  onChange: (patch: Partial<ConceptDraft>) => void;
  onRemove: () => void;
}) {
  const def = CATEGORY_BY_KEY[concept.category];
  const subtotal = computeConceptSubtotal({
    type: concept.type,
    units: num(concept.units),
    unitValue: num(concept.unitValue),
    fixedAmount: num(concept.fixedAmount),
  });

  const typeBadgeClass =
    concept.type === "DESCRIPTIVO"
      ? "bg-blue-500/10 text-blue-700"
      : concept.type === "UNIDADES"
        ? "bg-purple-500/10 text-purple-700"
        : "bg-emerald-500/10 text-emerald-700";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
            {index + 1}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold">{def.label}</h4>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeBadgeClass}`}
              >
                {concept.type}
              </span>
            </div>
            {def.hint && (
              <p className="text-xs text-muted-foreground mt-0.5">{def.hint}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {concept.type !== "DESCRIPTIVO" && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Subtotal
              </div>
              <div className="font-medium">{ARS.format(subtotal)}</div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive"
            onClick={onRemove}
            aria-label="Quitar concepto"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {concept.type === "DESCRIPTIVO" && (
        <DescriptiveFields concept={concept} onChange={onChange} />
      )}
      {concept.type === "UNIDADES" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
          <div className="grid gap-1.5">
            <Label className="text-xs">Unidades</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={concept.units}
              onChange={(e) => onChange({ units: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Valor unitario</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={concept.unitValue}
              onChange={(e) => onChange({ unitValue: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Total calculado
            </Label>
            <div className="h-9 px-3 rounded-md border bg-muted/40 flex items-center font-medium">
              {ARS.format(subtotal)}
            </div>
          </div>
        </div>
      )}
      {concept.type === "FIJO" && (
        <div className="space-y-3 pt-2 border-t">
          {concept.category === "OTROS_ADICIONALES" && (
            <div className="grid gap-1.5">
              <Label className="text-xs">Descripción</Label>
              <Textarea
                rows={2}
                placeholder="Detalle del adicional..."
                value={concept.fixedDescription}
                onChange={(e) => onChange({ fixedDescription: e.target.value })}
              />
            </div>
          )}
          <div className="grid gap-1.5 max-w-xs">
            <Label className="text-xs">{def.fixedLabel ?? "Importe"}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={concept.fixedAmount}
              onChange={(e) => onChange({ fixedAmount: e.target.value })}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function DescriptiveFields({
  concept,
  onChange,
}: {
  concept: ConceptDraft;
  onChange: (patch: Partial<ConceptDraft>) => void;
}) {
  const baseId = useId();
  const groups = SUBDETAILS[concept.category] ?? [];
  const customs = concept.subdetails.filter(isCustomSubdetail);
  const [newCustom, setNewCustom] = useState("");

  const toggle = (key: string, checked: boolean) => {
    const set = new Set(concept.subdetails);
    if (checked) set.add(key);
    else set.delete(key);
    onChange({ subdetails: [...set] });
  };

  const addCustom = () => {
    const label = newCustom.trim();
    if (!label) return;
    const key = makeCustomSubdetailKey(label);
    if (concept.subdetails.includes(key)) {
      setNewCustom("");
      return;
    }
    onChange({ subdetails: [...concept.subdetails, key] });
    setNewCustom("");
  };

  const removeCustom = (key: string) => {
    onChange({ subdetails: concept.subdetails.filter((k) => k !== key) });
  };

  return (
    <div className="space-y-4 pt-2 border-t">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Subdetalles — {concept.subdetails.length} seleccionados
        </span>
        {concept.subdetails.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange({ subdetails: [] })}
          >
            Deseleccionar todo
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
        {groups.map((group) => (
          <div key={group.title} className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const checked = concept.subdetails.includes(item.key);
                const id = `${baseId}-${item.key}`;
                return (
                  <label
                    key={item.key}
                    htmlFor={id}
                    className={`flex items-start gap-2 text-sm cursor-pointer px-2 py-1 rounded-md transition-colors ${
                      checked ? "bg-primary/5" : "hover:bg-muted"
                    }`}
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(c) => toggle(item.key, Boolean(c))}
                      className="mt-0.5"
                    />
                    <span className="leading-tight">{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* Opciones personalizadas: el usuario agrega items que no están en el catálogo.
          Se guardan inline en `subdetails` con el prefijo `custom:` (ver budget-catalog.ts). */}
      <div className="space-y-2 pt-2 border-t">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Opciones personalizadas
        </div>
        {customs.length > 0 && (
          <ul className="space-y-1">
            {customs.map((key) => (
              <li
                key={key}
                className="flex items-start gap-2 text-sm px-2 py-1 rounded-md bg-primary/5"
              >
                <Checkbox checked className="mt-0.5" disabled />
                <span className="flex-1 leading-tight">
                  {customSubdetailLabel(key)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive"
                  onClick={() => removeCustom(key)}
                  aria-label="Quitar opción"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            value={newCustom}
            placeholder="Escribir opción que no está en la lista…"
            onChange={(e) => setNewCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustom}
            disabled={!newCustom.trim()}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>
      </div>
      <div className="grid gap-1.5 pt-2 border-t">
        <Label htmlFor={`${baseId}-detalle`} className="text-xs">
          Detalle adicional
        </Label>
        <Textarea
          id={`${baseId}-detalle`}
          rows={2}
          placeholder="Especificar otro / detalles libres..."
          value={concept.additionalDetail}
          onChange={(e) => onChange({ additionalDetail: e.target.value })}
        />
      </div>
    </div>
  );
}

// =====================================================
// PartAutocomplete — input con popover que consulta /api/parts
// - Si el user selecciona una parte del catálogo → se linkea vía partId.
// - Si escribe libre → el text se guarda pero partId queda null.
// =====================================================

function PartAutocomplete({
  value,
  partId,
  onChangeText,
  onSelect,
}: {
  value: string;
  partId: string | null;
  onChangeText: (text: string) => void;
  onSelect: (part: CatalogPart) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogPart[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ active: "1", limit: "20" });
        if (query) params.set("search", query);
        const res = await fetch(`/api/parts?${params}`, { signal: ac.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { parts: CatalogPart[] };
        setResults(data.parts);
      } catch {
        /* abort */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      ac.abort();
      clearTimeout(t);
    };
  }, [query, open]);

  return (
    <div className="flex gap-1.5">
      <Input
        value={value}
        placeholder="Descripción o buscar en catálogo…"
        onChange={(e) => onChangeText(e.target.value)}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`shrink-0 px-2 ${partId ? "border-primary/40 bg-primary/5" : ""}`}
            title={partId ? "Vinculado al catálogo" : "Buscar en el catálogo"}
          >
            {partId ? (
              <Package className="h-4 w-4 text-primary" />
            ) : (
              <ChevronsUpDown className="h-4 w-4" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[28rem] p-0" align="end">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por nombre, SKU, marca…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Buscando…
                </div>
              )}
              {!loading && results.length === 0 && (
                <CommandEmpty>
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    Sin resultados. Podés escribir libremente en el campo.
                  </div>
                </CommandEmpty>
              )}
              {!loading && results.length > 0 && (
                <CommandGroup>
                  {results.map((part) => {
                    const low = Number(part.stockQty) <= Number(part.stockMin);
                    return (
                      <CommandItem
                        key={part.id}
                        value={part.id}
                        onSelect={() => {
                          onSelect(part);
                          setOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            partId === part.id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {part.name}
                          </div>
                          <div className="text-xs opacity-70 flex items-center gap-2">
                            {part.sku && (
                              <span className="font-mono">{part.sku}</span>
                            )}
                            {part.brand && <span>· {part.brand}</span>}
                            <span>· Stock: {Number(part.stockQty)}</span>
                            {low && (
                              <span className="text-orange-600">bajo</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs font-medium ml-2">
                          {ARS.format(Number(part.salePrice))}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
