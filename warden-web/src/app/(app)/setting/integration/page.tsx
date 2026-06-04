"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
} from "@/client/sdk.gen";
import type {
  JiraSetting,
  RedmineSetting,
  TeamsAlertSetting,
  MailAlertSetting,
} from "@/client/types.gen";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Jira</CardTitle>
            <CardDescription>Create issues from findings.</CardDescription>
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
                <Input
                  id="jira-projectkey"
                  value={form.projectKey ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, projectKey: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jira-issuetype">Issue Type</Label>
                <Input
                  id="jira-issuetype"
                  value={form.issueType ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, issueType: e.target.value }))}
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
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

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

  const numFields: { key: keyof RedmineSetting; label: string }[] = [
    { key: "projectId", label: "Project ID" },
    { key: "statusId", label: "Status ID" },
    { key: "trackerId", label: "Tracker ID" },
    { key: "priorityId", label: "Priority ID" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Redmine</CardTitle>
            <CardDescription>Create issues from findings.</CardDescription>
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
                  <Input
                    id={`redmine-${nf.key}`}
                    type="number"
                    value={(form[nf.key] as number | undefined) ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, [nf.key]: num(e.target.value) }))}
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
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

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
          <div>
            <CardTitle>Microsoft Teams</CardTitle>
            <CardDescription>Send alerts to a Teams channel.</CardDescription>
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
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

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
          <div>
            <CardTitle>Mail</CardTitle>
            <CardDescription>Email alert notifications.</CardDescription>
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

export default function IntegrationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Integrations</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <JiraCard />
        <RedmineCard />
        <TeamsCard />
        <MailCard />
      </div>
    </div>
  );
}
