"use client";

import {
  ArrowLeft,
  Loader2,
  MessageCirclePlus,
  Paperclip,
  Search,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { formatWaId, ventanaAbierta } from "@/lib/whatsapp/parse";
import {
  type TemplateChoice,
  TemplatePicker,
  useTemplates,
} from "./template-picker";

type Conversation = {
  id: string;
  waId: string;
  name: string | null;
  profileName: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  optOutAt: string | null;
  lastMessage: {
    body: string | null;
    direction: "INBOUND" | "OUTBOUND";
    hasMedia: boolean;
  } | null;
};

type Message = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string | null;
  media: { url: string; contentType: string }[] | null;
  status: string | null;
  errorCode: string | null;
  template: string | null;
  createdAt: string;
  sentBy: { name: string } | null;
};

type Thread = {
  contact: {
    id: string;
    waId: string;
    name: string | null;
    profileName: string | null;
    lastInboundAt: string | null;
    optOutAt: string | null;
  };
  messages: Message[];
};

const AR = "America/Argentina/Buenos_Aires";
const TIME = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: AR,
});

const STATUS_LABEL: Record<string, string> = {
  accepted: "en cola",
  queued: "en cola",
  sending: "enviando",
  sent: "enviado",
  delivered: "entregado",
  read: "leído",
  failed: "no entregado",
  undelivered: "no entregado",
};

const displayName = (c: {
  name: string | null;
  profileName: string | null;
  waId: string;
}) => c.name || c.profileName || formatWaId(c.waId);

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json;
}

/** Bandeja de WhatsApp: conversaciones a la izquierda, el hilo a la derecha. */
export function WhatsappInbox() {
  const [q, setQ] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { templates, error: templatesError } = useTemplates();

  const loadList = useCallback(async () => {
    const res = await fetch(
      `/api/whatsapp/conversations?q=${encodeURIComponent(q)}`,
    );
    if (res.ok) setConversations((await res.json()).data ?? []);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(loadList, 300);
    const poll = setInterval(loadList, 15_000);
    return () => {
      clearTimeout(t);
      clearInterval(poll);
    };
  }, [loadList]);

  return (
    <div className="grid h-[calc(100vh-14rem)] min-h-[480px] grid-cols-1 overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-[320px_1fr]">
      <aside
        className={`flex min-h-0 flex-col border-r border-slate-200 ${selected ? "hidden md:flex" : "flex"}`}
      >
        <div className="flex gap-2 border-b border-slate-200 p-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="h-9 pl-8"
              placeholder="Buscar nombre, número o texto"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            title="Nueva conversación"
            aria-label="Nueva conversación"
            onClick={() => setCreating(true)}
          >
            <MessageCirclePlus className="h-4 w-4" />
          </Button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {loading && (
            <li className="p-4 text-center text-xs text-slate-500">
              Cargando…
            </li>
          )}
          {!loading && conversations.length === 0 && (
            <li className="p-4 text-center text-xs text-slate-500">
              No hay conversaciones.
            </li>
          )}
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c.id)}
                className={`w-full border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50 ${selected === c.id ? "bg-emerald-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-900">
                    {displayName(c)}
                  </span>
                  {c.lastMessageAt && (
                    <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                      {TIME.format(new Date(c.lastMessageAt))}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-slate-500">
                    {c.lastMessage?.direction === "OUTBOUND" && "Vos: "}
                    {c.lastMessage?.body ??
                      (c.lastMessage?.hasMedia ? "Adjunto" : "")}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section
        className={`min-h-0 flex-col ${selected ? "flex" : "hidden md:flex"}`}
      >
        {selected ? (
          <ThreadView
            key={selected}
            id={selected}
            templates={templates}
            onBack={() => setSelected(null)}
            onSent={loadList}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
            {templatesError
              ? `WhatsApp no está disponible: ${templatesError}`
              : "Elegí una conversación o empezá una nueva."}
          </div>
        )}
      </section>

      <NewConversationDialog
        open={creating}
        onOpenChange={setCreating}
        templates={templates}
        onCreated={(id) => {
          setCreating(false);
          setSelected(id);
          loadList();
        }}
      />
    </div>
  );
}

function ThreadView({
  id,
  templates,
  onBack,
  onSent,
}: {
  id: string;
  templates: ReturnType<typeof useTemplates>["templates"];
  onBack: () => void;
  onSent: () => void;
}) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<TemplateChoice | null>(null);
  const [useTemplate, setUseTemplate] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/whatsapp/conversations/${id}`);
    if (res.ok) setThread(await res.json());
  }, [id]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 10_000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const n = thread?.messages.length ?? 0;
    if (n !== lastCount.current) {
      lastCount.current = n;
      bottom.current?.scrollIntoView({ block: "end" });
    }
  }, [thread]);

  if (!thread) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const open = ventanaAbierta(
    thread.contact.lastInboundAt
      ? new Date(thread.contact.lastInboundAt)
      : null,
  );
  const withTemplate = !open || useTemplate;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await postJson(
        `/api/whatsapp/conversations/${id}/messages`,
        withTemplate
          ? { templateSid: choice?.sid, variables: choice?.variables ?? {} }
          : { body: text },
      );
      setText("");
      setChoice(null);
      await load();
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 md:hidden"
          aria-label="Volver"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {displayName(thread.contact)}
          </p>
          <p className="text-[11px] text-slate-500">
            {formatWaId(thread.contact.waId)}
            {thread.contact.optOutAt && " · pidió la baja"}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
        {thread.messages.map((m) => (
          <MessageBubble key={m.id} m={m} />
        ))}
        <div ref={bottom} />
      </div>

      <footer className="grid gap-2 border-t border-slate-200 p-3">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {open
              ? "Ventana de 24 h abierta: podés escribir libre."
              : "Pasaron más de 24 h del último mensaje del cliente: solo plantillas aprobadas."}
          </span>
          {open && (
            <button
              type="button"
              className="text-emerald-700 hover:underline"
              onClick={() => setUseTemplate((v) => !v)}
            >
              {useTemplate ? "Escribir texto" : "Usar plantilla"}
            </button>
          )}
        </div>
        {withTemplate ? (
          <TemplatePicker
            templates={templates}
            value={choice}
            onChange={setChoice}
          />
        ) : (
          <Textarea
            rows={2}
            value={text}
            placeholder="Escribí un mensaje"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && text.trim()) {
                e.preventDefault();
                send();
              }
            }}
          />
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={send}
            disabled={sending || (withTemplate ? !choice?.sid : !text.trim())}
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Enviar
          </Button>
        </div>
      </footer>
    </>
  );
}

function MessageBubble({ m }: { m: Message }) {
  const out = m.direction === "OUTBOUND";
  const bad = m.status === "failed" || m.status === "undelivered";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${out ? "bg-emerald-100 text-slate-800" : "bg-white text-slate-800"}`}
      >
        {m.template && (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-emerald-800">
            Plantilla {m.template}
          </p>
        )}
        {m.media?.map((a, i) =>
          a.contentType.startsWith("image/") ? (
            <a
              // biome-ignore lint/suspicious/noArrayIndexKey: los adjuntos de un mensaje no cambian de orden
              key={i}
              href={`/api/whatsapp/messages/${m.id}/media/${i}`}
              target="_blank"
              rel="noreferrer"
            >
              {/* biome-ignore lint/performance/noImgElement: imagen privada servida por el proxy */}
              <img
                src={`/api/whatsapp/messages/${m.id}/media/${i}`}
                alt="Adjunto"
                className="mb-1 max-h-60 rounded"
              />
            </a>
          ) : (
            <a
              // biome-ignore lint/suspicious/noArrayIndexKey: los adjuntos de un mensaje no cambian de orden
              key={i}
              href={`/api/whatsapp/messages/${m.id}/media/${i}`}
              target="_blank"
              rel="noreferrer"
              className="mb-1 flex items-center gap-1 text-xs text-emerald-800 underline"
            >
              <Paperclip className="h-3 w-3" />
              Adjunto ({a.contentType.split(";")[0]})
            </a>
          ),
        )}
        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
        <p
          className={`mt-1 text-right text-[10px] ${bad ? "text-red-600" : "text-slate-500"}`}
        >
          {out && (m.sentBy?.name ?? "Automático")}
          {out && " · "}
          {TIME.format(new Date(m.createdAt))}
          {out && m.status && ` · ${STATUS_LABEL[m.status] ?? m.status}`}
          {bad && m.errorCode && ` (código ${m.errorCode})`}
        </p>
      </div>
    </div>
  );
}

function NewConversationDialog({
  open,
  onOpenChange,
  templates,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: ReturnType<typeof useTemplates>["templates"];
  onCreated: (id: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<TemplateChoice | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const { contactId } = await postJson("/api/whatsapp/conversations", {
        phone,
        name,
        templateSid: choice?.sid,
        variables: choice?.variables ?? {},
      });
      setPhone("");
      setName("");
      setChoice(null);
      onCreated(contactId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva conversación</DialogTitle>
          <DialogDescription>
            A un número que no escribió en las últimas 24 h solo se le puede
            mandar una plantilla aprobada.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="wa-phone">Celular</Label>
            <Input
              id="wa-phone"
              value={phone}
              placeholder="3492 15-609000"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="wa-name">Nombre (opcional)</Label>
            <Input
              id="wa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <TemplatePicker
            templates={templates}
            value={choice}
            onChange={setChoice}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            onClick={send}
            disabled={sending || !phone.trim() || !choice?.sid}
            className="gap-1.5"
          >
            {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
