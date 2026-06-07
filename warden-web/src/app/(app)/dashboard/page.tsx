"use client";

import { useMemo, useState } from "react";
import { subDays } from "date-fns";
import { CalendarDays } from "lucide-react";
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

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">Security Posture</h1>
          <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-xs font-medium backdrop-blur-md">
            <span className="size-1.5 animate-pulse rounded-full bg-[color:var(--severity-info,#0ea5e9)]" />
            LIVE
          </span>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger size="sm" className="w-40 bg-card/70 backdrop-blur-md">
            <CalendarDays className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
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
