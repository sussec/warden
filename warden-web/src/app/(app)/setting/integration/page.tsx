"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FaEnvelope, FaGithub, FaGitlab, FaJira, FaMicrosoft } from "react-icons/fa6";
import { SiRedmine } from "react-icons/si";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FolderGit2,
  Loader2,
  Lock,
  ScanSearch,
  Webhook as WebhookIcon,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getJiraIntegrationSetting,
  updateJiraIntegrationSetting,
  testJiraIntegrationSetting,
  getRedmineIntegrationSetting,
  updateRedmineIntegrationSetting,
  testRedmineIntegrationSetting,
  getTeamsIntegrationSetting,
  updateTeamsIntegrationSetting,
  testTeamsIntegrationSetting,
  getMailIntegrationSetting,
  updateMailIntegrationSetting,
  getGitHubIntegrationSetting,
  updateGitHubIntegrationSetting,
  testGitHubIntegrationSetting,
  getJiraWebhookIntegrationSetting,
  updateJiraWebhookIntegrationSetting,
  getWebhookIntegrationSetting,
  updateWebhookIntegrationSetting,
  testWebhookIntegrationSetting,
  getJiraProjects,
  getJiraIssueTypes,
  getRedmineMetadataIntegration,
  getGitHubMetadataIntegration,
} from "@/client/sdk.gen";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  JiraSetting,
  RedmineSetting,
  TeamsAlertSetting,
  MailAlertSetting,
  GitHubSetting,
  JiraWebhookSetting,
  WebhookSetting,
  WebhookFormat,
} from "@/client/types.gen";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Renders a metadata-driven Select when `options` are available, otherwise
 * falls back to a free-text Input so the form never breaks when the metadata
 * endpoint is unreachable (e.g. credentials not yet configured).
 */
function SelectOrInput({
  id,
  value,
  onChange,
  options,
  placeholder,
  inputProps,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[] | undefined;
  placeholder?: string;
  inputProps?: React.ComponentProps<typeof Input>;
}) {
  // Use a Select only when we have at least one option to choose from.
  if (options && options.length > 0) {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      id={id}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      {...inputProps}
    />
  );
}

/** Same idea as SelectOrInput, but for numeric IDs (Redmine fields). */
function SelectOrNumberInput({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: number | undefined;
  onChange: (v: number) => void;
  options: { id: number; name: string | null }[] | undefined;
}) {
  if (options && options.length > 0) {
    return (
      <Select
        value={value != null && value !== 0 ? String(value) : undefined}
        onValueChange={(v) => onChange(num(v))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>
              {o.name ?? String(o.id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      id={id}
      type="number"
      value={value ?? 0}
      onChange={(e) => onChange(num(e.target.value))}
    />
  );
}

const ALERT_EVENTS: { key: keyof TeamsAlertSetting & keyof MailAlertSetting; label: string }[] = [
  { key: "securityAlertEvent", label: "Security alerts" },
  { key: "newFindingEvent", label: "New findings" },
  { key: "fixedFindingEvent", label: "Fixed findings" },
  { key: "needTriageFindingEvent", label: "Needs triage" },
  { key: "scanCompletedEvent", label: "Scan completed" },
  { key: "scanFailedEvent", label: "Scan failed" },
  { key: "projectWithoutMemberEvent", label: "Project without member" },
];

/* ---------------------------- Jira ---------------------------- */
function JiraCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<JiraSetting>({});

  const { data } = useQuery({
    queryKey: ["integration-jira"],
    queryFn: async () => (await getJiraIntegrationSetting({ throwOnError: true })).data,
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data);
  }

  const save = useMutation({
    mutationFn: async (body: JiraSetting) => {
      await updateJiraIntegrationSetting({ body, throwOnError: true });
    },
    onSuccess: () => {
      toast.success("Jira settings saved");
      queryClient.invalidateQueries({ queryKey: ["integration-jira"] });
    },
    onError: () => toast.error("Failed to save Jira settings"),
  });

  const test = useMutation({
    // the test endpoint checks the SAVED settings — persist the form first
    mutationFn: async (body: JiraSetting) => {
      await updateJiraIntegrationSetting({ body, throwOnError: true });
      queryClient.invalidateQueries({ queryKey: ["integration-jira"] });
      return (await testJiraIntegrationSetting({ throwOnError: true })).data;
    },
    onSuccess: (ok) => (ok ? toast.success("Jira connection OK") : toast.error("Jira test failed")),
    onError: () => toast.error("Jira test failed"),
  });

  // Metadata-driven dropdowns. We pass the current (possibly unsaved) form as
  // the body so credentials don't have to be persisted first. Failures (e.g.
  // bad creds / not configured) fall back to free-text inputs — never block.
  const hasCreds = Boolean(form.apiUrl && form.userName && form.password);
  const projectsQuery = useQuery({
    queryKey: ["integration-jira-projects", form.apiUrl, form.userName],
    enabled: open && hasCreds,
    retry: false,
    queryFn: async () => {
      const res = await getJiraProjects({ body: form, throwOnError: false });
      return res.data ?? [];
    },
  });
  const issueTypesQuery = useQuery({
    queryKey: ["integration-jira-issue-types", form.projectKey],
    enabled: open && hasCreds && Boolean(form.projectKey),
    retry: false,
    queryFn: async () => {
      const res = await getJiraIssueTypes({
        query: { projectKey: form.projectKey ?? undefined },
        throwOnError: false,
      });
      return res.data ?? [];
    },
  });

  const projectOptions = projectsQuery.data
    ?.filter((p): p is { key: string; name: string | null } => Boolean(p.key))
    .map((p) => ({ value: p.key, label: p.name ? `${p.name} (${p.key})` : p.key }));
  const issueTypeOptions = issueTypesQuery.data
    ?.filter((t): t is string => Boolean(t))
    .map((t) => ({ value: t, label: t }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <FaJira className="size-4.5 text-primary" />
            </div>
            <div>
            <CardTitle>Jira</CardTitle>
            <CardDescription>Create issues from findings.</CardDescription>
            </div>
          </div>
          <Switch
            checked={form.active ?? false}
            onCheckedChange={(v) => save.mutate({ ...form, active: v })}
            aria-label="Enable Jira"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Configure
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Jira Configuration</DialogTitle>
          </DialogHeader>
          <form
            id="jira-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
              setOpen(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="jira-weburl">Web URL</Label>
              <Input
                id="jira-weburl"
                value={form.webUrl ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, webUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jira-apiurl">API URL</Label>
              <Input
                id="jira-apiurl"
                value={form.apiUrl ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="jira-user">Username</Label>
                <Input
                  id="jira-user"
                  value={form.userName ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jira-pass">Password / Token</Label>
                <Input
                  id="jira-pass"
                  type="password"
                  placeholder="••••••••"
                  value={form.password ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jira-projectkey">Project Key</Label>
                <SelectOrInput
                  id="jira-projectkey"
                  value={form.projectKey ?? ""}
                  options={projectOptions}
                  placeholder="Select a project"
                  onChange={(v) => setForm((f) => ({ ...f, projectKey: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jira-issuetype">Issue Type</Label>
                <SelectOrInput
                  id="jira-issuetype"
                  value={form.issueType ?? ""}
                  options={issueTypeOptions}
                  placeholder="Select an issue type"
                  onChange={(v) => setForm((f) => ({ ...f, issueType: v }))}
                />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={test.isPending}
              onClick={() => test.mutate(form)}
            >
              {test.isPending ? "Testing…" : "Test"}
            </Button>
            <Button type="submit" form="jira-form" disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* --------------------------- Redmine --------------------------- */
function RedmineCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RedmineSetting>({});

  const { data } = useQuery({
    queryKey: ["integration-redmine"],
    queryFn: async () => (await getRedmineIntegrationSetting({ throwOnError: true })).data,
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data);
  }

  const save = useMutation({
    mutationFn: async (body: RedmineSetting) => {
      await updateRedmineIntegrationSetting({ body, throwOnError: true });
    },
    onSuccess: () => {
      toast.success("Redmine settings saved");
      queryClient.invalidateQueries({ queryKey: ["integration-redmine"] });
    },
    onError: () => toast.error("Failed to save Redmine settings"),
  });

  const test = useMutation({
    // the test endpoint checks the SAVED settings — persist the form first
    mutationFn: async (body: RedmineSetting) => {
      await updateRedmineIntegrationSetting({ body, throwOnError: true });
      queryClient.invalidateQueries({ queryKey: ["integration-redmine"] });
      return (await testRedmineIntegrationSetting({ throwOnError: true })).data;
    },
    onSuccess: (ok) =>
      ok ? toast.success("Redmine connection OK") : toast.error("Redmine test failed"),
    onError: () => toast.error("Redmine test failed"),
  });

  // Metadata-driven dropdowns; pass the current form so unsaved creds work.
  // Failure falls back to numeric inputs — never blocks the form.
  const hasCreds = Boolean(form.url && form.token);
  const metadataQuery = useQuery({
    queryKey: ["integration-redmine-metadata", form.url],
    enabled: open && hasCreds,
    retry: false,
    queryFn: async () => {
      const res = await getRedmineMetadataIntegration({ body: form, throwOnError: false });
      return res.data ?? null;
    },
  });
  const meta = metadataQuery.data;

  const numFields: {
    key: keyof RedmineSetting;
    label: string;
    options: { id: number; name: string | null }[] | undefined;
  }[] = [
    { key: "projectId", label: "Project ID", options: meta?.projects ?? undefined },
    { key: "statusId", label: "Status ID", options: meta?.statuses ?? undefined },
    { key: "trackerId", label: "Tracker ID", options: meta?.trackers ?? undefined },
    { key: "priorityId", label: "Priority ID", options: meta?.priorities ?? undefined },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <SiRedmine className="size-4.5 text-primary" />
            </div>
            <div>
            <CardTitle>Redmine</CardTitle>
            <CardDescription>Create issues from findings.</CardDescription>
            </div>
          </div>
          <Switch
            checked={form.active ?? false}
            onCheckedChange={(v) => save.mutate({ ...form, active: v })}
            aria-label="Enable Redmine"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Configure
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redmine Configuration</DialogTitle>
          </DialogHeader>
          <form
            id="redmine-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
              setOpen(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="redmine-url">URL</Label>
              <Input
                id="redmine-url"
                value={form.url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="redmine-token">API Token</Label>
              <Input
                id="redmine-token"
                type="password"
                placeholder="••••••••"
                value={form.token ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {numFields.map((nf) => (
                <div key={nf.key} className="space-y-2">
                  <Label htmlFor={`redmine-${nf.key}`}>{nf.label}</Label>
                  <SelectOrNumberInput
                    id={`redmine-${nf.key}`}
                    value={form[nf.key] as number | undefined}
                    options={nf.options}
                    onChange={(v) => setForm((f) => ({ ...f, [nf.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={test.isPending}
              onClick={() => test.mutate(form)}
            >
              {test.isPending ? "Testing…" : "Test"}
            </Button>
            <Button type="submit" form="redmine-form" disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------------------- Teams ---------------------------- */
function TeamsCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TeamsAlertSetting>({
    active: false,
    securityAlertEvent: false,
    newFindingEvent: false,
    fixedFindingEvent: false,
    needTriageFindingEvent: false,
    scanCompletedEvent: false,
    scanFailedEvent: false,
    projectWithoutMemberEvent: false,
  });

  const { data } = useQuery({
    queryKey: ["integration-teams"],
    queryFn: async () => (await getTeamsIntegrationSetting({ throwOnError: true })).data,
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data);
  }

  const save = useMutation({
    mutationFn: async (body: TeamsAlertSetting) => {
      await updateTeamsIntegrationSetting({ body, throwOnError: true });
    },
    onSuccess: () => {
      toast.success("Teams settings saved");
      queryClient.invalidateQueries({ queryKey: ["integration-teams"] });
    },
    onError: () => toast.error("Failed to save Teams settings"),
  });

  const test = useMutation({
    // the test endpoint checks the SAVED settings — persist the form first
    mutationFn: async (body: TeamsAlertSetting) => {
      await updateTeamsIntegrationSetting({ body, throwOnError: true });
      queryClient.invalidateQueries({ queryKey: ["integration-teams"] });
      return (await testTeamsIntegrationSetting({ throwOnError: true })).data;
    },
    onSuccess: (ok) =>
      ok ? toast.success("Teams webhook OK") : toast.error("Teams test failed"),
    onError: () => toast.error("Teams test failed"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <FaMicrosoft className="size-4.5 text-primary" />
            </div>
            <div>
            <CardTitle>Microsoft Teams</CardTitle>
            <CardDescription>Send alerts to a Teams channel.</CardDescription>
            </div>
          </div>
          <Switch
            checked={form.active}
            onCheckedChange={(v) => save.mutate({ ...form, active: v })}
            aria-label="Enable Teams"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Configure
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teams Configuration</DialogTitle>
          </DialogHeader>
          <form
            id="teams-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
              setOpen(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="teams-webhook">Webhook URL</Label>
              <Input
                id="teams-webhook"
                value={form.webhook ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, webhook: e.target.value }))}
              />
            </div>
            <Separator />
            <p className="text-sm font-medium">Events</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {ALERT_EVENTS.map((ev) => (
                <label key={ev.key} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={Boolean(form[ev.key])}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, [ev.key]: v }))}
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={test.isPending}
              onClick={() => test.mutate(form)}
            >
              {test.isPending ? "Testing…" : "Test"}
            </Button>
            <Button type="submit" form="teams-form" disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ----------------------------- Mail ----------------------------- */
function MailCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MailAlertSetting>({
    active: false,
    securityAlertEvent: false,
    newFindingEvent: false,
    fixedFindingEvent: false,
    needTriageFindingEvent: false,
    scanCompletedEvent: false,
    scanFailedEvent: false,
    projectWithoutMemberEvent: false,
  });

  const { data } = useQuery({
    queryKey: ["integration-mail"],
    queryFn: async () => (await getMailIntegrationSetting({ throwOnError: true })).data,
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data);
  }

  const save = useMutation({
    mutationFn: async (body: MailAlertSetting) => {
      await updateMailIntegrationSetting({ body, throwOnError: true });
    },
    onSuccess: () => {
      toast.success("Mail settings saved");
      queryClient.invalidateQueries({ queryKey: ["integration-mail"] });
    },
    onError: () => toast.error("Failed to save Mail settings"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <FaEnvelope className="size-4.5 text-high" />
            </div>
            <div>
            <CardTitle>Mail</CardTitle>
            <CardDescription>Email alert notifications.</CardDescription>
            </div>
          </div>
          <Switch
            checked={form.active}
            onCheckedChange={(v) => save.mutate({ ...form, active: v })}
            aria-label="Enable Mail"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Configure
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mail Configuration</DialogTitle>
          </DialogHeader>
          <form
            id="mail-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
              setOpen(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="mail-receivers">Receivers (one per line)</Label>
              <Textarea
                id="mail-receivers"
                placeholder="security@example.com"
                value={(form.receivers ?? []).join("\n")}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    receivers: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>
            <Separator />
            <p className="text-sm font-medium">Events</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {ALERT_EVENTS.map((ev) => (
                <label key={ev.key} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={Boolean(form[ev.key])}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, [ev.key]: v }))}
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="mail-form" disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------------------- SCM types (inline, no openapi regen) -------- */

type ScmRepo = {
  provider: string;
  id: string;
  fullName: string;
  cloneUrl: string;
  htmlUrl?: string;
  defaultBranch?: string;
  private?: boolean;
  alreadyImported?: boolean;
};

type GitLabSetting = {
  active?: boolean;
  apiUrl?: string | null;
  token?: string | null;
  /** Server-side only flag — true when a PAT is stored (value never returned). */
  tokenConfigured?: boolean;
};

const DEFAULT_SCANNERS = ["gitleaks", "cve-lite", "trufflehog"] as const;

async function scmFetchRepos(provider: "github" | "gitlab"): Promise<ScmRepo[]> {
  const res = await fetch(`/api/integration/scm/${provider}/repos`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || `List failed (${res.status})`);
  }
  return res.json();
}

async function scmImportRepos(body: {
  provider: string;
  importAll?: boolean;
  repoIds?: string[];
  scanners?: string[];
}) {
  const res = await fetch("/api/integration/scm/import", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || `Import failed (${res.status})`);
  }
  return res.json() as Promise<{
    imported: number;
    updated: number;
    scansQueued: number;
  }>;
}

function StatusPill({
  ok,
  label,
  tone = "default",
}: {
  ok: boolean;
  label: string;
  tone?: "default" | "warn" | "danger";
}) {
  const styles =
    tone === "danger"
      ? "border-critical/40 bg-critical/10 text-critical"
      : tone === "warn"
        ? "border-medium/40 bg-medium/10 text-medium"
        : ok
          ? "border-primary/35 bg-primary/10 text-primary"
          : "border-border/70 bg-muted/30 text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        styles,
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0",
          tone === "danger"
            ? "bg-critical"
            : tone === "warn"
              ? "bg-medium"
              : ok
                ? "bg-primary"
                : "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}

const FLEET_SCANNERS = ["gitleaks", "cve-lite", "trufflehog", "trivy", "semgrep"] as const;

/** Shared multi-select repo picker + bulk import for GitHub / GitLab. */
function ScmDiscoverPanel({
  provider,
  enabled,
  onConfigure,
}: {
  provider: "github" | "gitlab";
  enabled: boolean;
  onConfigure?: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanners, setScanners] = useState<string[]>([...DEFAULT_SCANNERS]);
  const [filter, setFilter] = useState("");
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [lastImport, setLastImport] = useState<{
    imported: number;
    updated: number;
    scansQueued: number;
  } | null>(null);

  const reposQuery = useQuery({
    queryKey: ["scm-repos", provider],
    enabled,
    retry: false,
    queryFn: () => scmFetchRepos(provider),
  });

  const importMut = useMutation({
    mutationFn: async (mode: "selected" | "all") => {
      return scmImportRepos({
        provider,
        importAll: mode === "all",
        repoIds: mode === "selected" ? [...selected] : undefined,
        scanners,
      });
    },
    onSuccess: (r) => {
      setLastImport(r);
      setConfirmAllOpen(false);
      toast.success(
        `Imported ${r.imported} new · updated ${r.updated} · queued ${r.scansQueued} scan(s)`,
      );
      reposQuery.refetch();
      setSelected(new Set());
    },
    onError: (e: Error) => toast.error(e.message || "Import failed"),
  });

  const repos = useMemo(() => {
    const all = reposQuery.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.cloneUrl.toLowerCase().includes(q),
    );
  }, [reposQuery.data, filter]);

  const allIds = repos.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const importedCount = (reposQuery.data ?? []).filter((r) => r.alreadyImported).length;
  const newCount = (reposQuery.data?.length ?? 0) - importedCount;

  if (!enabled) {
    return (
      <div className="border border-dashed border-border/70 bg-muted/15 px-3 py-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center border border-border/60 bg-background/60">
            <FolderGit2 className="size-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">Connect first</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Paste a personal access token, save, then turn the integration{" "}
              <span className="text-foreground">on</span> to list repos and queue fleet scans.
            </p>
            {onConfigure && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-8 font-mono text-[11px]"
                onClick={onConfigure}
              >
                Configure token
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-border/60 bg-background/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-tight">Discover &amp; scan</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Import repos as projects and queue fleet scanners as Kubernetes Jobs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {reposQuery.data && !reposQuery.isError && (
            <StatusPill
              ok
              label={`${reposQuery.data.length} repos · ${importedCount} in Warden`}
            />
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 font-mono text-[11px]"
            disabled={reposQuery.isFetching}
            onClick={() => {
              setLastImport(null);
              reposQuery.refetch();
            }}
          >
            {reposQuery.isFetching ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Loading
              </>
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </div>

      {lastImport && (
        <div className="flex flex-col gap-2 border border-primary/30 bg-primary/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">
                Import complete · {lastImport.scansQueued} scan(s) queued
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {lastImport.imported} new project(s), {lastImport.updated} updated. Follow progress
                under Scan Runs.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button asChild variant="outline" size="sm" className="h-7 font-mono text-[10px]">
              <Link href="/project">
                <FolderGit2 className="mr-1 size-3" />
                Projects
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-7 font-mono text-[10px]">
              <Link href="/scanner/runs">
                <ScanSearch className="mr-1 size-3" />
                Scan runs
              </Link>
            </Button>
          </div>
        </div>
      )}

      {reposQuery.isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading repositories">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      )}

      {reposQuery.isError && (
        <div className="flex items-start gap-2 border border-critical/40 bg-critical/10 px-3 py-2.5 text-xs text-critical">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">Could not list repositories</p>
            <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
              {(reposQuery.error as Error)?.message ||
                "Check the token scopes (repo / read_api) and try Refresh."}
            </p>
            {onConfigure && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 border-critical/30 font-mono text-[10px] text-critical hover:bg-critical/10"
                onClick={onConfigure}
              >
                Update token
              </Button>
            )}
          </div>
        </div>
      )}

      {!reposQuery.isLoading && !reposQuery.isError && (reposQuery.data?.length ?? 0) === 0 && (
        <div className="border border-border/60 px-3 py-6 text-center">
          <FolderGit2 className="mx-auto size-5 text-muted-foreground/60" />
          <p className="mt-2 text-xs font-medium text-foreground">No repositories found</p>
          <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
            This token returned zero repos. Confirm org SSO authorization and scopes, then Refresh.
          </p>
        </div>
      )}

      {(reposQuery.data?.length ?? 0) > 0 && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name…"
              className="h-8 font-mono text-xs sm:max-w-xs"
              aria-label="Filter repositories"
            />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => {
                  setSelected(v ? new Set(allIds) : new Set());
                }}
              />
              Select all visible ({repos.length})
            </label>
            <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
              {newCount > 0 && (
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                  {newCount} new
                </Badge>
              )}
              <span className="font-mono text-[10px] text-muted-foreground">
                {selected.size} selected
              </span>
            </div>
          </div>

          <ScrollArea className="h-52 border border-border/50 bg-card/40">
            <div className="space-y-0.5 p-1.5" role="listbox" aria-label="Repositories">
              {repos.map((r) => {
                const isSelected = selected.has(r.id);
                return (
                  <div
                    key={r.id}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 transition-colors",
                      isSelected ? "bg-primary/8" : "hover:bg-primary/5",
                      r.alreadyImported && "opacity-80",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(v) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(r.id);
                          else next.delete(r.id);
                          return next;
                        });
                      }}
                      aria-label={`Select ${r.fullName}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-mono text-xs font-medium text-foreground">
                          {r.fullName}
                        </span>
                        {r.private ? (
                          <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Private" />
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                        <span>{r.private ? "private" : "public"}</span>
                        {r.defaultBranch ? <span>· {r.defaultBranch}</span> : null}
                        {r.alreadyImported ? (
                          <span className="text-primary">· already imported</span>
                        ) : (
                          <span className="text-foreground/70">· new</span>
                        )}
                      </div>
                    </div>
                    {r.htmlUrl ? (
                      <a
                        href={r.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={`Open ${r.fullName} in new tab`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
                  </div>
                );
              })}
              {repos.length === 0 && filter && (
                <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                  No matches for “{filter}”.
                </p>
              )}
            </div>
          </ScrollArea>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] text-muted-foreground">Scanners to queue</Label>
              {scanners.length === 0 && (
                <span className="font-mono text-[10px] text-critical">Select at least one</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Scanners">
              {FLEET_SCANNERS.map((s) => {
                const on = scanners.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setScanners((prev) =>
                        on ? prev.filter((x) => x !== s) : [...new Set([...prev, s])],
                      )
                    }
                    className={cn(
                      "border px-2 py-1 font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              size="sm"
              className="font-mono text-xs"
              disabled={selected.size === 0 || importMut.isPending || scanners.length === 0}
              onClick={() => importMut.mutate("selected")}
            >
              {importMut.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Importing…
                </>
              ) : (
                `Import selected (${selected.size})`
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="font-mono text-xs"
              disabled={
                (reposQuery.data?.length ?? 0) === 0 ||
                importMut.isPending ||
                scanners.length === 0
              }
              onClick={() => setConfirmAllOpen(true)}
            >
              Import &amp; scan all ({reposQuery.data?.length ?? 0})
            </Button>
            <p className="text-[10px] leading-relaxed text-muted-foreground sm:ml-auto sm:max-w-[14rem] sm:text-right">
              Private clones use the stored PAT. Jobs land in Scan Fleet.
            </p>
          </div>
        </>
      )}

      <Dialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import every repository?</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              This imports{" "}
              <span className="font-mono text-foreground">{reposQuery.data?.length ?? 0}</span>{" "}
              {provider === "github" ? "GitHub" : "GitLab"} repo(s) as Warden projects and queues{" "}
              <span className="font-mono text-foreground">{scanners.join(", ") || "no scanners"}</span>{" "}
              for each. Already-imported projects are updated, not duplicated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmAllOpen(false)}
              disabled={importMut.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="font-mono text-xs"
              disabled={importMut.isPending || scanners.length === 0}
              onClick={() => importMut.mutate("all")}
            >
              {importMut.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Importing…
                </>
              ) : (
                "Confirm import all"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------- GitHub ---------------------------- */

function GitHubCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<GitHubSetting>({});

  const { data } = useQuery({
    queryKey: ["integration-github"],
    queryFn: async () => (await getGitHubIntegrationSetting({ throwOnError: true })).data,
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data);
  }

  const save = useMutation({
    mutationFn: async (body: GitHubSetting) => {
      await updateGitHubIntegrationSetting({ body, throwOnError: true });
    },
    onSuccess: () => {
      toast.success("GitHub settings saved");
      queryClient.invalidateQueries({ queryKey: ["integration-github"] });
      queryClient.invalidateQueries({ queryKey: ["scm-repos", "github"] });
    },
    onError: () => toast.error("Failed to save GitHub settings"),
  });

  const test = useMutation({
    mutationFn: async (body: GitHubSetting) => {
      await updateGitHubIntegrationSetting({ body, throwOnError: true });
      queryClient.invalidateQueries({ queryKey: ["integration-github"] });
      return (await testGitHubIntegrationSetting({ throwOnError: true })).data;
    },
    onSuccess: (ok) =>
      ok ? toast.success("GitHub connection OK") : toast.error("GitHub test failed"),
    onError: () => toast.error("GitHub test failed"),
  });

  // Ticket-tracker repo picker (optional default owner/repo for issue creation).
  const hasToken = Boolean(form.token) || Boolean(data && form.active);
  const metadataQuery = useQuery({
    queryKey: ["integration-github-metadata", form.apiUrl, open],
    enabled: open && (Boolean(form.token) || Boolean(form.active)),
    retry: false,
    queryFn: async () => {
      const res = await getGitHubMetadataIntegration({ body: form, throwOnError: false });
      return res.data ?? null;
    },
  });
  const repos = metadataQuery.data?.repositories ?? undefined;
  const repoOptions = repos
    ?.filter((r): r is { owner: string | null; name: string | null; fullName: string } =>
      Boolean(r.fullName),
    )
    .map((r) => ({ value: r.fullName, label: r.fullName }));
  const selectedFullName = form.owner && form.repo ? `${form.owner}/${form.repo}` : "";

  const connected = Boolean(form.active);

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center border border-border/70 bg-muted/40">
              <FaGithub className="size-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">GitHub</CardTitle>
                <StatusPill ok={connected} label={connected ? "enabled" : "off"} />
              </div>
              <CardDescription className="mt-1 text-xs leading-relaxed">
                PAT-based discovery of every accessible repo. Import as projects and queue fleet
                scanners. Optional default repo for issue tickets.
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={form.active ?? false}
            onCheckedChange={(v) => {
              if (v) {
                // Turning on without a prior save still works if token already stored server-side.
                save.mutate({ ...form, active: true });
              } else {
                save.mutate({ ...form, active: false });
              }
            }}
            aria-label="Enable GitHub"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(true)}>
            Configure token
          </Button>
          {connected && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              disabled={test.isPending}
              onClick={() => test.mutate(form)}
            >
              {test.isPending ? "Testing…" : "Test connection"}
            </Button>
          )}
        </div>
        <ScmDiscoverPanel
          provider="github"
          enabled={connected}
          onConfigure={() => setOpen(true)}
        />
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>GitHub configuration</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Classic PAT needs <code className="font-mono text-foreground">repo</code> (private)
              or <code className="font-mono text-foreground">public_repo</code>. Fine-grained:
              Contents Read on target orgs. Token is stored server-side and never shown again after
              save — leave blank to keep the existing token.
            </DialogDescription>
          </DialogHeader>
          <form
            id="github-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(
                { ...form, active: form.active ?? true },
                {
                  onSuccess: () => setOpen(false),
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="github-apiurl">API URL</Label>
              <Input
                id="github-apiurl"
                placeholder="https://api.github.com"
                value={form.apiUrl ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-token">Personal access token</Label>
              <Input
                id="github-token"
                type="password"
                placeholder="ghp_… or github_pat_… (leave blank to keep)"
                value={form.token ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <Separator />
            <p className="text-xs font-medium">Default issue tracker repo (optional)</p>
            {repoOptions && repoOptions.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="github-repo-picker">Repository</Label>
                <Select
                  value={selectedFullName || undefined}
                  onValueChange={(v) => {
                    const [owner, ...rest] = v.split("/");
                    setForm((f) => ({ ...f, owner, repo: rest.join("/") }));
                  }}
                >
                  <SelectTrigger id="github-repo-picker" className="w-full">
                    <SelectValue placeholder="Select a repository" />
                  </SelectTrigger>
                  <SelectContent>
                    {repoOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="github-owner">Owner</Label>
                  <Input
                    id="github-owner"
                    value={form.owner ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="github-repo">Repository</Label>
                  <Input
                    id="github-repo"
                    value={form.repo ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, repo: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={test.isPending}
              onClick={() => test.mutate(form)}
            >
              {test.isPending ? "Testing…" : "Test"}
            </Button>
            <Button type="submit" form="github-form" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save & enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------------------- GitLab ---------------------------- */

function GitLabCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<GitLabSetting>({
    apiUrl: "https://gitlab.com/api/v4",
  });

  const { data } = useQuery({
    queryKey: ["integration-gitlab"],
    queryFn: async () => {
      const res = await fetch("/api/integration/gitlab", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to load GitLab settings");
      return (await res.json()) as GitLabSetting;
    },
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    // Never keep a leftover typed token from a previous edit session.
    setForm({ ...data, token: "" });
  }

  const save = useMutation({
    mutationFn: async (body: GitLabSetting) => {
      const payload = {
        active: body.active ?? false,
        apiUrl: (body.apiUrl ?? "").trim(),
        // Trim PAT — trailing spaces caused 401s against self-hosted GitLab.
        token: (body.token ?? "").trim(),
      };
      const res = await fetch("/api/integration/gitlab", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || `Save failed (${res.status})`);
      }
    },
    onSuccess: () => {
      toast.success("GitLab settings saved");
      queryClient.invalidateQueries({ queryKey: ["integration-gitlab"] });
      queryClient.invalidateQueries({ queryKey: ["scm-repos", "gitlab"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to save GitLab settings"),
  });

  const test = useMutation({
    mutationFn: async (body: GitLabSetting) => {
      await save.mutateAsync({ ...body, active: true });
      const res = await fetch("/api/integration/gitlab/test", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Test failed");
      }
      return true;
    },
    onSuccess: () => {
      toast.success("GitLab connection OK");
      queryClient.invalidateQueries({ queryKey: ["integration-gitlab"] });
      queryClient.invalidateQueries({ queryKey: ["scm-repos", "gitlab"] });
    },
    onError: (e: Error) => toast.error(e.message || "GitLab test failed"),
  });

  const connected = Boolean(form.active);
  const tokenReady = Boolean(form.tokenConfigured || form.token);
  const apiHost = useMemo(() => {
    try {
      if (!form.apiUrl) return null;
      return new URL(form.apiUrl).host;
    } catch {
      return form.apiUrl ?? null;
    }
  }, [form.apiUrl]);

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center border border-border/70 bg-muted/40">
              <FaGitlab className="size-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">GitLab</CardTitle>
                <StatusPill ok={connected} label={connected ? "enabled" : "off"} />
                {tokenReady && (
                  <StatusPill ok label="token saved" />
                )}
              </div>
              <CardDescription className="mt-1 text-xs leading-relaxed">
                List group and user projects, import as Warden projects, and queue the scan fleet
                (SaaS or self-managed).
              </CardDescription>
              {apiHost && (
                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                  {apiHost}
                </p>
              )}
            </div>
          </div>
          <Switch
            checked={form.active ?? false}
            onCheckedChange={(v) => {
              if (v && !tokenReady) {
                toast.error("Configure a GitLab PAT first, then enable.");
                setOpen(true);
                return;
              }
              save.mutate({ ...form, active: v, token: "" });
            }}
            aria-label="Enable GitLab"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(true)}>
            Configure token
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            disabled={test.isPending || !tokenReady}
            onClick={() => test.mutate({ ...form, token: form.token ?? "" })}
          >
            {test.isPending ? "Testing…" : "Test connection"}
          </Button>
        </div>
        {!connected && tokenReady && (
          <div className="border border-medium/40 bg-medium/10 px-3 py-2 text-[11px] leading-relaxed text-foreground">
            Token is saved but the integration switch is <strong>off</strong>. Turn it on (or click{" "}
            <span className="font-medium">Save &amp; enable</span>) to list repositories.
          </div>
        )}
        <ScmDiscoverPanel
          provider="gitlab"
          enabled={connected}
          onConfigure={() => setOpen(true)}
        />
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>GitLab configuration</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Scopes: <code className="font-mono text-foreground">read_api</code> +{" "}
              <code className="font-mono text-foreground">read_repository</code> for discovery;
              add <code className="font-mono text-foreground">api</code> to create issues from
              findings (CodeRabbit-style PAT — no OAuth App). Self-managed:{" "}
              <code className="font-mono text-foreground">
                https://gitlab.example.com/api/v4
              </code>
              . Leave token blank to keep the existing one.
            </DialogDescription>
          </DialogHeader>
          <form
            id="gitlab-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              // Always enable on explicit Save & enable (was stuck off when form.active was false).
              save.mutate(
                { ...form, active: true },
                {
                  onSuccess: () => setOpen(false),
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="gitlab-apiurl">API URL</Label>
              <Input
                id="gitlab-apiurl"
                placeholder="https://gitlab.com/api/v4 or https://gitlab.example.com/api/v4"
                value={form.apiUrl ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))}
                autoComplete="off"
              />
              <p className="text-[10px] text-muted-foreground">
                Your instance is currently set to self-hosted when the host is not gitlab.com.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gitlab-token">Personal access token</Label>
              <Input
                id="gitlab-token"
                type="password"
                placeholder={
                  form.tokenConfigured
                    ? "•••••••• (leave blank to keep existing)"
                    : "glpat-…"
                }
                value={form.token ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
                autoComplete="off"
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={test.isPending}
              onClick={() => test.mutate(form)}
            >
              {test.isPending ? "Testing…" : "Test"}
            </Button>
            <Button type="submit" form="gitlab-form" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save & enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------------- Jira Webhook (status sync) ---------------------- */

function JiraWebhookCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<JiraWebhookSetting>({});

  const { data } = useQuery({
    queryKey: ["integration-jira-webhook"],
    queryFn: async () => (await getJiraWebhookIntegrationSetting({ throwOnError: true })).data,
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data);
  }

  const save = useMutation({
    mutationFn: async (body: JiraWebhookSetting) => {
      await updateJiraWebhookIntegrationSetting({ body, throwOnError: true });
    },
    onSuccess: () => {
      toast.success("Jira webhook saved");
      queryClient.invalidateQueries({ queryKey: ["integration-jira-webhook"] });
    },
    onError: () => toast.error("Failed to save Jira webhook"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <FaJira className="size-4.5 text-primary" />
            </div>
            <div>
            <CardTitle>Jira Webhook</CardTitle>
            <CardDescription>Sync finding status from Jira transitions.</CardDescription>
            </div>
          </div>
          <Switch
            checked={form.active ?? false}
            onCheckedChange={(v) => save.mutate({ ...form, active: v })}
            aria-label="Enable Jira webhook"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Configure
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Jira Webhook Configuration</DialogTitle>
          </DialogHeader>
          <form
            id="jira-webhook-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
              setOpen(false);
            }}
          >
            <p className="text-sm text-muted-foreground">
              Point a Jira webhook at <code className="rounded bg-muted px-1">/api/integration/jira-webhook</code>{" "}
              and set the shared token below. Issue transitions then update the linked finding.
            </p>
            <div className="space-y-2">
              <Label htmlFor="jwh-token">Shared Token</Label>
              <Input
                id="jwh-token"
                type="password"
                placeholder="••••••••"
                value={form.token ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="jira-webhook-form" disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------------------- Webhook / Slack ---------------------------- */

function WebhookCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<WebhookSetting>({
    active: false,
    securityAlertEvent: false,
    newFindingEvent: false,
    fixedFindingEvent: false,
    needTriageFindingEvent: false,
    scanCompletedEvent: false,
    scanFailedEvent: false,
    projectWithoutMemberEvent: false,
  });

  const { data } = useQuery({
    queryKey: ["integration-webhook"],
    queryFn: async () => (await getWebhookIntegrationSetting({ throwOnError: true })).data,
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data);
  }

  const save = useMutation({
    mutationFn: async (body: WebhookSetting) => {
      await updateWebhookIntegrationSetting({ body, throwOnError: true });
    },
    onSuccess: () => {
      toast.success("Webhook settings saved");
      queryClient.invalidateQueries({ queryKey: ["integration-webhook"] });
    },
    onError: () => toast.error("Failed to save webhook settings"),
  });

  const test = useMutation({
    mutationFn: async (body: WebhookSetting) => {
      await updateWebhookIntegrationSetting({ body, throwOnError: true });
      queryClient.invalidateQueries({ queryKey: ["integration-webhook"] });
      return (await testWebhookIntegrationSetting({ throwOnError: true })).data;
    },
    onSuccess: (ok) =>
      ok ? toast.success("Webhook delivered") : toast.error("Webhook test failed"),
    onError: () => toast.error("Webhook test failed"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <WebhookIcon className="size-4.5 text-low" />
            </div>
            <div>
            <CardTitle>Webhook</CardTitle>
            <CardDescription>Send alerts to Slack or a generic webhook.</CardDescription>
            </div>
          </div>
          <Switch
            checked={form.active ?? false}
            onCheckedChange={(v) => save.mutate({ ...form, active: v })}
            aria-label="Enable Webhook"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Configure
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Configuration</DialogTitle>
          </DialogHeader>
          <form
            id="webhook-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
              setOpen(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL</Label>
              <Input
                id="webhook-url"
                type="password"
                placeholder="https://hooks.slack.com/services/…"
                value={form.url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Select
                value={form.format ?? "Generic"}
                onValueChange={(v) => setForm((f) => ({ ...f, format: v as WebhookFormat }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Generic">Generic JSON</SelectItem>
                  <SelectItem value="Slack">Slack</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <p className="text-sm font-medium">Events</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {ALERT_EVENTS.map((ev) => (
                <label key={ev.key} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={Boolean(form[ev.key as keyof WebhookSetting])}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, [ev.key]: v }))}
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={test.isPending}
              onClick={() => test.mutate(form)}
            >
              {test.isPending ? "Testing…" : "Test"}
            </Button>
            <Button type="submit" form="webhook-form" disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const SCM_STEPS = [
  { n: "01", label: "Configure PAT" },
  { n: "02", label: "Enable switch" },
  { n: "03", label: "Refresh repos" },
  { n: "04", label: "Import & scan" },
] as const;

export default function IntegrationPage() {
  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3 sm:gap-4">
      <div className="shrink-0 px-0.5">
        <h1 className="text-lg font-bold tracking-tight sm:text-xl">Integrations</h1>
        <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground sm:text-sm">
          Source control for repo discovery and fleet scans, plus tickets and alerts for findings.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-auto pb-4">
        <section className="space-y-3" aria-labelledby="scm-section-title">
          <div className="border-b border-border/50 pb-3">
            <h2
              id="scm-section-title"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Source control &amp; scanning
            </h2>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              Private clones use the stored token. Scans run as Kubernetes Jobs in the cluster.
            </p>
            <ol className="mt-3 flex flex-wrap gap-2" aria-label="Setup steps">
              {SCM_STEPS.map((step, i) => (
                <li
                  key={step.n}
                  className="inline-flex items-center gap-2 border border-border/60 bg-muted/20 px-2.5 py-1.5"
                >
                  <span className="font-mono text-[10px] text-primary">{step.n}</span>
                  <span className="text-[11px] text-foreground/90">{step.label}</span>
                  {i < SCM_STEPS.length - 1 ? (
                    <span className="sr-only">then</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
            <GitHubCard />
            <GitLabCard />
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="tickets-section-title">
          <div className="border-b border-border/50 pb-2">
            <h2
              id="tickets-section-title"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Tickets &amp; alerts
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              Issue trackers and notification channels for the findings lifecycle.
            </p>
          </div>
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
            <JiraCard />
            <JiraWebhookCard />
            <RedmineCard />
            <TeamsCard />
            <MailCard />
            <WebhookCard />
          </div>
        </section>
      </div>
    </div>
  );
}
