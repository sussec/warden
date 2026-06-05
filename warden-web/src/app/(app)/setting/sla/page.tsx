"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getSlaSetting, updateSlaSetting } from "@/client/sdk.gen";
import type { Sla, SlaSetting } from "@/client/types.gen";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function SlaFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: Sla;
  onChange: (v: Sla) => void;
}) {
  const fields: { key: keyof Sla; label: string }[] = [
    { key: "critical", label: "Critical" },
    { key: "high", label: "High" },
    { key: "medium", label: "Medium" },
    { key: "low", label: "Low" },
    { key: "info", label: "Info" },
  ];
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-5">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`${title}-${f.key}`} className="text-xs">
              {f.label}
            </Label>
            <Input
              id={`${title}-${f.key}`}
              type="number"
              min={0}
              value={value[f.key] ?? 0}
              onChange={(e) => onChange({ ...value, [f.key]: num(e.target.value) })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SlaSettingPage() {
  const [form, setForm] = useState<SlaSetting>({ sast: {}, sca: {} });

  const { data } = useQuery({
    queryKey: ["setting-sla"],
    queryFn: async () => (await getSlaSetting({ throwOnError: true })).data,
  });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      await updateSlaSetting({ body: form, throwOnError: true });
    },
    onSuccess: () => toast.success("SLA settings saved"),
    onError: () => toast.error("Failed to save SLA settings"),
  });

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      {/* header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">SLA</h1>
          <p className="text-xs text-muted-foreground">
            Remediation deadlines (in days) per severity
          </p>
        </div>
      </div>

      {/* form — scrolls inside, page stays fixed */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-md">
        <Card className="border-0 bg-transparent shadow-none backdrop-blur-none">
          <CardHeader>
            <CardTitle>SLA</CardTitle>
            <CardDescription>Remediation deadlines (in days) per severity.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <SlaFields
                title="SAST"
                value={form.sast ?? {}}
                onChange={(v) => setForm((f) => ({ ...f, sast: v }))}
              />
              <SlaFields
                title="SCA"
                value={form.sca ?? {}}
                onChange={(v) => setForm((f) => ({ ...f, sca: v }))}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
