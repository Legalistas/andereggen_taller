"use client";

import {
  AlertCircle,
  Briefcase,
  Check,
  Loader2,
  Mail,
  Send,
  Shield,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Recipient = {
  role: "customer" | "inspector" | "insurance" | "other";
  name: string | null;
  email: string;
};

type Actor = { id: string; name: string | null; email: string | null } | null;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  budgetId: string | null;
  budgetNumber?: number;
  customer: { name: string; email: string };
  inspector: Actor;
  insuranceAgent: Actor;
  onSent?: () => void;
};

type RoleKey = "customer" | "inspector" | "insurance";

const ROLE_META: Record<
  RoleKey,
  { label: string; icon: typeof UserIcon; tint: string; bg: string }
> = {
  customer: {
    label: "Cliente",
    icon: UserIcon,
    tint: "text-[#003b73]",
    bg: "bg-[#003b73]/10",
  },
  inspector: {
    label: "Perito / Inspector",
    icon: Shield,
    tint: "text-cyan-700",
    bg: "bg-cyan-50",
  },
  insurance: {
    label: "Productor de seguros",
    icon: Briefcase,
    tint: "text-emerald-700",
    bg: "bg-emerald-50",
  },
};

export function SendBudgetDialog({
  open,
  onOpenChange,
  budgetId,
  budgetNumber,
  customer,
  inspector,
  insuranceAgent,
  onSent,
}: Props) {
  const [selected, setSelected] = useState<Record<RoleKey, boolean>>({
    customer: true,
    inspector: true,
    insurance: true,
  });
  const [others, setOthers] = useState<string[]>([]);
  const [newOther, setNewOther] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    ok: boolean;
    items: Array<{ email: string; ok: boolean; error?: string }>;
  } | null>(null);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setSelected({
        customer: !!customer.email,
        inspector: !!inspector?.email,
        insurance: !!insuranceAgent?.email,
      });
      setOthers([]);
      setNewOther("");
      setCustomMessage("");
      setError(null);
      setResult(null);
    }
  }, [open, customer.email, inspector?.email, insuranceAgent?.email]);

  const addOther = () => {
    const v = newOther.trim();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError(`"${v}" no es un email válido.`);
      return;
    }
    if (others.includes(v)) return;
    setOthers((prev) => [...prev, v]);
    setNewOther("");
    setError(null);
  };

  const buildRecipients = (): Recipient[] => {
    const list: Recipient[] = [];
    if (selected.customer && customer.email) {
      list.push({
        role: "customer",
        name: customer.name,
        email: customer.email,
      });
    }
    if (selected.inspector && inspector?.email) {
      list.push({
        role: "inspector",
        name: inspector.name,
        email: inspector.email,
      });
    }
    if (selected.insurance && insuranceAgent?.email) {
      list.push({
        role: "insurance",
        name: insuranceAgent.name,
        email: insuranceAgent.email,
      });
    }
    for (const e of others) {
      list.push({ role: "other", name: null, email: e });
    }
    return list;
  };

  const handleSend = async () => {
    if (!budgetId) return;
    const recipients = buildRecipients();
    if (recipients.length === 0) {
      setError("Seleccioná al menos un destinatario.");
      return;
    }
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/budgets/${budgetId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients,
          customMessage: customMessage.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult({
        ok: !!body.ok,
        items: (body.results ?? []).map(
          (r: { email: string; ok: boolean; error?: string }) => ({
            email: r.email,
            ok: r.ok,
            error: r.error,
          }),
        ),
      });
      if (body.ok) onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  const recipientCount = buildRecipients().length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-[#003b73]" />
            Enviar presupuesto
            {budgetNumber ? (
              <span className="font-mono text-muted-foreground text-sm">
                #{budgetNumber}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Se envía por email con el PDF adjunto. Podés agregar destinatarios
            externos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {/* Actores del lead */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Destinatarios
            </Label>
            <ActorRow
              roleKey="customer"
              name={customer.name}
              email={customer.email}
              checked={selected.customer}
              onChange={(v) => setSelected((s) => ({ ...s, customer: v }))}
              disabled={!customer.email}
            />
            <ActorRow
              roleKey="inspector"
              name={inspector?.name ?? null}
              email={inspector?.email ?? null}
              checked={selected.inspector}
              onChange={(v) => setSelected((s) => ({ ...s, inspector: v }))}
              disabled={!inspector?.email}
            />
            <ActorRow
              roleKey="insurance"
              name={insuranceAgent?.name ?? null}
              email={insuranceAgent?.email ?? null}
              checked={selected.insurance}
              onChange={(v) => setSelected((s) => ({ ...s, insurance: v }))}
              disabled={!insuranceAgent?.email}
            />
          </div>

          {/* Otros destinatarios */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Otros
            </Label>
            {others.length > 0 ? (
              <div className="space-y-1">
                {others.map((e) => (
                  <div
                    key={e}
                    className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-md text-sm"
                  >
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="flex-1 truncate">{e}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setOthers((prev) => prev.filter((x) => x !== e))
                      }
                      className="h-6 w-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="otro@email.com"
                value={newOther}
                onChange={(e) => setNewOther(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOther();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addOther}>
                Agregar
              </Button>
            </div>
          </div>

          {/* Mensaje custom */}
          <div className="space-y-1.5">
            <Label
              htmlFor="customMessage"
              className="text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Mensaje personalizado (opcional)
            </Label>
            <Textarea
              id="customMessage"
              rows={3}
              placeholder="Ej: Hola, te envío la cotización actualizada después de la inspección…"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="resize-none"
            />
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {result ? (
            <div
              className={`rounded-md border px-3 py-2 text-sm space-y-1 ${
                result.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              <p className="font-medium flex items-center gap-1">
                {result.ok ? (
                  <>
                    <Check className="h-4 w-4" /> Envío registrado
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" /> Falló el envío
                  </>
                )}
              </p>
              <ul className="text-[11px] space-y-0.5">
                {result.items.map((r) => (
                  <li key={r.email} className="flex items-start gap-1.5">
                    {r.ok ? (
                      <Check className="h-3 w-3 mt-0.5 text-emerald-600 shrink-0" />
                    ) : (
                      <X className="h-3 w-3 mt-0.5 text-rose-600 shrink-0" />
                    )}
                    <span className="font-mono">{r.email}</span>
                    {r.error ? (
                      <span className="text-muted-foreground">— {r.error}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            {result?.ok ? "Cerrar" : "Cancelar"}
          </Button>
          {!result?.ok ? (
            <Button
              onClick={handleSend}
              disabled={sending || recipientCount === 0}
              className="gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar a {recipientCount}{" "}
                  {recipientCount === 1 ? "destinatario" : "destinatarios"}
                </>
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActorRow({
  roleKey,
  name,
  email,
  checked,
  onChange,
  disabled,
}: {
  roleKey: RoleKey;
  name: string | null;
  email: string | null;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const meta = ROLE_META[roleKey];
  const Icon = meta.icon;
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: el Checkbox de shadcn usa un button (Radix), no un input, pero igual queda asociado al click del label
    <label
      className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors cursor-pointer ${
        disabled
          ? "border-slate-100 bg-slate-50 cursor-not-allowed opacity-60"
          : checked
            ? "border-[#003b73]/30 bg-[#003b73]/5"
            : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        disabled={disabled}
      />
      <div
        className={`h-8 w-8 rounded-md ${meta.bg} flex items-center justify-center shrink-0`}
      >
        <Icon className={`h-4 w-4 ${meta.tint}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {meta.label}
        </p>
        {email ? (
          <p className="text-sm font-medium text-slate-900 truncate">
            {name ?? email}
            <span className="text-xs text-muted-foreground ml-1">
              · {email}
            </span>
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic">Sin asignar</p>
        )}
      </div>
    </label>
  );
}
