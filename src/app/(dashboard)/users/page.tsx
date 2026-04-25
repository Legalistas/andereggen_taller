import type { Metadata } from "next";
import UsersSection from "@/components/users/users-section";
import { getServerSession } from "@/lib/auth-utils";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const session = await getServerSession();
  return <UsersSection currentUserId={session?.user?.id ?? null} />;
}
