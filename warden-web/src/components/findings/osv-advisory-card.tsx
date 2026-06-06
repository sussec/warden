"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownView } from "@/components/markdown/markdown-view";
import { EpssBadge, KevBadge, type EpssBlock, type KevBlock } from "@/components/findings/exploit-intel";

// Mirrors warden-api's OsvAdvisory DTO (GET /api/finding/{id}/advisory),
// which mirrors the warden-osv flattened advisory shape.
type OsvAdvisory = {
  id: string;
  aliases?: string[] | null;
  summary?: string | null;
  details?: string | null;
  severity?: string | null;
  cvss?: string | null;
  published?: string | null;
  modified?: string | null;
  withdrawn?: string | null;
  references?: { type: string; url: string }[] | null;
  affected?: { ecosystem: string; name: string; fixedVersion?: string | null }[] | null;
  epss?: EpssBlock | null;
  kev?: KevBlock | null;
};

// Finding identities that can resolve to an OSV record (CVE/GHSA/OSV/PYSEC/…).
// SAST fingerprints ("ruleId:path:line") never match — skip the request entirely.
const ADVISORY_ID = /^[A-Za-z]{2,16}-[A-Za-z0-9][A-Za-z0-9.-]*$/;

const SEVERITY_STYLE: Record<string, string> = {
  Critical: "bg-critical/15 text-critical",
  High: "bg-high/15 text-high",
  Medium: "bg-medium/15 text-medium",
  Low: "bg-low/15 text-low",
};

const MAX_REFERENCES = 8;

async function fetchAdvisory(findingId: string): Promise<OsvAdvisory | null> {
  const res = await fetch(`/api/finding/${findingId}/advisory`, {
    credentials: "same-origin",
  });
  if (res.status === 404) return null; // disabled, non-advisory identity, or unknown id
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as OsvAdvisory;
}

export function OsvAdvisoryCard({
  findingId,
  identity,
}: {
  findingId: string;
  identity?: string | null;
}) {
  const eligible = !!identity && ADVISORY_ID.test(identity);

  const { data: advisory, isLoading } = useQuery({
    queryKey: ["finding-osv-advisory", findingId],
    queryFn: () => fetchAdvisory(findingId),
    enabled: eligible,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (!eligible) return null;
  if (isLoading) {
    return (
      <Card className="space-y-3 p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
    );
  }
  if (!advisory) return null;

  const references = (advisory.references ?? []).slice(0, MAX_REFERENCES);
  const affected = advisory.affected ?? [];

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <ShieldAlert className="size-4 text-primary" />
          OSV advisory
        </h2>
        <Badge variant="outline" className="font-mono text-xs">{advisory.id}</Badge>
        {(advisory.aliases ?? []).map((a) => (
          <Badge key={a} variant="outline" className="font-mono text-xs text-muted-foreground">
            {a}
          </Badge>
        ))}
        {advisory.severity && (
          <Badge
            variant="outline"
            className={`border-transparent ${SEVERITY_STYLE[advisory.severity] ?? "bg-muted text-muted-foreground"}`}
          >
            {advisory.severity}
          </Badge>
        )}
        <KevBadge kev={advisory.kev} />
        <EpssBadge epss={advisory.epss} />
      </div>

      {advisory.kev && (
        <p className="rounded-md bg-critical/10 px-3 py-2 text-sm text-critical">
          Listed in the CISA Known Exploited Vulnerabilities catalog
          {advisory.kev.dateAdded ? ` since ${advisory.kev.dateAdded}` : ""}
          {advisory.kev.ransomwareUse === "Known" ? " and used in ransomware campaigns" : ""} —
          prioritize remediation.
        </p>
      )}

      {advisory.withdrawn && (
        <p className="rounded-md bg-medium/10 px-3 py-2 text-sm text-medium">
          Withdrawn upstream on {new Date(advisory.withdrawn).toLocaleDateString()} — likely no
          longer considered a vulnerability.
        </p>
      )}

      {(advisory.summary || advisory.details) && (
        <MarkdownView content={advisory.details || advisory.summary || ""} />
      )}

      <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {advisory.cvss && (
          <div className="col-span-2 min-w-0 md:col-span-3">
            <dt className="text-xs font-medium uppercase text-muted-foreground">CVSS</dt>
            <dd className="break-all font-mono text-xs">{advisory.cvss}</dd>
          </div>
        )}
        {advisory.published && (
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">Published</dt>
            <dd className="text-sm">{new Date(advisory.published).toLocaleDateString()}</dd>
          </div>
        )}
        {advisory.modified && (
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">Modified</dt>
            <dd className="text-sm">{new Date(advisory.modified).toLocaleDateString()}</dd>
          </div>
        )}
      </dl>

      {affected.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium uppercase text-muted-foreground">Affected packages</h3>
          <ul className="space-y-1">
            {affected.map((p) => (
              <li key={`${p.ecosystem}/${p.name}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-xs">{p.name}</span>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  {p.ecosystem}
                </Badge>
                {p.fixedVersion ? (
                  <span className="text-xs text-low">fixed in {p.fixedVersion}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">no fix published</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {references.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium uppercase text-muted-foreground">References</h3>
          <ul className="space-y-1">
            {references.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 break-all text-xs text-primary hover:underline"
                >
                  <ExternalLink className="size-3 shrink-0" />
                  {r.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
