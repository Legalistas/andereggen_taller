"use client";

import { Loader2, Plus, Trash2, Upload, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatWaId } from "@/lib/whatsapp/parse";

export type WaList = {
  id: string;
  name: string;
  _count: { members: number };
};

type Member = {
  id: string;
  waId: string;
  name: string | null;
  profileName: string | null;
  optOutAt: string | null;
};

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json;
}

export function useLists() {
  const [lists, setLists] = useState<WaList[]>([]);
  const reload = useCallback(async () => {
    const res = await fetch("/api/whatsapp/lists");
    if (res.ok) setLists((await res.json()).data ?? []);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { lists, reload };
}

/** Listas de difusión: armarlas pegando contactos, con un CSV o con los clientes. */
export function ListsPanel() {
  const { lists, reload } = useLists();
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    try {
      const { id } = await call("/api/whatsapp/lists", "POST", {
        name: newName,
      });
      setNewName("");
      await reload();
      setSelected(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  const current = lists.find((l) => l.id === selected);

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <div className="grid content-start gap-2">
        <div className="flex gap-2">
          <Input
            className="h-9"
            placeholder="Nueva lista"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && create()}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Crear lista"
            disabled={!newName.trim()}
            onClick={create}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <ul className="grid gap-1">
          {lists.length === 0 && (
            <li className="text-xs text-slate-500">Todavía no hay listas.</li>
          )}
          {lists.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setSelected(l.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${selected === l.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
              >
                <span className="truncate">{l.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                  <Users className="h-3 w-3" />
                  {l._count.members}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {current ? (
        <ListDetail
          key={current.id}
          list={current}
          onChange={reload}
          onDeleted={() => {
            setSelected(null);
            reload();
          }}
        />
      ) : (
        <p className="text-sm text-slate-500">
          Elegí una lista o creá una nueva para cargarle contactos.
        </p>
      )}
    </div>
  );
}

function ListDetail({
  list,
  onChange,
  onDeleted,
}: {
  list: WaList;
  onChange: () => void;
  onDeleted: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/whatsapp/lists/${list.id}`);
    if (res.ok) setMembers((await res.json()).data ?? []);
  }, [list.id]);
  useEffect(() => {
    load();
  }, [load]);

  const add = async (body: unknown) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await call(
        `/api/whatsapp/lists/${list.id}/members`,
        "POST",
        body,
      );
      setResult(
        `Se sumaron ${r.added} contactos nuevos a la lista (leídos ${r.read}${r.invalid ? `, ${r.invalid} sin celular válido` : ""}).`,
      );
      setText("");
      await load();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (contactId: string) => {
    await call(`/api/whatsapp/lists/${list.id}/members`, "DELETE", {
      contactId,
    }).catch(() => {});
    await load();
    onChange();
  };

  const destroy = async () => {
    if (
      !window.confirm(
        `¿Borrar la lista "${list.name}"? Los contactos y las conversaciones quedan.`,
      )
    )
      return;
    await call(`/api/whatsapp/lists/${list.id}`, "DELETE").catch(() => {});
    onDeleted();
  };

  return (
    <div className="grid content-start gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{list.name}</h3>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-red-600"
          onClick={destroy}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Borrar lista
        </Button>
      </div>

      <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs text-slate-600">
          Pegá contactos desde una planilla ("Nombre; teléfono" por línea) o
          subí el CSV exportado de Google Contactos. Solo entran celulares
          argentinos; los repetidos cuentan una vez.
        </p>
        <Textarea
          rows={4}
          value={text}
          placeholder={
            "Juan Pérez\t3492 15-609000\nAna Gómez; 011 15 2705-9000"
          }
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={busy || !text.trim()}
            onClick={() => add({ text })}
            className="gap-1.5"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Agregar
          </Button>
          <Button size="sm" variant="outline" asChild className="gap-1.5">
            <label>
              <Upload className="h-3.5 w-3.5" />
              Subir CSV
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setText(await file.text());
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => add({ source: "customers" })}
          >
            Importar clientes del taller
          </Button>
        </div>
        {result && <p className="text-xs text-emerald-700">{result}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <p className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
          {members.length} contactos
          {members.length >= 2000 && " (se muestran los últimos 2000)"}
        </p>
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate">
                {m.name || m.profileName || "Sin nombre"}
                <span className="ml-2 text-xs tabular-nums text-slate-500">
                  {formatWaId(m.waId)}
                </span>
                {m.optOutAt && (
                  <span className="ml-2 text-xs text-amber-700">
                    pidió la baja
                  </span>
                )}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label="Sacar de la lista"
                onClick={() => remove(m.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-slate-400" />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
