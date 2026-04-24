"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronUp, LogOut, Settings, User } from "lucide-react"
import { signOut } from "next-auth/react"
import Link from "next/link"

export type SidebarUser = {
    name: string | null
    email: string | null
    role: string | null
}

function initials(name: string | null, email: string | null): string {
    const source = (name ?? email ?? "?").trim()
    const parts = source.split(/\s+/).filter(Boolean).slice(0, 2)
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

type Props = {
    user: SidebarUser
    collapsed: boolean
}

export function SidebarUserMenu({ user, collapsed }: Props) {
    const label = user.name ?? user.email ?? "Usuario"

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className={`w-full h-auto justify-start gap-2 py-2 ${collapsed ? "px-2 justify-center" : "px-3"}`}
                    title={collapsed ? label : undefined}
                >
                    <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                            {initials(user.name, user.email)}
                        </AvatarFallback>
                    </Avatar>
                    {!collapsed && (
                        <>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium truncate leading-tight">{label}</p>
                                <p className="text-[11px] text-muted-foreground truncate leading-tight">
                                    {user.role ?? "—"}
                                </p>
                            </div>
                            <ChevronUp className="h-4 w-4 opacity-50 shrink-0" />
                        </>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align={collapsed ? "start" : "end"} className="w-56">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/configuracion" className="gap-2 cursor-pointer">
                        <User className="mr-2 h-4 w-4" /> Mi cuenta
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/configuracion" className="gap-2 cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" /> Configuración
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive cursor-pointer"
                    onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                >
                    <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
