import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignsPanel } from "@/components/whatsapp/campaigns-panel";
import { WhatsappInbox } from "@/components/whatsapp/inbox";
import { ListsPanel } from "@/components/whatsapp/lists-panel";
import { senderNumber } from "@/lib/whatsapp/twilio";

export const metadata = { title: "WhatsApp" };

export default async function WhatsappPage() {
  const number = await senderNumber();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">WhatsApp</h1>
        <p className="text-sm text-slate-500">
          Mensajes del número del taller ({number}), listas de difusión y
          campañas. El número se cambia en Configuración → Integraciones.
        </p>
      </div>
      <Tabs defaultValue="inbox" className="w-full">
        <TabsList>
          <TabsTrigger value="inbox">Conversaciones</TabsTrigger>
          <TabsTrigger value="lists">Listas</TabsTrigger>
          <TabsTrigger value="campaigns">Campañas</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="mt-4">
          <WhatsappInbox />
        </TabsContent>
        <TabsContent value="lists" className="mt-4">
          <ListsPanel />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-4">
          <CampaignsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
