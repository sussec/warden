"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type ScanStreamEvent = {
  type: string;
  jobId?: string | null;
  scanner?: string | null;
  status?: string | null;
  target?: string | null;
  line?: string | null;
  log?: string | null;
  at: string;
};

export type ScanLogLine = { id: string; text: string; jobId?: string; at: number };

export type JobLiveState = {
  jobId: string;
  scanner?: string;
  status: string;
  target?: string;
  startedAt?: number;
  endedAt?: number;
  lineCount: number;
  lastLine?: string;
  /** Full log text from API poll (authoritative when complete). */
  logText?: string;
};

function normId(id?: string | null) {
  return (id ?? "").toLowerCase();
}

/**
 * Live scan-job feed.
 * Prefer SSE (works through Next.js HTTP rewrites). WS is optional upgrade.
 * Pair with polling in the Run popup — stream can miss fast jobs.
 */
export function useScanStream(opts?: { focusJobId?: string | null; enabled?: boolean }) {
  const focusJobId = opts?.focusJobId ?? null;
  const enabled = opts?.enabled !== false;
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [transport, setTransport] = useState<"ws" | "sse" | "off">("off");
  const [lines, setLines] = useState<ScanLogLine[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobLiveState>>({});
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const seq = useRef(0);

  const pushLine = useCallback((text: string, jobId?: string | null) => {
    const id = `${Date.now()}-${seq.current++}`;
    const at = Date.now();
    const jid = jobId ? normId(jobId) : undefined;
    setLines((prev) => {
      const next = [...prev, { id, text, jobId: jid, at }];
      return next.length > 1200 ? next.slice(-1200) : next;
    });
    if (jid) {
      setJobs((prev) => {
        const cur = prev[jid] ?? { jobId: jid, status: "Running", lineCount: 0 };
        return {
          ...prev,
          [jid]: { ...cur, lineCount: cur.lineCount + 1, lastLine: text },
        };
      });
    }
  }, []);

  const upsertJob = useCallback((partial: Partial<JobLiveState> & { jobId: string }) => {
    const jid = normId(partial.jobId);
    setJobs((prev) => {
      const cur = prev[jid] ?? { jobId: jid, status: "Queued", lineCount: 0 };
      const next: JobLiveState = { ...cur, ...partial, jobId: jid };
      if (partial.status === "Running" && !next.startedAt) next.startedAt = Date.now();
      if (
        (partial.status === "Succeeded" || partial.status === "Failed") &&
        !next.endedAt
      ) {
        next.endedAt = Date.now();
      }
      return { ...prev, [jid]: next };
    });
  }, []);

  /** Merge polled job snapshot (status + full log) into live state. */
  const applyJobSnapshot = useCallback(
    (snap: {
      id: string;
      status: string;
      scanner?: string;
      target?: string;
      log?: string | null;
      startedAt?: string | null;
      completedAt?: string | null;
    }) => {
      const jid = normId(snap.id);
      const logText = snap.log ?? "";
      upsertJob({
        jobId: jid,
        scanner: snap.scanner,
        status: snap.status,
        target: snap.target,
        logText,
        startedAt: snap.startedAt ? Date.parse(snap.startedAt) : undefined,
        endedAt: snap.completedAt ? Date.parse(snap.completedAt) : undefined,
        lineCount: logText ? logText.split("\n").filter(Boolean).length : undefined,
      });

      // Seed console from full log if we have no stream lines for this job yet
      if (logText) {
        setLines((prev) => {
          const existing = prev.filter((l) => l.jobId === jid);
          if (existing.length > 0) {
            // Prefer richer polled log when job is done
            if (snap.status === "Succeeded" || snap.status === "Failed") {
              const others = prev.filter((l) => l.jobId !== jid);
              const seeded = logText
                .split("\n")
                .filter((t) => t.length > 0)
                .map((text, i) => ({
                  id: `poll-${jid}-${i}`,
                  text,
                  jobId: jid,
                  at: Date.now(),
                }));
              return [...others, ...seeded];
            }
            return prev;
          }
          const seeded = logText
            .split("\n")
            .filter((t) => t.length > 0)
            .map((text, i) => ({
              id: `poll-${jid}-${i}`,
              text,
              jobId: jid,
              at: Date.now(),
            }));
          return [...prev, ...seeded];
        });
      }
    },
    [upsertJob],
  );

  const clearLog = useCallback(() => setLines([]), []);

  useEffect(() => {
    if (!enabled) return;

    let closed = false;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const onEvent = (evt: ScanStreamEvent) => {
      if (evt.type === "hello") {
        setConnected(true);
        return;
      }
      const jid = evt.jobId ? normId(evt.jobId) : null;
      if (jid) setActiveJobId(jid);

      if (jid && (evt.type === "job.queued" || evt.status === "Queued")) {
        upsertJob({
          jobId: jid,
          scanner: evt.scanner ?? undefined,
          status: "Queued",
          target: evt.target ?? undefined,
        });
        pushLine(`[queue] ${evt.scanner ?? "scan"} → ${evt.target ?? ""}`, jid);
        queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
        return;
      }

      if (jid && (evt.type === "job.running" || evt.status === "Running")) {
        upsertJob({
          jobId: jid,
          scanner: evt.scanner ?? undefined,
          status: "Running",
          target: evt.target ?? undefined,
          startedAt: Date.now(),
        });
        pushLine(`[running] ${evt.scanner ?? "scan"}`, jid);
        queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
        return;
      }

      if (evt.type === "job.log" && evt.line) {
        if (jid) upsertJob({ jobId: jid, scanner: evt.scanner ?? undefined, status: "Running" });
        pushLine(evt.line, jid);
        return;
      }

      if (evt.type === "job.completed" || evt.status === "Succeeded") {
        if (jid) {
          upsertJob({
            jobId: jid,
            scanner: evt.scanner ?? undefined,
            status: "Succeeded",
            endedAt: Date.now(),
            logText: evt.log ?? undefined,
          });
        }
        pushLine(
          `[succeeded] ${evt.scanner ?? ""}${evt.log ? ` — ${evt.log.slice(0, 160)}` : ""}`,
          jid,
        );
        queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
        queryClient.invalidateQueries({ queryKey: ["scanners"] });
        queryClient.invalidateQueries({ queryKey: ["findings"] });
        return;
      }

      if (evt.type === "job.failed" || evt.status === "Failed") {
        if (jid) {
          upsertJob({
            jobId: jid,
            scanner: evt.scanner ?? undefined,
            status: "Failed",
            endedAt: Date.now(),
            logText: evt.log ?? undefined,
          });
        }
        pushLine(
          `[failed] ${evt.scanner ?? ""}${evt.log ? ` — ${evt.log.slice(0, 200)}` : ""}`,
          jid,
        );
        queryClient.invalidateQueries({ queryKey: ["scan-jobs"] });
      }
    };

    const connectSse = () => {
      if (closed) return;
      setTransport("sse");
      es = new EventSource("/api/scan-job/stream", { withCredentials: true });
      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es?.close();
        es = null;
        if (!closed) retry = setTimeout(connectSse, 2500);
      };
      const handler = (e: MessageEvent) => {
        try {
          onEvent(JSON.parse(e.data) as ScanStreamEvent);
        } catch {
          /* ignore */
        }
      };
      ["hello", "job.queued", "job.running", "job.log", "job.completed", "job.failed", "job.status", "message"].forEach(
        (name) => es!.addEventListener(name, handler as EventListener),
      );
    };

    // SSE first — reliable through Next.js rewrites. Skip fragile WS upgrade.
    connectSse();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [enabled, pushLine, queryClient, upsertJob]);

  const focusKey = focusJobId ? normId(focusJobId) : null;

  const focusedLines = useMemo(() => {
    if (!focusKey) return lines;
    return lines.filter((l) => !l.jobId || l.jobId === focusKey);
  }, [lines, focusKey]);

  const focusedJob = focusKey ? jobs[focusKey] ?? null : null;

  return {
    connected,
    transport,
    lines,
    focusedLines,
    jobs,
    focusedJob,
    activeJobId,
    clearLog,
    setActiveJobId,
    upsertJob,
    applyJobSnapshot,
  };
}
