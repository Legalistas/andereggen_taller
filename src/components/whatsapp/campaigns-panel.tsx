"use client";

import { Loader2, RotateCw, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatWaId } from "@/lib/whatsapp/parse";
import { useLists } from "./lists-panel";
import {
  type TemplateChoice,
  TemplatePicker,
  useTemplates,
} from "./template-picker";

type Campaign = {
  id: string;
  name: string;
  templateName: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  list: { name: string } | null;
  createdBy: { name: string } | null;
  counts: Record<string, number>;
  entregados: number;
  leidos: number;
  noEntregados: number;
};

const WHEN = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Argentina/Buenos_Aires",
});

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json;
}

/** Lanzar una plantilla a una lista y seguir el avance del envío. */
export function CampaignsPanel() {
  const { lists } = useLists();
  const { templates, error: templatesError } = useTemplates();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [listId, setListId] = useState("");
  const [choice, setChoice] = useState<TemplateChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/whatsapp/campaigns");
    if (res.ok) setCampaigns((await res.json()).data ?? []);
  }, []);

  const sending = campaigns.some((c) => c.status === "enviando");
  useEffect(() => {
    load();
    const poll = setInterval(load, sending ? 5_000 : 30_000);
    return () => clearInterval(poll);
  }, [load, sending]);

  const list = lists.find((l) => l.id === listId);

  const launch = async () => {
    if (
      !window.confirm(
        `¿Mandar "${name}" a ${list?._count.members ?? 0} contactos de la lista "${list?.name}"? No se puede deshacer.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/whatsapp/campaigns", {
        name,
        listId,
        templateSid: choice?.sid,
        variables: choice?.variables ?? {},
      });
      setName("");
      setChoice(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Nueva campaña</h3>
        {templatesError && (
          <p className="text-xs text-red-600">{templatesError}</p>
        )}
        <div className="grid gap-1">
          <Label htmlFor="camp-name">Nombre</Label>
          <Input
            id="camp-name"
            value={name}
            placeholder="Saludo fin de año 2026"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label>Lista</Label>
          <Select value={listId} onValueChange={setListId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Elegí una lista" />
            </SelectTrigger>
            <SelectContent>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} ({l._count.members})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label>Plantilla</Label>
          <TemplatePicker
            templates={templates}
            value={choice}
            onChange={setChoice}
            hint="Escribí {nombre} para poner el nombre de cada contacto."
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button
          onClick={launch}
          disabled={busy || !name.trim() || !listId || !choice?.sid}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Lanzar campaña
        </Button>
        <p className="text-[11px] text-slate-500">
          Los que escribieron BAJA no la reciben. Las respuestas llegan a la
          bandeja de Conversaciones.
        </p>
      </div>

      <div className="grid content-start gap-3">
        {campaigns.length === 0 && (
          <p className="text-sm text-slate-500">Todavía no hay campañas.</p>
        )}
        {campaigns.map((c) => (
          <CampaignCard key={c.id} c={c} onResumed={load} />
        ))}
      </div>
    </div>
  );
}

function CampaignCard({
  c,
  onResumed,
}: {
  c: Campaign;
  onResumed: () => void;
}) {
  const [errors, setErrors] = useState<
    | {
        detail: string | null;
        contact: { waId: string; name: string | null };
      }[]
    | null
  >(null);
  const [busy, setBusy] = useState(false);
  const n = (k: string) => c.counts[k] ?? 0;
  const total = Object.values(c.counts).reduce((a, b) => a + b, 0);
  const done = n("enviado") + n("omitido") + n("error");
  const retryable = n("pendiente") + n("error");

  const resume = async () => {
    setBusy(true);
    await post(`/api/whatsapp/campaigns/${c.id}/resume`).catch(() => {});
    setBusy(false);
    onResumed();
  };

  const showErrors = async () => {
    const res = await fetch(`/api/whatsapp/campaigns/${c.id}`);
    if (res.ok) setErrors((await res.json()).errors ?? []);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{c.name}</p>
          <p className="text-xs text-slate-500">
            {c.templateName} · {c.list?.name ?? "lista borrada"} ·{" "}
            {WHEN.format(new Date(c.createdAt))}
            {c.createdBy && ` · ${c.createdBy.name}`}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.status === "enviando" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
        >
          {c.status === "enviando" ? `Enviando ${done}/${total}` : "Enviada"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
        {[
          ["Enviados", n("enviado")],
          ["Entregados", c.entregados],
          ["Leídos", c.leidos],
          ["No entregados", c.noEntregados],
          ["Con error", n("error")],
          ["Omitidos", n("omitido")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-slate-50 px-2 py-1.5">
            <dt className="text-[10px] uppercase tracking-wide text-slate-500">
              {label}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-slate-900">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {retryable > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={resume}
          >
            <RotateCw className="h-3.5 w-3.5" />
            Reanudar ({retryable} pendientes o con error)
          </Button>
        )}
        {n("error") > 0 && (
          <Button size="sm" variant="ghost" onClick={showErrors}>
            Ver errores
          </Button>
        )}
      </div>
      {errors && (
        <ul className="mt-2 grid gap-1 text-xs">
          {errors.map((e) => (
            <li key={e.contact.waId} className="text-slate-600">
              {e.contact.name ?? "Sin nombre"} · {formatWaId(e.contact.waId)}:{" "}
              <span className="text-red-600">{e.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
