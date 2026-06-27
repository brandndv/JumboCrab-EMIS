"use client";

import { useTransition } from "react";
import { Repeat2 } from "lucide-react";
import { switchLinkedAccount } from "@/actions/auth/auth-action";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast-provider";

export function AccountSwitchMenuItem({ label }: { label: string }) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenuItem
      disabled={isPending}
      onSelect={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await switchLinkedAccount();
          if (!result.success || !result.redirectPath) {
            toast.error("Switch failed.", {
              description: result.error || "Linked account unavailable.",
            });
            return;
          }

          window.location.assign(result.redirectPath);
        });
      }}
    >
      <Repeat2 />
      {isPending ? "Switching..." : label}
    </DropdownMenuItem>
  );
}
