"use client";

import {
  AlertCircle,
  Car,
  CheckCircle2,
  Loader2,
  Star,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type RepairInfo = {
  customerName: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleDomain: string;
};

type LoadResponse = {
  rating: {
    stars: number | null;
    comment: string | null;
    respondedAt: string | null;
  };
  repair: RepairInfo;
  alreadyAnswered: boolean;
};

export default function ReviewForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<LoadResponse | null>(null);

  // Form
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/reviews/${token}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        return body as LoadResponse;
      })
      .then((b) => {
        if (cancelled) return;
        setInfo(b);
        if (b.alreadyAnswered && b.rating.stars) {
          setStars(b.rating.stars);
          setComment(b.rating.comment ?? "");
          setSubmitted(true);
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    setSubmitError(null);
    if (stars < 1 || stars > 5) {
      setSubmitError("Elegí entre 1 y 5 estrellas.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, comment: comment.trim() || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <Card className="p-10 text-center">
          <Loader2 className="h-6 w-6 inline animate-spin text-muted-foreground" />
        </Card>
      </Shell>
    );
  }

  if (loadError || !info) {
    return (
      <Shell>
        <Card className="p-8 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6 text-rose-600" />
          </div>
          <h1 className="text-lg font-semibold">Encuesta no disponible</h1>
          <p className="text-sm text-muted-foreground">
            {loadError ?? "El link no es válido o expiró."}
          </p>
        </Card>
      </Shell>
    );
  }

  const { repair } = info;

  if (submitted) {
    return (
      <Shell>
        <Card className="p-8 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold">¡Gracias por tu respuesta!</h1>
          <p className="text-sm text-muted-foreground">
            Calificaste con <strong>{stars}/5</strong>. Tu opinión nos ayuda a
            mejorar.
          </p>
          <div className="flex justify-center gap-1 pt-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-7 w-7 ${
                  n <= stars
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-200"
                }`}
              />
            ))}
          </div>
          {comment && (
            <div className="text-xs text-slate-500 italic border-t pt-3 mt-3">
              "{comment}"
            </div>
          )}
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card className="p-6 sm:p-8 space-y-5">
        <div className="flex items-start gap-3 pb-4 border-b">
          <div className="h-10 w-10 rounded-lg bg-[#003b73]/10 flex items-center justify-center shrink-0">
            <Wrench className="h-5 w-5 text-[#003b73]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">¿Cómo fue tu experiencia?</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hola {repair.customerName.split(/\s+/)[0]}, queremos saber tu
              opinión sobre la reparación.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 rounded-md px-3 py-2">
          <Car className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
          <div>
            <div className="font-medium">
              {repair.vehicleBrand} {repair.vehicleModel} {repair.vehicleYear}
            </div>
            <div className="font-mono text-[10px] text-slate-500 uppercase">
              {repair.vehicleDomain}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="stars-group"
            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Tu calificación *
          </label>
          <div
            id="stars-group"
            className="flex items-center justify-center gap-2 py-3"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStars(n)}
                onMouseEnter={() => setHoverStars(n)}
                onMouseLeave={() => setHoverStars(0)}
                className="p-1 hover:scale-110 transition-transform"
                aria-label={`${n} estrella${n === 1 ? "" : "s"}`}
              >
                <Star
                  className={`h-10 w-10 transition-colors ${
                    n <= (hoverStars || stars)
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300"
                  }`}
                />
              </button>
            ))}
          </div>
          {stars > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              {RATING_LABELS[stars - 1]}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="comment"
            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Comentario (opcional)
          </label>
          <Textarea
            id="comment"
            rows={4}
            placeholder="Contanos qué te gustó, qué podríamos mejorar…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="resize-none"
            maxLength={500}
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {comment.length}/500
          </p>
        </div>

        {submitError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <Button
          onClick={submit}
          disabled={submitting || stars === 0}
          className="w-full gap-2"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
            </>
          ) : (
            "Enviar calificación"
          )}
        </Button>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-[#003b73] mb-3">
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-base font-bold text-[#003b73]">
            Andereggen Taller Automotor
          </h2>
        </div>
        {children}
        <p className="text-center text-[10px] text-slate-400 mt-4">
          Responder este link toma menos de 1 minuto.
        </p>
      </div>
    </div>
  );
}

const RATING_LABELS = [
  "Muy malo",
  "Regular",
  "Bueno",
  "Muy bueno",
  "Excelente",
];
