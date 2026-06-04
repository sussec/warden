"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FindingStatus } from "@/client/types.gen";
import { cn } from "@/lib/utils";
import { FindingStatusBadge } from "./finding-status-badge";
import { findingStatusOptions } from "./finding-status";

interface FindingStatusMenuProps {
  /** Content of the trigger button. */
  label: React.ReactNode;
  onSelect: (status: FindingStatus) => void;
  disabled?: boolean;
  loading?: boolean;
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
  buttonSize?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}

/** Status dropdown — drives both bulk "mark as" and single-finding status change. */
export function FindingStatusMenu({
  label,
  onSelect,
  disabled,
  loading,
  buttonVariant = "outline",
  buttonSize = "sm",
  className,
}: FindingStatusMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={buttonVariant}
          size={buttonSize}
          disabled={disabled || loading}
          className={cn(className)}
        >
          {label}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Mark as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {findingStatusOptions().map((opt) => (
          <DropdownMenuItem
            key={opt.status}
            className="flex flex-col items-start gap-1"
            onSelect={() => onSelect(opt.status)}
          >
            <FindingStatusBadge status={opt.status} />
            <span className="text-xs text-muted-foreground">{opt.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
