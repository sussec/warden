"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bug, ListTodo, MessagesSquare, Mail, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getIntegrationProject,
  getJiraIntegrationProject,
  updateJiraIntegrationProject,
  getRedmineIntegrationProject,
  updateRedmineIntegrationProject,
  getTeamsIntegrationProject,
  updateTeamsIntegrationProject,
  getMailIntegrationProject,
  updateMailIntegrationProject,
} from "@/client/sdk.gen";
import type {
  JiraProjectSetting,
  RedmineProjectSetting,
  TeamsProjectSetting,
  MailProjectAlertSetting,
} from "@/client/types.gen";

type IntegrationKey = "jira" | "redmine" | "teams" | "mail";

const ALERT_EVENTS: { key: keyof MailProjectAlertSetting; label: string }[] = [
  { key: "securityAlertEvent", label: "Security alert" },
  { key: "newFindingEvent", label: "New finding" },
  { key: "fixedFindingEvent", label: "Fixed finding" },
  { key: "needTriageFindingEvent", label: "Needs triage" },
  { key: "scanCompletedEvent", label: "Scan completed" },
  { key: "scanFailedEvent", label: "Scan failed" },
];

const DEFAULT_MAIL: MailProjectAlertSetting = {
  active: false,
  securityAlertEvent: false,
  newFindingEvent: false,
  fixedFindingEvent: false,
  needTriageFindingEvent: false,
  scanCompletedEvent: false,
  scanFailedEvent: false,
};

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export default function ProjectIntegrationPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [openKey, setOpenKey] = useState<IntegrationKey | null>(null);

  const { data: enabled } = useQuery({
    queryKey: ["project-integration", id],
    queryFn: async () =>
      (await getIntegrationProject({ path: { projectId: id }, throwOnError: true })).data,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["project-integration", id] });
  }

  const cards: { key: IntegrationKey; label: string; icon: typeof Bug; description: string }[] = [
    { key: "jira", label: "Jira", icon: Bug, description: "Create Jira issues from findings." },
    { key: "redmine", label: "Redmine", icon: ListTodo, description: "Create Redmine issues from findings." },
    { key: "teams", label: "Microsoft Teams", icon: MessagesSquare, description: "Send alerts to a Teams channel." },
    { key: "mail", label: "Mail", icon: Mail, description: "Send email alerts to members." },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Integrations</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          const isOn = enabled?.[c.key] ?? false;
          return (
            <Card key={c.key} className="flex flex-row items-start justify-between gap-4 p-4">
              <div className="flex gap-3">
                <Icon className="size-6 text-primary" />
                <div className="flex flex-col">
                  <span className="font-semibold">{c.label}</span>
                  <span className="text-sm text-muted-foreground">{c.description}</span>
                  <span className="mt-1 text-xs font-medium">
                    {isOn ? (
                      <span className="text-low">Enabled</span>
                    ) : (
                      <span className="text-muted-foreground">Disabled</span>
                    )}
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpenKey(c.key)}>
                <Settings2 className="size-4" /> Configure
              </Button>
            </Card>
          );
        })}
      </div>

      {openKey === "jira" && (
        <JiraDialog projectId={id} onClose={() => setOpenKey(null)} onSaved={invalidate} />
      )}
      {openKey === "redmine" && (
        <RedmineDialog projectId={id} onClose={() => setOpenKey(null)} onSaved={invalidate} />
      )}
      {openKey === "teams" && (
        <TeamsDialog projectId={id} onClose={() => setOpenKey(null)} onSaved={invalidate} />
      )}
      {openKey === "mail" && (
        <MailDialog projectId={id} onClose={() => setOpenKey(null)} onSaved={invalidate} />
      )}
    </div>
  );
}

function JiraDialog({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["project-integration-jira", projectId],
    queryFn: async () =>
      (await getJiraIntegrationProject({ path: { projectId }, throwOnError: true })).data,
  });
  const [form, setForm] = useState<JiraProjectSetting>({ active: false, projectKey: "", issueType: "" });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mut = useMutation({
    mutationFn: async () =>
      (await updateJiraIntegrationProject({ path: { projectId }, body: form, throwOnError: true })).data,
    onSuccess: () => {
      toast.success("Jira settings saved.");
      onSaved();
      onClose();
    },
    onError: () => toast.error("Could not save Jira settings."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Jira</DialogTitle>
          <DialogDescription>Configure Jira issue creation for this project.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="jira-active">Enabled</Label>
            <Switch
              id="jira-active"
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
          </div>
          <div className="space-y-2">
            <Label>Project key</Label>
            <Input value={form.projectKey} onChange={(e) => setForm({ ...form, projectKey: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Issue type</Label>
            <Input value={form.issueType} onChange={(e) => setForm({ ...form, issueType: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedmineDialog({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["project-integration-redmine", projectId],
    queryFn: async () =>
      (await getRedmineIntegrationProject({ path: { projectId }, throwOnError: true })).data,
  });
  const [form, setForm] = useState<RedmineProjectSetting>({ active: false });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mut = useMutation({
    mutationFn: async () =>
      (await updateRedmineIntegrationProject({ path: { projectId }, body: form, throwOnError: true })).data,
    onSuccess: () => {
      toast.success("Redmine settings saved.");
      onSaved();
      onClose();
    },
    onError: () => toast.error("Could not save Redmine settings."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redmine</DialogTitle>
          <DialogDescription>Configure Redmine issue creation for this project.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="redmine-active">Enabled</Label>
            <Switch
              id="redmine-active"
              checked={form.active ?? false}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Project ID" value={form.projectId} onChange={(v) => setForm({ ...form, projectId: v })} />
            <NumberField label="Status ID" value={form.statusId} onChange={(v) => setForm({ ...form, statusId: v })} />
            <NumberField label="Tracker ID" value={form.trackerId} onChange={(v) => setForm({ ...form, trackerId: v })} />
            <NumberField label="Priority ID" value={form.priorityId} onChange={(v) => setForm({ ...form, priorityId: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamsDialog({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["project-integration-teams", projectId],
    queryFn: async () =>
      (await getTeamsIntegrationProject({ path: { projectId }, throwOnError: true })).data,
  });
  const [form, setForm] = useState<TeamsProjectSetting>({
    ...DEFAULT_MAIL,
    webhook: "",
  } as TeamsProjectSetting);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mut = useMutation({
    mutationFn: async () =>
      (await updateTeamsIntegrationProject({ path: { projectId }, body: form, throwOnError: true })).data,
    onSuccess: () => {
      toast.success("Teams settings saved.");
      onSaved();
      onClose();
    },
    onError: () => toast.error("Could not save Teams settings."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Microsoft Teams</DialogTitle>
          <DialogDescription>Send alerts to a Teams channel.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="teams-active">Enabled</Label>
            <Switch
              id="teams-active"
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
          </div>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input value={form.webhook ?? ""} onChange={(e) => setForm({ ...form, webhook: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Alert events</Label>
            {ALERT_EVENTS.map((ev) => (
              <div key={ev.key} className="flex items-center justify-between">
                <span className="text-sm">{ev.label}</span>
                <Switch
                  checked={(form[ev.key as keyof TeamsProjectSetting] as boolean) ?? false}
                  onCheckedChange={(v) => setForm({ ...form, [ev.key]: v })}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MailDialog({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["project-integration-mail", projectId],
    queryFn: async () =>
      (await getMailIntegrationProject({ path: { projectId }, throwOnError: true })).data,
  });
  const [form, setForm] = useState<MailProjectAlertSetting>(DEFAULT_MAIL);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mut = useMutation({
    mutationFn: async () =>
      (await updateMailIntegrationProject({ path: { projectId }, body: form, throwOnError: true })).data,
    onSuccess: () => {
      toast.success("Mail settings saved.");
      onSaved();
      onClose();
    },
    onError: () => toast.error("Could not save mail settings."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mail</DialogTitle>
          <DialogDescription>Send email alerts to project members.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="mail-active">Enabled</Label>
            <Switch
              id="mail-active"
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Alert events</Label>
            {ALERT_EVENTS.map((ev) => (
              <div key={ev.key} className="flex items-center justify-between">
                <span className="text-sm">{ev.label}</span>
                <Switch
                  checked={(form[ev.key] as boolean) ?? false}
                  onCheckedChange={(v) => setForm({ ...form, [ev.key]: v })}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
