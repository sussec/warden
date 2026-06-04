import type { FindingStatus } from "@/client/types.gen";

export interface FindingStatusMeta {
  status: FindingStatus;
  /** Human label, matches the Angular app. */
  label: string;
  description: string;
  /** Tailwind classes for the status badge (bg + text). */
  badge: string;
}

// Status palette — parity with the Angular app:
//   Open=muted, Confirmed=teal/secondary, AcceptedRisk=high(orange), Fixed=info(green).
const STATUS_META: Record<FindingStatus, FindingStatusMeta> = {
  Open: {
    status: "Open",
    label: "Need Triage",
    description:
      "Newly discovered vulnerabilities. Will remain open until reviewed or retested.",
    badge: "bg-muted text-muted-foreground",
  },
  Confirmed: {
    status: "Confirmed",
    label: "Confirmed",
    description:
      "Vulnerabilities that have been acknowledged as valid and require remediation.",
    badge: "bg-secondary/20 text-secondary",
  },
  AcceptedRisk: {
    status: "AcceptedRisk",
    label: "Accepted Risk",
    description:
      "Vulnerabilities acknowledged but deemed low risk. Accepted without a fix and excluded from future scans.",
    badge: "bg-high/20 text-high",
  },
  Fixed: {
    status: "Fixed",
    label: "Fixed",
    description:
      "Vulnerabilities that are no longer detected. Status is updated automatically from future scans.",
    badge: "bg-info/20 text-info",
  },
  Incorrect: {
    status: "Incorrect",
    label: "False Positive",
    description:
      "Vulnerabilities incorrectly identified. Marking as false positive to exclude them from future scans.",
    badge: "bg-muted text-muted-foreground",
  },
};

export function findingStatusMeta(status: FindingStatus): FindingStatusMeta {
  return STATUS_META[status] ?? STATUS_META.Open;
}

/** Order shown in the "mark as" / status select menus (parity with Angular). */
export const FINDING_STATUS_ORDER: FindingStatus[] = [
  "Open",
  "Confirmed",
  "AcceptedRisk",
  "Fixed",
  "Incorrect",
];

export function findingStatusOptions(): FindingStatusMeta[] {
  return FINDING_STATUS_ORDER.map(findingStatusMeta);
}
