"use client";

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Shield,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  roleLabel: string;
  createdAt: string;
};

type SessionItem = {
  id: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
};

export function ProfileSection({ user }: { user: ProfileUser }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border border-slate-200">
          {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
          <AvatarFallback className="bg-[#003b73] text-white text-xl font-semibold">
            {user.name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? "")
              .join("") || "?"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-sm text-slate-500">{user.email}</span>
            {user.emailVerified ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3" /> Verificado
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs">
                <AlertCircle className="h-3 w-3" /> No verificado
              </Badge>
            )}
            <Badge variant="outline" className="bg-[#003b73]/10 text-[#003b73] border-[#003b73]/20 gap-1 text-xs">
              <Shield className="h-3 w-3" /> {user.roleLabel}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info" className="gap-2">
            <UserIcon className="h-4 w-4" /> Información
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <KeyRound className="h-4 w-4" /> Contraseña
          </TabsTrigger>
          <TabsTrigger value="2fa" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> 2FA
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Monitor className="h-4 w-4" /> Sesiones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <InfoTab user={user} />
        </TabsContent>
        <TabsContent value="password" className="mt-4">
          <PasswordTab />
        </TabsContent>
        <TabsContent value="2fa" className="mt-4">
          <TwoFactorTab enabled={user.twoFactorEnabled} />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Info personal
// ──────────────────────────────────────────────────────────────────────────

function InfoTab({ user }: { user: ProfileUser }) {
  const [name, setName] = useState(user.name);
  const [image, setImage] = useState(user.image ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const { error } = await authClient.updateUser({
      name,
      image: image || undefined,
    });
    setSaving(false);
    if (error) {
      setFeedback({ type: "err", msg: error.message ?? "No se pudo guardar" });
      return;
    }
    setFeedback({ type: "ok", msg: "Perfil actualizado" });
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setEmailSaving(true);
    setEmailFeedback(null);
    const { error } = await authClient.changeEmail({
      newEmail,
      callbackURL: "/perfil",
    });
    setEmailSaving(false);
    if (error) {
      setEmailFeedback({
        type: "err",
        msg: error.message ?? "No se pudo cambiar el email",
      });
      return;
    }
    setEmailFeedback({
      type: "ok",
      msg: "Te enviamos un email de verificación al nuevo correo.",
    });
    setNewEmail("");
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información personal</CardTitle>
          <CardDescription>Datos que ve el resto del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSaveProfile}>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="image">URL de avatar</Label>
              <Input
                id="image"
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://…"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Miembro desde</Label>
              <p className="text-sm text-slate-500">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>

            {feedback && <Feedback feedback={feedback} />}

            <Button type="submit" disabled={saving} className="bg-[#003b73] hover:bg-[#002b55]">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Guardando…
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Cambiar email
          </CardTitle>
          <CardDescription>
            Email actual: <span className="font-medium text-slate-700">{user.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleChangeEmail}>
            <div className="space-y-1.5">
              <Label htmlFor="newEmail">Nuevo email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nuevo@empresa.com"
                disabled={emailSaving}
              />
              <p className="text-xs text-slate-500">
                Vas a recibir un email de confirmación al nuevo correo antes de que el cambio se aplique.
              </p>
            </div>

            {emailFeedback && <Feedback feedback={emailFeedback} />}

            <Button
              type="submit"
              disabled={emailSaving || !newEmail}
              variant="outline"
            >
              {emailSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando…
                </>
              ) : (
                "Cambiar email"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Cambio de contraseña
// ──────────────────────────────────────────────────────────────────────────

function PasswordTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (next.length < 8) {
      setFeedback({ type: "err", msg: "La nueva contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (next !== confirm) {
      setFeedback({ type: "err", msg: "Las contraseñas no coinciden." });
      return;
    }

    setBusy(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: revokeOthers,
    });
    setBusy(false);

    if (error) {
      setFeedback({
        type: "err",
        msg: error.message ?? "No se pudo cambiar la contraseña",
      });
      return;
    }
    setFeedback({ type: "ok", msg: "Contraseña actualizada." });
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Cambiar contraseña</CardTitle>
        <CardDescription>Ingresá tu contraseña actual y definí una nueva.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="current">Contraseña actual</Label>
            <Input
              id="current"
              type={showPass ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new">Nueva contraseña (mín. 8)</Label>
            <div className="relative">
              <Input
                id="new"
                type={showPass ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={busy}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                tabIndex={-1}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
            <Input
              id="confirm"
              type={showPass ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={busy}
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={revokeOthers}
              onChange={(e) => setRevokeOthers(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Cerrar sesión en otros dispositivos donde este usuario esté logueado.
            </span>
          </label>

          {feedback && <Feedback feedback={feedback} />}

          <Button type="submit" disabled={busy} className="bg-[#003b73] hover:bg-[#002b55]">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Guardando…
              </>
            ) : (
              "Actualizar contraseña"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2FA
// ──────────────────────────────────────────────────────────────────────────

function TwoFactorTab({ enabled: initialEnabled }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (error) {
      setFeedback({ type: "err", msg: error.message ?? "No se pudo activar 2FA" });
      return;
    }
    if (data) {
      setTotpUri(data.totpURI);
      setBackupCodes(data.backupCodes);
      setPassword("");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code: verifyCode });
    setBusy(false);
    if (error) {
      setFeedback({ type: "err", msg: error.message ?? "Código inválido" });
      return;
    }
    setEnabled(true);
    setTotpUri(null);
    setVerifyCode("");
    setFeedback({ type: "ok", msg: "2FA activado correctamente." });
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    const { error } = await authClient.twoFactor.disable({ password });
    setBusy(false);
    if (error) {
      setFeedback({ type: "err", msg: error.message ?? "No se pudo desactivar 2FA" });
      return;
    }
    setEnabled(false);
    setPassword("");
    setFeedback({ type: "ok", msg: "2FA desactivado." });
  };

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Verificación en dos pasos
          {enabled ? (
            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 ml-auto">
              Activo
            </Badge>
          ) : (
            <Badge className="bg-slate-100 text-slate-600 border border-slate-200 ml-auto">
              Inactivo
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Agregá una capa extra de seguridad con una app autenticadora (Google Authenticator, 1Password, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totpUri ? (
          <SetupTotp
            uri={totpUri}
            backupCodes={backupCodes}
            code={verifyCode}
            onCodeChange={setVerifyCode}
            onVerify={handleVerify}
            busy={busy}
            feedback={feedback}
          />
        ) : enabled ? (
          <form className="space-y-4" onSubmit={handleDisable}>
            <div className="space-y-1.5">
              <Label htmlFor="pwd-disable">Contraseña para desactivar</Label>
              <Input
                id="pwd-disable"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            {feedback && <Feedback feedback={feedback} />}
            <Button type="submit" variant="destructive" disabled={busy || !password}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Desactivar 2FA
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleEnable}>
            <div className="space-y-1.5">
              <Label htmlFor="pwd-enable">Contraseña actual</Label>
              <Input
                id="pwd-enable"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
              <p className="text-xs text-slate-500">
                Necesitamos tu contraseña para confirmar que sos vos antes de activar el 2FA.
              </p>
            </div>
            {feedback && <Feedback feedback={feedback} />}
            <Button type="submit" disabled={busy || !password} className="bg-[#003b73] hover:bg-[#002b55]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Activar 2FA
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function SetupTotp({
  uri,
  backupCodes,
  code,
  onCodeChange,
  onVerify,
  busy,
  feedback,
}: {
  uri: string;
  backupCodes: string[];
  code: string;
  onCodeChange: (v: string) => void;
  onVerify: (e: React.FormEvent) => void;
  busy: boolean;
  feedback: { type: "ok" | "err"; msg: string } | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
        <p className="font-medium text-slate-900">Paso 1. Escaneá el QR</p>
        <p className="text-slate-600 text-xs">
          Abrí tu app de autenticación (Google Authenticator, 1Password, Authy, etc.) y escaneá este código.
        </p>
        <div className="flex justify-center py-2">
          <div className="bg-white p-3 rounded-md border border-slate-200">
            {/* Importamos react-qr-code dinámicamente sólo acá — no lo usamos en otras pantallas */}
            <QrCode value={uri} />
          </div>
        </div>
        <p className="text-xs text-slate-500 text-center break-all">
          ¿No podés escanear?{" "}
          <span className="font-mono text-slate-700">{uri}</span>
        </p>
      </div>

      {backupCodes.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm space-y-2">
          <p className="font-medium text-amber-900">Códigos de respaldo</p>
          <p className="text-amber-800 text-xs">
            Guardá estos códigos en un lugar seguro. Te van a servir si perdés acceso a tu app autenticadora.
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs text-amber-900">
            {backupCodes.map((c) => (
              <div key={c} className="bg-white px-2 py-1.5 rounded border border-amber-200">
                {c}
              </div>
            ))}
          </div>
        </div>
      )}

      <form className="space-y-3" onSubmit={onVerify}>
        <p className="font-medium text-slate-900 text-sm">Paso 2. Ingresá el código</p>
        <div className="space-y-1.5">
          <Label htmlFor="totp">Código de 6 dígitos</Label>
          <Input
            id="totp"
            required
            inputMode="numeric"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="123456"
            disabled={busy}
          />
        </div>
        {feedback && <Feedback feedback={feedback} />}
        <Button type="submit" disabled={busy || code.length < 6} className="bg-[#003b73] hover:bg-[#002b55]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Verificar y activar
        </Button>
      </form>
    </div>
  );
}

function QrCode({ value }: { value: string }) {
  const [Component, setComponent] = useState<React.ComponentType<{
    value: string;
    size?: number;
  }> | null>(null);

  useEffect(() => {
    import("react-qr-code").then((mod) => setComponent(() => mod.default));
  }, []);

  if (!Component) {
    return (
      <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  return <Component value={value} size={192} />;
}

// ──────────────────────────────────────────────────────────────────────────
// Sesiones activas
// ──────────────────────────────────────────────────────────────────────────

function SessionsTab() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await authClient.listSessions();
    setLoading(false);
    if (err) {
      setError(err.message ?? "No se pudieron cargar las sesiones");
      return;
    }
    setSessions((data ?? []) as unknown as SessionItem[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevoke = async (token: string) => {
    await authClient.revokeSession({ token });
    load();
  };

  const handleRevokeOthers = async () => {
    await authClient.revokeOtherSessions();
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Sesiones activas</CardTitle>
          <CardDescription>
            Dispositivos donde tu cuenta está actualmente conectada.
          </CardDescription>
        </div>
        {sessions.length > 1 && (
          <Button variant="outline" size="sm" onClick={handleRevokeOthers}>
            Cerrar las demás
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 text-center text-slate-500 text-sm">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
            Cargando sesiones…
          </div>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-500">No hay sesiones activas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-start gap-3 py-3">
                <div className="h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                  <Monitor className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {parseUserAgent(s.userAgent)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.ipAddress ?? "IP desconocida"} ·{" "}
                    {new Date(s.createdAt).toLocaleString("es-AR")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  onClick={() => handleRevoke(s.token)}
                >
                  <LogOut className="h-4 w-4 mr-1" /> Cerrar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return "Dispositivo desconocido";
  // Heurística simple — no queremos meter una dep de ua-parser.
  const browser = /Chrome/i.test(ua)
    ? "Chrome"
    : /Firefox/i.test(ua)
      ? "Firefox"
      : /Safari/i.test(ua)
        ? "Safari"
        : /Edge/i.test(ua)
          ? "Edge"
          : "Navegador";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Mac/i.test(ua)
      ? "macOS"
      : /Linux/i.test(ua)
        ? "Linux"
        : /Android/i.test(ua)
          ? "Android"
          : /iOS|iPhone|iPad/i.test(ua)
            ? "iOS"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

// ──────────────────────────────────────────────────────────────────────────

function Feedback({ feedback }: { feedback: { type: "ok" | "err"; msg: string } }) {
  return feedback.type === "ok" ? (
    <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{feedback.msg}</span>
    </div>
  ) : (
    <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{feedback.msg}</span>
    </div>
  );
}
