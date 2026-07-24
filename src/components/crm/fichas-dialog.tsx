"use client";

/**
 * Dialog "Fichas" — abre desde la fila del presupuesto y permite imprimir
 * dos documentos internos:
 *
 *   1. Ficha Técnica  — se pega en el auto al ingresar al taller.
 *   2. Ficha de Ingreso/Egreso — la firma el cliente.
 *
 * Ambas se pre-rellenan desde los datos del budget. La UI permite editar
 * los campos antes de imprimir; las ediciones son **efímeras** (no se
 * guardan en DB salvo que ya estén persistidos en el modelo, p.ej. color
 * del vehículo se guarda al editar desde el lead canvas).
 *
 * Al hacer click en "Generar PDF" se hace POST con los overrides y se abre
 * el PDF en una nueva pestaña para que el usuario lo descargue/imprima.
 */

import { ClipboardCheck, FileText, Plus, Printer, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CATEGORY_BY_KEY,
  subdetailLabel,
} from "@/lib/budget-catalog";
import type { ConceptCategory } from "../../../generated/prisma/client";

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

type FichaSection = { title: string; bullets: string[] };

type SavedTecnica = {
  color: string | null;
  sections: FichaSection[];
};
type SavedIngreso = {
  date: string;
  insurance: string;
  technicalInsurance: string;
  franchiseAmount: string;
  franchiseLabel: string;
  paymentCondition: string;
  customerName: string;
  customerAddress: string;
  customerLocality: string;
  customerPhone: string;
};

type BudgetForFichas = {
  id: string;
  number: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleDomain: string;
  vehicleInsurance: string | null;
  insuranceFranchise: string | number | null;
  paymentCondition: string;
  concepts: Array<{
    type: "DESCRIPTIVO" | "UNIDADES" | "FIJO";
    category: string;
    subdetails: string[];
    additionalDetail: string | null;
  }>;
  lead: {
    customer: { city: string | null; address: string | null };
    vehicle: { color: string | null; thirdPartySecure: string | null } | null;
  };
  /** spec v2 · Ediciones previas guardadas de este mismo diálogo. */
  fichasOverrides: {
    tecnica?: SavedTecnica;
    ingreso?: SavedIngreso;
  } | null;
};

type Props = {
  budgetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FichasDialog({ budgetId, open, onOpenChange }: Props) {
  const [budget, setBudget] = useState<BudgetForFichas | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Overrides Ficha Técnica
  const [color, setColor] = useState("");
  const [sections, setSections] = useState<FichaSection[]>([]);

  // Overrides Ficha Ingreso
  const [date, setDate] = useState("");
  const [insurance, setInsurance] = useState("");
  const [techInsurance, setTechInsurance] = useState("");
  const [franchiseAmount, setFranchiseAmount] = useState("");
  const [franchiseLabel, setFranchiseLabel] = useState("");
  const [paymentCondition, setPaymentCondition] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerLocality, setCustomerLocality] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const todayDDMMYYYY = useCallback(() => {
    return new Date().toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, []);

  // Carga el budget al abrir y rellena overrides con defaults
  useEffect(() => {
    if (!open || !budgetId) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch(`/api/budgets/${budgetId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.budget) return;
        const b = data.budget as BudgetForFichas;
        setBudget(b);

        // spec v2 · Prefill con ediciones previas si existen; si no, defaults
        // derivados del budget/vehículo. Cada tab se prefill independiente.
        const savedTecnica = b.fichasOverrides?.tecnica;
        if (savedTecnica) {
          setColor(savedTecnica.color ?? "");
          setSections(savedTecnica.sections);
        } else {
          setColor(b.lead.vehicle?.color ?? "");
          const initialSections: FichaSection[] = [];
          for (const c of b.concepts) {
            if (c.type !== "DESCRIPTIVO") continue;
            const cat = c.category as ConceptCategory;
            const def = CATEGORY_BY_KEY[cat];
            const title = (
              def?.label ?? c.category.replaceAll("_", " ")
            ).toUpperCase();
            const bullets = c.subdetails.map((k) => subdetailLabel(cat, k));
            if (c.additionalDetail?.trim()) {
              bullets.push(c.additionalDetail.trim());
            }
            if (bullets.length > 0) {
              initialSections.push({ title, bullets });
            }
          }
          setSections(initialSections);
        }

        const savedIngreso = b.fichasOverrides?.ingreso;
        if (savedIngreso) {
          setDate(savedIngreso.date);
          setInsurance(savedIngreso.insurance);
          setTechInsurance(savedIngreso.technicalInsurance);
          setFranchiseAmount(savedIngreso.franchiseAmount);
          setFranchiseLabel(savedIngreso.franchiseLabel);
          setPaymentCondition(savedIngreso.paymentCondition);
          setCustomerName(savedIngreso.customerName);
          setCustomerAddress(savedIngreso.customerAddress);
          setCustomerLocality(savedIngreso.customerLocality);
          setCustomerPhone(savedIngreso.customerPhone);
        } else {
          setDate(todayDDMMYYYY());
          setInsurance(b.vehicleInsurance ?? "");
          setTechInsurance(b.lead.vehicle?.thirdPartySecure ?? "");
          setFranchiseAmount(
            b.insuranceFranchise !== null
              ? ARS.format(Number(b.insuranceFranchise))
              : "-",
          );
          // Default del label: si hay seguro o franquicia cargados, asumimos
          // caso por seguro. Si no, caso particular (sin "de franquicia").
          const isFranchiseCase =
            !!b.vehicleInsurance || b.insuranceFranchise !== null;
          setFranchiseLabel(
            isFranchiseCase
              ? "Monto de franquicia a abonar en efectivo al retirar el rodado:"
              : "Monto a abonar en efectivo al retirar el rodado:",
          );
          setPaymentCondition(b.paymentCondition);
          setCustomerName(b.customerName);
          const addr =
            b.customerAddress && b.customerAddress !== "-"
              ? b.customerAddress
              : (b.lead.customer.address ?? "");
          setCustomerAddress(addr);
          setCustomerLocality(b.lead.customer.city ?? "");
          setCustomerPhone(b.customerPhone);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Error al cargar el budget");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, budgetId, todayDDMMYYYY]);

  // spec v2 · Persistimos los overrides en el budget para que reabrir el
  // dialog muestre las últimas ediciones. Se llama al generar el PDF y
  // también desde el botón explícito "Guardar cambios".
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const saveOverrides = async (
    which: "tecnica" | "ingreso",
    silent = false,
  ) => {
    if (!budgetId) return;
    const payload: {
      tecnica?: SavedTecnica;
      ingreso?: SavedIngreso;
    } = {};
    if (which === "tecnica") {
      payload.tecnica = {
        color: color.trim() || null,
        sections: sections.map((s) => ({
          title: s.title.trim(),
          bullets: s.bullets.map((b) => b.trim()).filter((b) => b !== ""),
        })),
      };
    } else {
      payload.ingreso = {
        date: date.trim(),
        insurance: insurance.trim(),
        technicalInsurance: techInsurance.trim(),
        franchiseAmount: franchiseAmount.trim(),
        franchiseLabel: franchiseLabel.trim(),
        paymentCondition: paymentCondition.trim(),
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim(),
        customerLocality: customerLocality.trim(),
        customerPhone: customerPhone.trim(),
      };
    }
    if (!silent) setSaveState("saving");
    try {
      const res = await fetch(
        `/api/budgets/${budgetId}/fichas-overrides`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!silent) {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      }
    } catch (e) {
      if (!silent) {
        setSaveState("idle");
        alert(
          e instanceof Error
            ? `No se pudieron guardar los cambios: ${e.message}`
            : "No se pudieron guardar los cambios",
        );
      }
    }
  };

  const generate = async (
    kind: "ficha-tecnica" | "ficha-ingreso",
    body: object,
  ) => {
    if (!budgetId) return;
    try {
      const res = await fetch(`/api/budgets/${budgetId}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Liberamos el URL después de un rato (la pestaña ya lo cargó).
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo generar el PDF");
    }
  };

  const generateTecnica = async () => {
    const body = {
      color: color.trim() || null,
      sections: sections.map((s) => ({
        title: s.title.trim(),
        bullets: s.bullets.map((b) => b.trim()).filter((b) => b !== ""),
      })),
    };
    // Persistimos en background antes de abrir el PDF — así reabrir el
    // dialog trae los mismos datos que salieron impresos.
    saveOverrides("tecnica", true);
    generate("ficha-tecnica", body);
  };

  const generateIngreso = async () => {
    const body = {
      date: date.trim(),
      insurance: insurance.trim(),
      technicalInsurance: techInsurance.trim(),
      franchiseAmount: franchiseAmount.trim(),
      franchiseLabel: franchiseLabel.trim(),
      paymentCondition: paymentCondition.trim(),
      customerName: customerName.trim(),
      customerAddress: customerAddress.trim(),
      customerLocality: customerLocality.trim(),
      customerPhone: customerPhone.trim(),
    };
    saveOverrides("ingreso", true);
    generate("ficha-ingreso", body);
  };

  // ── Editor de secciones de la Ficha Técnica ────────────────────────────

  const addSection = () => {
    setSections((prev) => [...prev, { title: "", bullets: [""] }]);
  };
  const removeSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateSectionTitle = (idx: number, value: string) => {
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, title: value } : s)),
    );
  };
  const addBullet = (sIdx: number) => {
    setSections((prev) =>
      prev.map((s, i) => (i === sIdx ? { ...s, bullets: [...s.bullets, ""] } : s)),
    );
  };
  const updateBullet = (sIdx: number, bIdx: number, value: string) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sIdx
          ? {
              ...s,
              bullets: s.bullets.map((b, j) => (j === bIdx ? value : b)),
            }
          : s,
      ),
    );
  };
  const removeBullet = (sIdx: number, bIdx: number) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sIdx
          ? { ...s, bullets: s.bullets.filter((_, j) => j !== bIdx) }
          : s,
      ),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-3xl w-[95vw] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden"
      >
        <header className="px-6 py-4 border-b bg-card shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#003b73]/10 flex items-center justify-center">
              <Printer className="h-5 w-5 text-[#003b73]" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Fichas
                {budget && (
                  <span className="text-base font-medium text-slate-500 ml-2">
                    #{budget.number}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Documentos internos para imprimir. Editá lo que necesites y
                guardá — los cambios quedan asociados al presupuesto y se
                cargan la próxima vez que abras el diálogo.
              </DialogDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto bg-muted/20">
          {loading && !budget && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Cargando…
            </div>
          )}
          {err && (
            <div className="m-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

          {budget && (
            <Tabs defaultValue="tecnica" className="w-full">
              <TabsList className="m-4 mb-0">
                <TabsTrigger value="tecnica" className="gap-1.5">
                  <FileText className="h-4 w-4" /> Ficha Técnica
                </TabsTrigger>
                <TabsTrigger value="ingreso" className="gap-1.5">
                  <ClipboardCheck className="h-4 w-4" /> Ficha Ingreso/Egreso
                </TabsTrigger>
              </TabsList>

              {/* ─── FICHA TÉCNICA ─────────────────────────────────────── */}
              <TabsContent value="tecnica" className="p-4 space-y-4">
                <div className="rounded-lg border bg-white p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Vehículo</Label>
                      <Input
                        readOnly
                        value={`${budget.vehicleBrand} ${budget.vehicleModel}`}
                        className="bg-slate-50"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Color</Label>
                      <Input
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        placeholder="Ej: Blanco"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">
                      Detalle del trabajo
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addSection}
                      className="gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Agregar sección
                    </Button>
                  </div>

                  {sections.length === 0 && (
                    <div className="rounded-lg border border-dashed bg-white p-6 text-center text-xs text-muted-foreground">
                      Sin secciones. Agregá una arriba o cerrá y agregá conceptos
                      descriptivos al presupuesto.
                    </div>
                  )}

                  {sections.map((sec, sIdx) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: orden estable mientras se edita
                      key={sIdx}
                      className="rounded-lg border bg-white p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={sec.title}
                          onChange={(e) =>
                            updateSectionTitle(sIdx, e.target.value)
                          }
                          placeholder="TÍTULO DE SECCIÓN"
                          className="font-semibold uppercase"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => removeSection(sIdx)}
                          aria-label="Quitar sección"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-1.5 pl-3">
                        {sec.bullets.map((b, bIdx) => (
                          <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: orden estable
                            key={bIdx}
                            className="flex items-center gap-2"
                          >
                            <span className="text-slate-400">•</span>
                            <Input
                              value={b}
                              onChange={(e) =>
                                updateBullet(sIdx, bIdx, e.target.value)
                              }
                              placeholder="Texto del bullet"
                              className="text-sm"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() => removeBullet(sIdx, bIdx)}
                              aria-label="Quitar bullet"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => addBullet(sIdx)}
                          className="gap-1 text-xs"
                        >
                          <Plus className="h-3 w-3" /> Agregar item
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => saveOverrides("tecnica")}
                    disabled={saveState === "saving"}
                    className="gap-2"
                  >
                    {saveState === "saved"
                      ? "✓ Guardado"
                      : saveState === "saving"
                        ? "Guardando…"
                        : "Guardar cambios"}
                  </Button>
                  <Button onClick={generateTecnica} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Generar PDF Ficha Técnica
                  </Button>
                </div>
              </TabsContent>

              {/* ─── FICHA INGRESO/EGRESO ──────────────────────────────── */}
              <TabsContent value="ingreso" className="p-4 space-y-4">
                <div className="rounded-lg border bg-white p-4 space-y-3">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Datos del cliente
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Fecha</Label>
                      <Input
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Titular</Label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Dirección</Label>
                      <Input
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Localidad</Label>
                      <Input
                        value={customerLocality}
                        onChange={(e) => setCustomerLocality(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5 col-span-2">
                      <Label className="text-xs">Teléfono</Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-700">
                    Resaltados (los más cambiantes)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Seguro</Label>
                      <Input
                        value={insurance}
                        onChange={(e) => setInsurance(e.target.value)}
                        placeholder="Compañía aseguradora"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Seg. Técnico</Label>
                      <Input
                        value={techInsurance}
                        onChange={(e) => setTechInsurance(e.target.value)}
                        placeholder="Compañía del tercero"
                      />
                    </div>
                    <div className="grid gap-1.5 col-span-2">
                      <Label className="text-xs">Monto franquicia</Label>
                      <Input
                        value={franchiseAmount}
                        onChange={(e) => setFranchiseAmount(e.target.value)}
                        placeholder="$ 250.000,00 o '-' si no aplica"
                      />
                    </div>
                    <div className="grid gap-1.5 col-span-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">
                          Texto del monto (franquicia / particular)
                        </Label>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={() =>
                              setFranchiseLabel(
                                "Monto de franquicia a abonar en efectivo al retirar el rodado:",
                              )
                            }
                          >
                            Franquicia
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={() =>
                              setFranchiseLabel(
                                "Monto a abonar en efectivo al retirar el rodado:",
                              )
                            }
                          >
                            Particular
                          </Button>
                        </div>
                      </div>
                      <Input
                        value={franchiseLabel}
                        onChange={(e) => setFranchiseLabel(e.target.value)}
                        placeholder="Texto que precede al monto"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-4 space-y-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Condición de pago</Label>
                    <Input
                      value={paymentCondition}
                      onChange={(e) => setPaymentCondition(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => saveOverrides("ingreso")}
                    disabled={saveState === "saving"}
                    className="gap-2"
                  >
                    {saveState === "saved"
                      ? "✓ Guardado"
                      : saveState === "saving"
                        ? "Guardando…"
                        : "Guardar cambios"}
                  </Button>
                  <Button onClick={generateIngreso} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Generar PDF Ficha Ingreso/Egreso
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
