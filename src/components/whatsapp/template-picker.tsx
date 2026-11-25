"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Plantilla, rellenar } from "@/lib/whatsapp/parse";

export type TemplateChoice = { sid: string; variables: Record<string, string> };

/** Plantillas del Taller aprobadas (prefijo taller_), cargadas una vez. */
export function useTemplates() {
  const [templates, setTemplates] = useState<Plantilla[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/whatsapp/templates")
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
        setTemplates(body.data ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);
  return { templates, error };
}

/** Elegir plantilla, completar sus variables y ver cómo le llega al cliente. */
export function TemplatePicker({
  templates,
  value,
  onChange,
  hint,
}: {
  templates: Plantilla[];
  value: TemplateChoice | null;
  onChange: (v: TemplateChoice) => void;
  hint?: string;
}) {
  const selected = templates.find((t) => t.sid === value?.sid);
  return (
    <div className="grid gap-2">
      <Select
        value={value?.sid ?? ""}
        onValueChange={(sid) => onChange({ sid, variables: {} })}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Elegí una plantilla aprobada" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.sid} value={t.sid}>
              {t.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && (
        <>
          {selected.variables.map((v) => (
            <div key={v.key} className="grid gap-1">
              <Label className="text-[11px] text-slate-500">
                Variable {`{{${v.key}}}`}
              </Label>
              <Input
                className="h-8"
                value={value?.variables[v.key] ?? ""}
                placeholder={v.ejemplo || undefined}
                onChange={(e) =>
                  onChange({
                    sid: selected.sid,
                    variables: { ...value?.variables, [v.key]: e.target.value },
                  })
                }
              />
            </div>
          ))}
          {hint && selected.variables.length > 0 && (
            <p className="text-[11px] text-slate-500">{hint}</p>
          )}
          <p className="whitespace-pre-wrap rounded-md bg-emerald-50 px-3 py-2 text-xs text-slate-700">
            {rellenar(selected.texto, value?.variables ?? {})}
          </p>
        </>
      )}
    </div>
  );
}
