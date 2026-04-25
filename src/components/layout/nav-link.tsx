"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface NavLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive?: boolean;
}

export function NavLink({
  href,
  label,
  icon: Icon,
  isActive = false,
}: NavLinkProps) {
  return (
    <Button
      asChild
      variant="ghost"
      className={`gap-2 rounded-none border-b-2 ${
        isActive
          ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
      }`}
    >
      <Link href={href}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
