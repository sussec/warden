"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FaEnvelope, FaGithub, FaJira, FaMicrosoft } from "react-icons/fa6";
import { SiRedmine } from "react-icons/si";
import { Webhook as WebhookIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
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
              <FaJira className="size-4.5 text-[#0052cc] dark:text-[#4c9aff]" />
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
              <SiRedmine className="size-4.5 text-[#b32024] dark:text-[#e0565a]" />
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
              <FaMicrosoft className="size-4.5 text-[#6264a7] dark:text-[#9ea2ff]" />
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

  // Repo picker fed by metadata; pass form so unsaved token works. Falls back
  // to free-text owner/repo inputs when the listing can't be fetched.
  const hasToken = Boolean(form.token);
  const metadataQuery = useQuery({
    queryKey: ["integration-github-metadata", form.apiUrl],
    enabled: open && hasToken,
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
  // Selecting a repo sets owner + repo together (fullName = "owner/name").
  const selectedFullName = form.owner && form.repo ? `${form.owner}/${form.repo}` : "";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <FaGithub className="size-4.5 text-foreground" />
            </div>
            <div>
            <CardTitle>GitHub Issues</CardTitle>
            <CardDescription>Create issues from findings.</CardDescription>
            </div>
          </div>
          <Switch
            checked={form.active ?? false}
            onCheckedChange={(v) => save.mutate({ ...form, active: v })}
            aria-label="Enable GitHub"
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
            <DialogTitle>GitHub Configuration</DialogTitle>
          </DialogHeader>
          <form
            id="github-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
              setOpen(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="github-apiurl">API URL</Label>
              <Input
                id="github-apiurl"
                placeholder="https://api.github.com"
                value={form.apiUrl ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-token">Token</Label>
              <Input
                id="github-token"
                type="password"
                placeholder="••••••••"
                value={form.token ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
              />
            </div>
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
              Save
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
              <FaJira className="size-4.5 text-[#0052cc] dark:text-[#4c9aff]" />
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

export default function IntegrationPage() {
  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-4">
      {/* header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Integrations</h1>
          <p className="text-xs text-muted-foreground">
            Connect issue trackers and alert channels
          </p>
        </div>
      </div>

      {/* scroll region — page stays fixed, settings scroll inside */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-md">
        <div className="grid gap-4 lg:grid-cols-2">
          <JiraCard />
          <JiraWebhookCard />
          <RedmineCard />
          <GitHubCard />
          <TeamsCard />
          <MailCard />
          <WebhookCard />
        </div>
      </div>
    </div>
  );
}
