"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Loader2, Ticket, Trash2 } from "lucide-react";
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
import { createTicket, deleteTicket, getTicketTrackerStatus } from "@/client/sdk.gen";
import type { Tickets, TicketType } from "@/client/types.gen";

interface TicketMenuProps {
  findingId: string;
  /** Existing ticket on the finding, if any (FindingDetail.ticket). */
  ticket?: Tickets | null;
}

/** Returns true when the finding's ticket field references a real ticket. */
function hasTicket(ticket?: Tickets | null): ticket is Tickets {
  return Boolean(ticket && (ticket.id || ticket.url || ticket.name));
}

/**
 * Header control for the finding detail page: create a ticket in an enabled
 * tracker, or view/delete the existing one. Tracker availability comes from
 * the global ticket-tracker-status endpoint so we only offer configured ones.
 */
export function TicketMenu({ findingId, ticket }: TicketMenuProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: trackerStatus } = useQuery({
    queryKey: ["ticket-tracker-status"],
    queryFn: async () =>
      (await getTicketTrackerStatus({ throwOnError: true })).data,
  });

  const create = useMutation({
    mutationFn: async (type: TicketType) =>
      (
        await createTicket({
          path: { findingId },
          query: { type },
          throwOnError: true,
        })
      ).data,
    onSuccess: (created) => {
      const label = created?.name ?? "Ticket";
      if (created?.url) {
        toast.success("Ticket created", {
          description: label,
          action: {
            label: "Open",
            onClick: () => window.open(created.url ?? "", "_blank", "noopener,noreferrer"),
          },
        });
      } else {
        toast.success("Ticket created");
      }
      void queryClient.invalidateQueries({ queryKey: ["finding", findingId] });
    },
    onError: () => toast.error("Failed to create ticket"),
  });

  const remove = useMutation({
    mutationFn: async () =>
      (await deleteTicket({ path: { findingId }, throwOnError: true })).data,
    onSuccess: () => {
      toast.success("Ticket deleted");
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["finding", findingId] });
    },
    onError: () => toast.error("Failed to delete ticket"),
  });

  // Only Jira and Redmine carry a configured/enabled flag from the API.
  const available: TicketType[] = [];
  if (trackerStatus?.jira) available.push("Jira");
  if (trackerStatus?.redmine) available.push("Redmine");

  if (hasTicket(ticket)) {
    return (
      <>
        <div className="flex items-center gap-2">
          {ticket.url ? (
            <Button variant="outline" size="sm" asChild>
              <a href={ticket.url} target="_blank" rel="noopener noreferrer">
                <Ticket className="size-4" />
                {ticket.name ?? ticket.type}
                <ExternalLink className="size-3.5 text-muted-foreground" />
              </a>
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 text-sm">
              <Ticket className="size-4 text-muted-foreground" />
              {ticket.name ?? ticket.type}
            </span>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Delete ticket"
            disabled={remove.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {remove.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4 text-destructive" />
            )}
          </Button>
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete ticket?</DialogTitle>
              <DialogDescription>
                This removes the link to {ticket.name ?? `the ${ticket.type} ticket`} from this
                finding. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={remove.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={create.isPending}>
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Ticket className="size-4" />
          )}
          Create ticket
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Create ticket in</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {available.length === 0 ? (
          <DropdownMenuItem disabled>No tracker configured</DropdownMenuItem>
        ) : (
          available.map((type) => (
            <DropdownMenuItem key={type} onSelect={() => create.mutate(type)}>
              {type}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
