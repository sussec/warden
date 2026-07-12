"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { subDays } from "date-fns";
import { CalendarDays, Shield } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./_components/overview-tab";
import { FindingsTab } from "./_components/findings-tab";

const RANGES = [
  { value: "7", label: "Past 7 days" },
  { value: "30", label: "Past 30 days" },
  { value: "90", label: "Past 90 days" },
];

export default function DashboardPage() {
  const [days, setDays] = useState("30");

  const body = useMemo(() => {
    const end = new Date();
    return { startDate: subDays(end, Number(days)).toISOString(), endDate: end.toISOString() };
  }, [days]);

  const windowLabel = RANGES.find((r) => r.value === days)?.label ?? `Past ${days} days`;

  return (
    <div className="relative mx-auto w-full max-w-[1600px] space-y-5 pb-8">
      {/* Generated ops hero field (Techanv-inspired atmospheric backdrop) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-2 h-64 overflow-hidden rounded-xl sm:h-72"
      >
        <Image
          src="/dashboard/hero-ops.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 1600px) 100vw, 1600px"
          className="object-cover object-center opacity-40 dark:opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/55 to-background" />
        <div className="absolute inset-0 opacity-50 warden-dot-grid mix-blend-soft-light" />
      </div>

      {/* Command header */}
      <header className="relative space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="relative mt-0.5 hidden size-12 shrink-0 overflow-hidden rounded-lg border border-primary/30 shadow-[0_0_24px_-6px_color-mix(in_oklab,var(--primary)_55%,transparent)] sm:block">
              <Image
                src="/dashboard/mark.jpg"
                alt=""
                fill
                sizes="48px"
                className="object-cover"
                priority
              />
            </div>
            <div className="space-y-1.5">
              <p className="warden-mono-label flex items-center gap-2">
                <Shield className="size-3.5 text-primary" aria-hidden />
                Ops · Security posture
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Security Posture
                </h1>
                <span className="warden-live-chip">Live</span>
              </div>
              <p className="max-w-xl text-sm text-muted-foreground">
                Blocking constraint view across SAST, SCA, and dependency risk — security baked into
                every phase, not a checklist after the fact.
              </p>
            </div>
          </div>

          <Select value={days} onValueChange={setDays}>
            <SelectTrigger
              size="sm"
              className="w-44 border-border/80 bg-card/80 font-mono text-xs backdrop-blur-md"
            >
              <CalendarDays className="size-3.5 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value} className="font-mono text-xs">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="warden-status-bar" role="status" aria-live="polite">
          <span>
            WINDOW <strong>{windowLabel.toUpperCase()}</strong>
          </span>
          <span className="sep" aria-hidden />
          <span>
            TELEMETRY <strong>SAST + SCA</strong>
          </span>
          <span className="sep" aria-hidden />
          <span>
            GATE <strong className="text-primary">ACTIVE</strong>
          </span>
          <span className="sep hidden sm:block" aria-hidden />
          <span className="hidden sm:inline">
            FEED <strong>REAL-TIME</strong>
          </span>
        </div>
      </header>

      <Tabs defaultValue="overview" className="relative gap-4">
        <TabsList className="h-10 border border-border/70 bg-card/70 p-1 font-mono text-xs backdrop-blur-md">
          <TabsTrigger value="overview" className="px-4 font-mono text-xs tracking-wide">
            Overview
          </TabsTrigger>
          <TabsTrigger value="findings" className="px-4 font-mono text-xs tracking-wide">
            Findings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab body={body} />
        </TabsContent>
        <TabsContent value="findings">
          <FindingsTab body={body} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
