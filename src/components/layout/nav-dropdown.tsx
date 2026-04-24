"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, LucideIcon } from "lucide-react"

export interface NavItem {
    label: string
    icon: LucideIcon
    href?: string
}

interface NavDropdownProps {
    label: string
    icon: LucideIcon
    items: NavItem[]
    isActive?: boolean
    align?: "start" | "center" | "end"
}

export function NavDropdown({ label, icon: Icon, items, isActive = false, align = "start" }: NavDropdownProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className={`gap-2 rounded-none border-b-2 ${
                        isActive
                            ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    } focus-visible:outline-none focus-visible:ring-0`}
                >
                    <Icon className="h-4 w-4" />
                    {label}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className="w-48">
                {items.map((item) => (
                    <DropdownMenuItem key={item.label} asChild={!!item.href}>
                        {item.href ? (
                            <Link href={item.href} className="gap-2 cursor-pointer flex items-center">
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        ) : (
                            <div className="gap-2 flex items-center">
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </div>
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
