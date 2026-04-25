"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/auth/signin";
      }}
    >
      Sign Out
    </Button>
  );
}
