import { ProfileSection } from "@/components/profile/profile-section";
import { protectRoute } from "@/lib/auth-utils";
import { roleLabel } from "@/lib/auth-edge";

export default async function PerfilPage() {
  const session = await protectRoute();

  return (
    <ProfileSection
      user={{
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
        emailVerified: session.user.emailVerified ?? false,
        twoFactorEnabled: session.user.twoFactorEnabled ?? false,
        roleLabel:
          session.user.domainRole?.label ??
          roleLabel(session.user.domainRole?.name),
        createdAt:
          session.user.createdAt instanceof Date
            ? session.user.createdAt.toISOString()
            : String(session.user.createdAt ?? ""),
      }}
    />
  );
}
