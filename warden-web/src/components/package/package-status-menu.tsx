"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProjectPackage } from "@/client/sdk.gen";
import type { PackageStatus } from "@/client/types.gen";
import { cn } from "@/lib/utils";

interface PackageStatusOption {
  status: PackageStatus;
  label: string;
  description: string;
}

// Parity with the package status enum: Open / Ignore / Fixed.
const PACKAGE_STATUS_OPTIONS: PackageStatusOption[] = [
  {
    status: "Open",
    label: "Open",
    description: "Vulnerable package awaiting remediation.",
  },
  {
    status: "Ignore",
    label: "Ignore",
    description: "Accepted risk — excluded from future scans (reason required).",
  },
  {
    status: "Fixed",
    label: "Fixed",
    description: "Package has been upgraded or remediated.",
  },
];

export const PACKAGE_STATUS_VARIANT: Record<
  PackageStatus,
  "secondary" | "outline" | "default"
> = {
  Open: "secondary",
  Ignore: "outline",
  Fixed: "default",
};

interface PackageStatusMenuProps {
  projectId: string;
  packageId: string;
  /**
   * Current package status — shown on the trigger and marks the active item.
   * Omit (e.g. in list-row actions where status isn't loaded) to show a neutral label.
   */
  status?: PackageStatus;
  /** Trigger label when no status is known. */
  triggerLabel?: React.ReactNode;
  /** Existing ignore reason, prefilled into the dialog when re-ignoring. */
  ignoreReason?: string | null;
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
  buttonSize?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  /** Optional extra query keys to invalidate (e.g. the list query). */
  onChanged?: () => void;
}

/**
 * Dropdown to change a project package's status via updateProjectPackage.
 * Selecting "Ignore" opens a dialog prompting for the ignore reason.
 */
export function PackageStatusMenu({
  projectId,
  packageId,
  status,
  triggerLabel = "Status",
  ignoreReason,
  buttonVariant = "outline",
  buttonSize = "sm",
  className,
  onChanged,
}: PackageStatusMenuProps) {
  const queryClient = useQueryClient();
  const [ignoreOpen, setIgnoreOpen] = useState(false);
  const [reason, setReason] = useState(ignoreReason ?? "");

  const update = useMutation({
    mutationFn: async (input: { status: PackageStatus; ignoreReason?: string | null }) =>
      (
        await updateProjectPackage({
          path: { projectId, packageId },
          body: { status: input.status, ignoreReason: input.ignoreReason ?? null },
          throwOnError: true,
        })
      ).data,
    onSuccess: (_data, input) => {
      toast.success(`Package marked as ${input.status}`);
      setIgnoreOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ["project-package", projectId, packageId],
      });
      onChanged?.();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update package status"),
  });

  function handleSelect(next: PackageStatus) {
    if (next === "Ignore") {
      setReason(ignoreReason ?? "");
      setIgnoreOpen(true);
      return;
    }
    update.mutate({ status: next });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={buttonVariant}
            size={buttonSize}
            disabled={update.isPending}
            className={cn(className)}
          >
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {status ?? triggerLabel}
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Mark as</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PACKAGE_STATUS_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.status}
              className="flex flex-col items-start gap-1"
              disabled={update.isPending}
              onSelect={(e) => {
                // Keep the menu's selection from closing the dialog prematurely.
                e.preventDefault();
                handleSelect(opt.status);
              }}
            >
              <span className="font-medium">
                {opt.label}
                {opt.status === status ? " (current)" : ""}
              </span>
              <span className="text-xs text-muted-foreground">{opt.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={ignoreOpen} onOpenChange={setIgnoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ignore package</DialogTitle>
            <DialogDescription>
              Provide a reason for ignoring this package. It will be excluded from future scans.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ignore-reason">Ignore reason</Label>
            <Textarea
              id="ignore-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Not exploitable in our usage; mitigated by network controls."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIgnoreOpen(false)}
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => update.mutate({ status: "Ignore", ignoreReason: reason.trim() })}
              disabled={update.isPending || reason.trim().length === 0}
            >
              {update.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Ignore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
