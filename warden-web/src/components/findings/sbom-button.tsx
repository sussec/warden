"use client";

import { useState } from "react";
import { FileJson } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Download a CycloneDX 1.5 SBOM for the project's latest package inventory. */
export function SbomButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);

  async function onDownload() {
    setLoading(true);
    try {
      // session travels in httpOnly cookies (same-origin)
      const res = await fetch(`/api/project/${projectId}/sbom`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "No package inventory yet — run a dependency or container scan first."
            : `SBOM export failed (${res.status})`,
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectId}-sbom.cdx.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "SBOM export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="gap-2" disabled={loading} onClick={onDownload}>
      <FileJson className="size-4" />
      {loading ? "Exporting…" : "Export SBOM"}
    </Button>
  );
}
