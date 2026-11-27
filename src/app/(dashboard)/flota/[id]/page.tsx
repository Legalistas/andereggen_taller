import FleetVehicleDetail from "@/components/flota/fleet-vehicle-detail";

export const metadata = { title: "Vehículo de la flota" };

export default async function FlotaVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FleetVehicleDetail id={id} />;
}
