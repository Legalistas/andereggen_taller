"use client";

/**
 * Botón ícono que abre un Popover con el historial de envíos de un presupuesto.
 * Lee de GET /api/budgets/[id]/send (devuelve los BudgetEmailLog ordenados desc).
 *
 * Cada log tiene:
 *   - sentAt + sentBy.name (quién mandó)
 *   - subject + messageBody (asunto y mensaje custom)
 *   - status: "sent" | "failed"
 *   - recipients: array de { role, email, ok, error?, messageId? }
 */

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type EmailLog = {
  id: string;
  sentAt: string;
  subject: string;
  messageBody: string | null;
  status: string;
  errorMsg: string | null;
  sentBy: { id: string; name: string | null; email: string | null } | null;
  recipients: Array<{
    role: "customer" | "inspector" | "insurance" | "other";
    email: string;
    ok: boolean;
    error?: string;
  }>;
};

const ROLE_LABEL: Record<string, string> = {
  customer: "Cliente",
  inspector: "Inspector",
  insurance: "Productor / Aseguradora",
  other: "Otro",
};

/**
 * @param variant "icon" — solo el ícono (compacto, para listas);
 *                "label" — ícono + texto "Historial" (para detail dialogs).
 */
export function BudgetHistoryButton({
  budgetId,
  budgetNumber,
  variant = "icon",
}: {
  budgetId: string;
  budgetNumber: number;
  variant?: "icon" | "label";
}) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<EmailLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLogs(null);
    setError(null);
    fetch(`/api/budgets/${budgetId}/send`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { logs: EmailLog[] };
      })
      .then((d) => {
        if (!cancelled) setLogs(d.logs);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al cargar historial");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, budgetId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            variant === "label"
              ? "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              : "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          }
          title={`Historial de envíos del presupuesto #${budgetNumber}`}
          aria-label={`Historial de envíos del presupuesto #${budgetNumber}`}
        >
          <History className={variant === "label" ? "h-3.5 w-3.5" : "h-3 w-3"} />
          {variant === "label" && "Historial de envíos"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0 max-h-[420px] overflow-y-auto"
        align="start"
      >
        <div className="px-3 py-2 border-b bg-slate-50/50">
          <p className="text-xs font-semibold text-slate-700">
            Historial de envíos #{budgetNumber}
          </p>
        </div>
        <div className="p-2">
          {error && (
            <div className="px-2 py-3 text-xs text-rose-700 bg-rose-50 rounded">
              {error}
            </div>
          )}
          {!error && logs === null && (
            <div className="px-2 py-6 text-center text-xs text-slate-400 italic">
              Cargando…
            </div>
          )}
          {!error && logs !== null && logs.length === 0 && (
            <div className="px-2 py-6 text-center text-xs text-slate-400 italic">
              Todavía no se envió este presupuesto por mail.
            </div>
          )}
          {logs && logs.length > 0 && (
            <ul className="space-y-2">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-md border border-slate-200 bg-white p-2"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-medium text-slate-700">
                      {new Date(log.sentAt).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-medium ${
                        log.status === "sent"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {log.status === "sent" ? "Enviado" : "Falló"}
                    </span>
                  </div>
                  {log.sentBy?.name && (
                    <p className="text-[10px] text-slate-500 mb-1.5">
                      Por {log.sentBy.name}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {log.recipients.map((r) => (
                      <li
                        key={`${log.id}-${r.role}-${r.email}`}
                        className="flex items-start gap-1.5 text-[11px]"
                      >
                        <span
                          className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                            r.ok ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-slate-500">
                            {ROLE_LABEL[r.role] ?? r.role}:
                          </span>{" "}
                          <span className="text-slate-800 break-all">
                            {r.email}
                          </span>
                          {!r.ok && r.error && (
                            <div className="text-[10px] text-rose-600 mt-0.5">
                              {r.error}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {log.messageBody && (
                    <details className="mt-2">
                      <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-700">
                        Ver mensaje
                      </summary>
                      <p className="mt-1 text-[11px] text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-1.5">
                        {log.messageBody}
                      </p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
