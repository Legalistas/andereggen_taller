import UsersSection from "@/components/users/users-section"
import { auth } from "@/auth"

export default async function UsersPage() {
    const session = await auth()
    return <UsersSection currentUserId={session?.user?.id ?? null} />
}
