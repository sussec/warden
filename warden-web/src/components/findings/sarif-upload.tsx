"use client";

import { useState } from "react";
import { Upload, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  CiScanRequest,
  SarifLog,
  SourceType,
  CommitType,
  ScannerType,
  UploadCiFindingResponse,
} from "@/client/types.gen";

/**
 * Manual SARIF upload helper.
 *
 * NOTE: POST /api/ci/sarif is authenticated with a CI access token (CI-TOKEN
 * header), NOT the browser's cookie session. So this dialog asks the admin for
 * a CI token (Settings > Access Token) and sends the request via raw fetch.
 */
export function SarifUpload({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [scanner, setScanner] = useState("manual-upload");
  const [branch, setBranch] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [fileName, setFileName] = useState("");
  const [sarif, setSarif] = useState<SarifLog | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setToken("");
    setScanner("manual-upload");
    setBranch("");
    setCommitHash("");
    setFileName("");
    setSarif(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as SarifLog;
      if (!Array.isArray(parsed.runs)) {
        throw new Error("Missing SARIF `runs` array");
      }
      setSarif(parsed);
    } catch (err) {
      setSarif(null);
      toast.error(err instanceof Error ? `Invalid SARIF: ${err.message}` : "Invalid SARIF file");
    }
  }

  async function onUpload() {
    if (!token.trim()) {
      toast.error("A CI access token is required (Settings > Access Token).");
      return;
    }
    if (!sarif) {
      toast.error("Select a valid .sarif JSON file first.");
      return;
    }
    if (!commitHash.trim()) {
      toast.error("Commit hash is required.");
      return;
    }

    const scan: CiScanRequest = {
      source: "Local" satisfies SourceType,
      repoId: projectId,
      repoUrl: "",
      gitAction: "CommitBranch" satisfies CommitType,
      scanTitle: fileName || "Manual SARIF upload",
      commitBranch: branch.trim() || null,
      commitHash: commitHash.trim(),
      scanner: scanner.trim() || "manual-upload",
      type: "Sast" satisfies ScannerType,
      isDefault: false,
    };

    setBusy(true);
    try {
      // CI endpoints are CI-token authed, not cookie-session authed — raw fetch
      // with the CI-TOKEN header (same-origin).
      const res = await fetch("/api/ci/sarif", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CI-TOKEN": token.trim(),
        },
        body: JSON.stringify({ scan, sarif }),
      });
      if (!res.ok) {
        throw new Error(
          res.status === 401 || res.status === 403
            ? "Invalid or expired CI token."
            : `Upload failed (${res.status})`,
        );
      }
      const result = (await res.json()) as UploadCiFindingResponse;
      const created = result.newFindings?.length ?? 0;
      const open = result.openFindings?.length ?? 0;
      const fixed = result.fixedFindings?.length ?? 0;
      toast.success(`SARIF imported — ${created} new, ${open} existing, ${fixed} fixed.`);
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "SARIF upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="size-4" />
          Upload SARIF
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload SARIF</DialogTitle>
          <DialogDescription>
            Import a SARIF report into this project. This uses the CI ingestion endpoint, so a CI
            access token is required (Settings &gt; Access Token) — your browser session is not used.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sarif-token" className="flex items-center gap-1.5">
              <KeyRound className="size-3.5" />
              CI Access Token
            </Label>
            <Input
              id="sarif-token"
              type="password"
              autoComplete="off"
              placeholder="ci_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sarif-file">SARIF file</Label>
            <Input id="sarif-file" type="file" accept=".sarif,.json,application/json" onChange={onFile} />
            {fileName && (
              <span className="font-mono text-xs text-muted-foreground">
                {fileName}
                {sarif ? ` — ${sarif.runs?.length ?? 0} run(s)` : " — not parsed"}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sarif-scanner">Scanner</Label>
              <Input
                id="sarif-scanner"
                value={scanner}
                onChange={(e) => setScanner(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sarif-branch">Branch</Label>
              <Input
                id="sarif-branch"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sarif-commit">Commit hash</Label>
            <Input
              id="sarif-commit"
              placeholder="abc1234…"
              value={commitHash}
              onChange={(e) => setCommitHash(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="default" size="sm" className="gap-2" disabled={busy} onClick={onUpload}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
