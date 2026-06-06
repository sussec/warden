"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Loader2, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "@/components/severity";
import { EpssBadge, KevBadge, type EpssBlock, type KevBlock } from "@/components/findings/exploit-intel";
import {
  createProjectPackageTicket,
  deleteProjectTicket,
  getPackageById,
  getProjectPackageDetail,
  getTicketTrackerStatus,
  listPackageDependency,
} from "@/client/sdk.gen";
import type {
  Packages,
  Tickets,
  TicketType,
  Vulnerabilities,
} from "@/client/types.gen";
import { PackageStatusMenu } from "./package-status-menu";

export interface PackageDrawerTarget {
  packageId: string;
  /** Present on the project-scoped dependency page; enables status + ticket actions. */
  projectId?: string | null;
  /** Display fallbacks while detail loads. */
  group?: string | null;
  name?: string | null;
  version?: string | null;
}

interface PackageDetailDrawerProps {
  target: PackageDrawerTarget | null;
  onOpenChange: (open: boolean) => void;
}

function hasTicket(ticket?: Tickets | null): ticket is Tickets {
  return Boolean(ticket && (ticket.id || ticket.url || ticket.name));
}

const VULN_TICKET_TYPES: TicketType[] = ["Jira", "Redmine", "GitHub"];

// Flattened OSV advisory served by GET /api/package/{id}/advisories
// (warden-api → warden-osv sidecar; empty when enrichment is disabled).
type OsvAdvisory = {
  id: string;
  aliases?: string[] | null;
  summary?: string | null;
  severity?: string | null;
  withdrawn?: string | null;
  affected?: { ecosystem: string; name: string; fixedVersion?: string | null }[] | null;
  epss?: EpssBlock | null;
  kev?: KevBlock | null;
};

async function fetchPackageAdvisories(packageId: string): Promise<OsvAdvisory[]> {
  const res = await fetch(`/api/package/${packageId}/advisories`, {
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as OsvAdvisory[];
}

/** Slide-over showing a package's metadata, vulnerabilities, dependency path, and actions. */
export function PackageDetailDrawer({ target, onOpenChange }: PackageDetailDrawerProps) {
  const open = target !== null;
  const projectId = target?.projectId ?? null;
  const packageId = target?.packageId ?? null;
  // Status/ticket actions only make sense with a project context.
  const scoped = Boolean(projectId);

  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Project-scoped detail (status, ignoreReason, ticket, vulnerabilities, dependencies).
  const projectDetail = useQuery({
    queryKey: ["project-package", projectId, packageId],
    enabled: open && scoped && !!packageId,
    queryFn: async () =>
      (
        await getProjectPackageDetail({
          path: { projectId: projectId!, packageId: packageId! },
          throwOnError: true,
        })
      ).data,
  });

  // Global (read-only) detail when there is no project context.
  const globalDetail = useQuery({
    queryKey: ["package", packageId],
    enabled: open && !scoped && !!packageId,
    queryFn: async () =>
      (
        await getPackageById({
          path: { packageId: packageId! },
          throwOnError: true,
        })
      ).data,
  });

  // The dependency chain — how this package is pulled in (global endpoint, packageId only).
  const dependencyChain = useQuery({
    queryKey: ["package-dependencies", packageId],
    enabled: open && !!packageId,
    queryFn: async () =>
      (
        await listPackageDependency({
          path: { packageId: packageId! },
          throwOnError: true,
        })
      ).data,
  });

  // Live OSV.dev advisories for this exact version — catches advisories
  // published after the last scan. Silently absent on failure/disabled.
  const osvAdvisories = useQuery({
    queryKey: ["package-osv-advisories", packageId],
    enabled: open && !!packageId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: () => fetchPackageAdvisories(packageId!),
  });

  const { data: trackerStatus } = useQuery({
    queryKey: ["ticket-tracker-status"],
    enabled: open && scoped,
    queryFn: async () => (await getTicketTrackerStatus({ throwOnError: true })).data,
  });

  const createTicket = useMutation({
    mutationFn: async (ticketType: TicketType) =>
      (
        await createProjectPackageTicket({
          path: { projectId: projectId!, packageId: packageId! },
          query: { ticketType },
          throwOnError: true,
        })
      ).data,
    onSuccess: (created) => {
      if (created?.url) {
        toast.success("Ticket created", {
          description: created.name ?? undefined,
          action: {
            label: "Open",
            onClick: () => window.open(created.url ?? "", "_blank", "noopener,noreferrer"),
          },
        });
      } else {
        toast.success("Ticket created");
      }
      void queryClient.invalidateQueries({
        queryKey: ["project-package", projectId, packageId],
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to create ticket"),
  });

  const removeTicket = useMutation({
    mutationFn: async () =>
      (
        await deleteProjectTicket({
          path: { projectId: projectId!, packageId: packageId! },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("Ticket deleted");
      setConfirmDelete(false);
      void queryClient.invalidateQueries({
        queryKey: ["project-package", projectId, packageId],
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete ticket"),
  });

  // Normalize across the two detail shapes.
  const info: Packages | undefined = scoped
    ? projectDetail.data?.info
    : globalDetail.data?.info;
  const vulnerabilities: Vulnerabilities[] =
    (scoped ? projectDetail.data?.vulnerabilities : globalDetail.data?.vulnerabilities) ?? [];
  const ticket = scoped ? projectDetail.data?.ticket : null;
  const status = projectDetail.data?.status;
  const ignoreReason = projectDetail.data?.ignoreReason;
  const location = projectDetail.data?.location;

  const detailLoading = scoped ? projectDetail.isLoading : globalDetail.isLoading;

  const available: TicketType[] = VULN_TICKET_TYPES.filter((t) => {
    if (t === "Jira") return trackerStatus?.jira;
    if (t === "Redmine") return trackerStatus?.redmine;
    return true; // GitHub has no tracker-status flag; offer it when scoped.
  });

  const displayName = `${target?.group ? `${target.group}:` : info?.group ? `${info.group}:` : ""}${
    info?.name ?? target?.name ?? "Package"
  }`;
  const displayVersion = info?.version ?? target?.version ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="break-all">{displayName}</SheetTitle>
          <SheetDescription>
            {displayVersion ? <span className="font-mono">{displayVersion}</span> : null}
            {!scoped ? " · read-only (no project context)" : null}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          {/* Actions (project-scoped only) */}
          {scoped ? (
            <div className="flex flex-wrap items-center gap-2">
              {status ? (
                <PackageStatusMenu
                  projectId={projectId!}
                  packageId={packageId!}
                  status={status}
                  ignoreReason={ignoreReason}
                />
              ) : null}

              {hasTicket(ticket) ? (
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
                    disabled={removeTicket.isPending}
                    onClick={() => setConfirmDelete(true)}
                  >
                    {removeTicket.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4 text-destructive" />
                    )}
                  </Button>
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={createTicket.isPending}>
                      {createTicket.isPending ? (
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
                        <DropdownMenuItem
                          key={type}
                          onSelect={() => createTicket.mutate(type)}
                        >
                          {type}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ) : null}

          {/* Metadata */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Details</h3>
            {detailLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Meta label="Type" value={info?.type ? <Badge variant="outline">{info.type}</Badge> : "—"} />
                <Meta label="License" value={info?.license ?? "—"} />
                <Meta
                  label="Severity"
                  value={
                    <SeverityBadge
                      severity={info?.riskLevel === "None" ? null : info?.riskLevel}
                    />
                  }
                />
                <Meta label="Fixed version" value={info?.fixedVersion ?? "—"} />
                {scoped ? <Meta label="Status" value={status ?? "—"} /> : null}
                {scoped && location ? <Meta label="Location" value={location} /> : null}
                {scoped && ignoreReason ? (
                  <Meta label="Ignore reason" value={ignoreReason} className="col-span-2" />
                ) : null}
              </dl>
            )}
          </section>

          <Separator />

          {/* Vulnerabilities */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">
              Vulnerabilities{vulnerabilities.length ? ` (${vulnerabilities.length})` : ""}
            </h3>
            {detailLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : vulnerabilities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No known vulnerabilities.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {vulnerabilities.map((v, i) => {
                  const cve = v.identity ?? v.name;
                  const cveUrl = v.identity?.startsWith("CVE-")
                    ? `https://nvd.nist.gov/vuln/detail/${v.identity}`
                    : null;
                  return (
                    <li
                      key={v.id ?? `${cve}-${i}`}
                      className="flex flex-col gap-1 rounded-md border p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {cveUrl ? (
                          <a
                            href={cveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-sm font-medium text-primary hover:underline"
                          >
                            {cve}
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : (
                          <span className="font-mono text-sm font-medium">{cve ?? "Unknown"}</span>
                        )}
                        <SeverityBadge severity={v.severity} />
                      </div>
                      {v.description ? (
                        <p className="line-clamp-3 text-xs text-muted-foreground">
                          {v.description}
                        </p>
                      ) : null}
                      {v.fixedVersion ? (
                        <p className="text-xs text-muted-foreground">
                          Fixed in <span className="font-mono">{v.fixedVersion}</span>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Live OSV.dev advisories (only rendered when the service returns data) */}
          {(osvAdvisories.data?.length ?? 0) > 0 && (
            <>
              <Separator />
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">
                  Live OSV advisories ({osvAdvisories.data!.length})
                </h3>
                <ul className="flex flex-col gap-3">
                  {osvAdvisories.data!.map((a) => {
                    const fixed = a.affected?.find((p) => p.fixedVersion)?.fixedVersion;
                    return (
                      <li key={a.id} className="flex flex-col gap-1 rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={`https://osv.dev/vulnerability/${a.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-sm font-medium text-primary hover:underline"
                          >
                            {a.id}
                            <ExternalLink className="size-3.5" />
                          </a>
                          <span className="flex items-center gap-1.5">
                            <KevBadge kev={a.kev} />
                            <EpssBadge epss={a.epss} />
                            <SeverityBadge severity={a.severity ?? null} />
                          </span>
                        </div>
                        {(a.aliases?.length ?? 0) > 0 && (
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {a.aliases!.join(" · ")}
                          </p>
                        )}
                        {a.summary ? (
                          <p className="line-clamp-3 text-xs text-muted-foreground">{a.summary}</p>
                        ) : null}
                        {a.withdrawn ? (
                          <p className="text-xs text-medium">Withdrawn upstream.</p>
                        ) : fixed ? (
                          <p className="text-xs text-muted-foreground">
                            Fixed in <span className="font-mono">{fixed}</span>
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}

          <Separator />

          {/* Dependency path / chain */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Dependency path</h3>
            {dependencyChain.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : !dependencyChain.data || dependencyChain.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No dependency path available (direct dependency).
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {dependencyChain.data.map((dep, i) => (
                  <li
                    key={dep.id ?? i}
                    className="flex items-center gap-2"
                    style={{ paddingLeft: `${i * 12}px` }}
                  >
                    <span className="text-muted-foreground">{i === 0 ? "" : "↳"}</span>
                    <span className="font-medium">
                      {dep.group ? `${dep.group}:` : ""}
                      {dep.name ?? "Unknown"}
                    </span>
                    {dep.version ? (
                      <span className="font-mono text-xs text-muted-foreground">{dep.version}</span>
                    ) : null}
                    {dep.isVulnerable ? (
                      <Badge variant="destructive" className="text-[10px]">
                        vulnerable
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>

      {/* Delete-ticket confirmation */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete ticket?</DialogTitle>
            <DialogDescription>
              This removes the link to{" "}
              {hasTicket(ticket) ? (ticket.name ?? `the ${ticket.type} ticket`) : "the ticket"} from
              this package. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(false)}
              disabled={removeTicket.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => removeTicket.mutate()}
              disabled={removeTicket.isPending}
            >
              {removeTicket.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

function Meta({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
