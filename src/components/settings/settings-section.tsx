"use client";

import {
  Bell,
  Bot,
  Building2,
  Car,
  FileText,
  Loader2,
  Palette,
  Settings as SettingsIcon,
  ShieldCheck,
  Tag,
  Truck,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompanyTab from "./tabs/company-tab";

// Perf audit: Configuración tiene 9 tabs pesados (suppliers-tab 526 lns,
// vehicles-tab 776 lns, insurances-tab 438 lns, etc.). Solo se muestra 1
// a la vez — el resto va lazy. CompanyTab queda eager porque es el default.
const tabFallback = (
  <div className="p-8 flex items-center justify-center text-slate-400">
    <Loader2 className="h-5 w-5 animate-spin" />
  </div>
);
const AppearanceTab = dynamic(() => import("./tabs/appearance-tab"), {
  loading: () => tabFallback,
});
const BudgetTab = dynamic(() => import("./tabs/budget-tab"), {
  loading: () => tabFallback,
});
const InsurancesTab = dynamic(() => import("./tabs/insurances-tab"), {
  loading: () => tabFallback,
});
const IntegrationsTab = dynamic(() => import("./tabs/integrations-tab"), {
  loading: () => tabFallback,
});
const NotificationsTab = dynamic(() => import("./tabs/notifications-tab"), {
  loading: () => tabFallback,
});
const SourcesTab = dynamic(() => import("./tabs/sources-tab"), {
  loading: () => tabFallback,
});
const SuppliersTab = dynamic(() => import("./tabs/suppliers-tab"), {
  loading: () => tabFallback,
});
const VehiclesTab = dynamic(() => import("./tabs/vehicles-tab"), {
  loading: () => tabFallback,
});

export type AppSettings = {
  id: string;
  companyName: string;
  companyAddress: string;
  companyCuit: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyWebsite: string | null;
  companyLogoUrl: string | null;
  defaultIvaRate: string | number;
  defaultValidityDays: number;
  defaultDeliveryDays: number;
  defaultPaymentCondition: string;
  notifyOnLeadCreated: boolean;
  notifyOnBudgetSent: boolean;
  notifyOnBudgetReminder: boolean;
  notifyOnStageChange: boolean;
  reminderDaysAfterSent: number;
  // Eventos automáticos spec sección 6
  notifyBudgetCreated: boolean;
  notifyVehicleEntered: boolean;
  notifyPartsReceived: boolean;
  notifyRepairCompleted: boolean;
  notifyCustomerExperience: boolean;
  locale: string;
  currency: string;
  timezone: string;
  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  whatsappApiKey: string | null;
  mpEnabled: boolean;
  mpAccessToken: string | null;
  afipEnabled: boolean;
  afipCuit: string | null;
  afipCertNote: string | null;
};

export default function SettingsSection() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { settings: AppSettings };
      setSettings(data.settings);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (
      patch: Partial<AppSettings>,
    ): Promise<{ ok: boolean; error?: string }> => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        return { ok: false, error: body?.error ?? `HTTP ${res.status}` };
      setSettings(body.settings as AppSettings);
      return { ok: true };
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Configuración" }]} />
        <h1 className="text-3xl font-bold">Configuración</h1>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 inline animate-spin mr-2" /> Cargando
          configuración…
        </Card>
      ) : loadError ? (
        <Card className="p-6 border-destructive/40 bg-destructive/5">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={fetchSettings}
          >
            Reintentar
          </Button>
        </Card>
      ) : settings ? (
        <Tabs defaultValue="company">
          <TabsList className="w-full">
            <TabsTrigger value="company">
              <Building2 className="h-4 w-4" /> Empresa
            </TabsTrigger>
            <TabsTrigger value="budget">
              <FileText className="h-4 w-4" /> Presupuestos
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4" /> Notificaciones
            </TabsTrigger>
            <TabsTrigger value="insurances">
              <ShieldCheck className="h-4 w-4" /> Seguros
            </TabsTrigger>
            <TabsTrigger value="suppliers">
              <Truck className="h-4 w-4" /> Proveedores
            </TabsTrigger>
            <TabsTrigger value="vehicles">
              <Car className="h-4 w-4" /> Vehículos
            </TabsTrigger>
            <TabsTrigger value="sources">
              <Tag className="h-4 w-4" /> Fuentes de lead
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="h-4 w-4" /> Apariencia
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <Bot className="h-4 w-4" /> Integraciones
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="company">
              <CompanyTab settings={settings} onSave={updateSettings} />
            </TabsContent>
            <TabsContent value="budget">
              <BudgetTab settings={settings} onSave={updateSettings} />
            </TabsContent>
            <TabsContent value="notifications">
              <NotificationsTab settings={settings} onSave={updateSettings} />
            </TabsContent>
            <TabsContent value="insurances">
              <InsurancesTab />
            </TabsContent>
            <TabsContent value="suppliers">
              <SuppliersTab />
            </TabsContent>
            <TabsContent value="vehicles">
              <VehiclesTab />
            </TabsContent>
            <TabsContent value="sources">
              <SourcesTab />
            </TabsContent>
            <TabsContent value="appearance">
              <AppearanceTab settings={settings} onSave={updateSettings} />
            </TabsContent>
            <TabsContent value="integrations">
              <IntegrationsTab settings={settings} onSave={updateSettings} />
            </TabsContent>
          </div>
        </Tabs>
      ) : null}
    </div>
  );
}

// Helper UI para headers de tab
export function TabHeader({
  title,
  desc,
  icon: Icon,
}: {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b mb-4">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

// Icon export for tabs
export { SettingsIcon };
