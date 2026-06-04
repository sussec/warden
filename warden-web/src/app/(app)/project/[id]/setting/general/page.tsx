"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProjectInfo,
  getDefaultBranchesProject,
  updateDefaultBranchesProject,
  getThresholdProject,
  updateThresholdProject,
} from "@/client/sdk.gen";
import type { ThresholdMode, ThresholdSetting } from "@/client/types.gen";

const MODES: ThresholdMode[] = ["MonitorOnly", "BlockOnConfirmation", "BlockOnDetection"];

function ThresholdForm({
  title,
  value,
  onChange,
}: {
  title: string;
  value: ThresholdSetting;
  onChange: (v: ThresholdSetting) => void;
}) {
  const counts: { key: keyof ThresholdSetting; label: string }[] = [
    { key: "critical", label: "Critical" },
    { key: "high", label: "High" },
    { key: "medium", label: "Medium" },
    { key: "low", label: "Low" },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <h4 className="font-semibold">{title}</h4>
      <div className="space-y-2">
        <Label>Mode</Label>
        <Select
          value={value.mode ?? "MonitorOnly"}
          onValueChange={(v) => onChange({ ...value, mode: v as ThresholdMode })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map((c) => (
          <div key={c.key} className="space-y-2">
            <Label>{c.label}</Label>
            <Input
              type="number"
              min={0}
              value={(value[c.key] as number | undefined) ?? 0}
              onChange={(e) => onChange({ ...value, [c.key]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProjectGeneralSettingPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: info } = useQuery({
    queryKey: ["project-info", id],
    queryFn: async () =>
      (await getProjectInfo({ path: { projectId: id }, throwOnError: true })).data,
  });

  const { data: branchesData } = useQuery({
    queryKey: ["project-default-branches", id],
    queryFn: async () =>
      (await getDefaultBranchesProject({ path: { projectId: id }, throwOnError: true })).data,
  });

  const { data: thresholdData } = useQuery({
    queryKey: ["project-threshold", id],
    queryFn: async () =>
      (await getThresholdProject({ path: { projectId: id }, throwOnError: true })).data,
  });

  const [branches, setBranches] = useState<string[]>([]);
  const [newBranch, setNewBranch] = useState("");
  const [sast, setSast] = useState<ThresholdSetting>({});
  const [sca, setSca] = useState<ThresholdSetting>({});

  useEffect(() => {
    if (branchesData) setBranches(branchesData.filter((b): b is string => !!b));
  }, [branchesData]);

  useEffect(() => {
    if (thresholdData) {
      setSast(thresholdData.sast ?? {});
      setSca(thresholdData.sca ?? {});
    }
  }, [thresholdData]);

  const saveBranches = useMutation({
    mutationFn: async () =>
      (
        await updateDefaultBranchesProject({
          path: { projectId: id },
          body: branches,
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("Default branches saved.");
      queryClient.invalidateQueries({ queryKey: ["project-default-branches", id] });
    },
    onError: () => toast.error("Could not save default branches."),
  });

  const saveThreshold = useMutation({
    mutationFn: async () =>
      (
        await updateThresholdProject({
          path: { projectId: id },
          // mode is non-nullable server-side — never serialize it missing
          body: {
            sast: { mode: "MonitorOnly", ...sast },
            sca: { mode: "MonitorOnly", ...sca },
          },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("Thresholds saved.");
      queryClient.invalidateQueries({ queryKey: ["project-threshold", id] });
    },
    onError: () => toast.error("Could not save thresholds."),
  });

  function addBranch() {
    const b = newBranch.trim();
    if (b && !branches.includes(b)) setBranches((prev) => [...prev, b]);
    setNewBranch("");
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">General</h2>
        <div className="space-y-2">
          <Label htmlFor="name">Project name</Label>
          {info ? (
            <Input id="name" value={info.name ?? ""} readOnly disabled />
          ) : (
            <Skeleton className="h-9 w-full" />
          )}
        </div>
        {info?.repoUrl && (
          <div className="space-y-2">
            <Label htmlFor="repo">Repository URL</Label>
            <Input id="repo" value={info.repoUrl} readOnly disabled />
          </div>
        )}
      </div>

      <Separator />

      <Card className="flex flex-col gap-3 p-4">
        <h3 className="font-semibold">Default Branches</h3>
        <div className="flex flex-wrap gap-2">
          {branches.length === 0 && (
            <span className="text-sm text-muted-foreground">No default branches set.</span>
          )}
          {branches.map((b) => (
            <Badge key={b} variant="secondary" className="gap-1">
              {b}
              <button
                type="button"
                onClick={() => setBranches((prev) => prev.filter((x) => x !== b))}
                aria-label={`Remove ${b}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            className="w-64"
            placeholder="Add branch…"
            value={newBranch}
            onChange={(e) => setNewBranch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addBranch();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addBranch}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
        <div>
          <Button onClick={() => saveBranches.mutate()} disabled={saveBranches.isPending}>
            {saveBranches.isPending ? "Saving…" : "Save branches"}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <h3 className="font-semibold">Security Threshold</h3>
        <ThresholdForm title="SAST" value={sast} onChange={setSast} />
        <ThresholdForm title="SCA" value={sca} onChange={setSca} />
        <div>
          <Button onClick={() => saveThreshold.mutate()} disabled={saveThreshold.isPending}>
            {saveThreshold.isPending ? "Saving…" : "Save thresholds"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
