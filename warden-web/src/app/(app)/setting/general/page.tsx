"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  getSmtpSetting,
  updateSmtpSetting,
  testSmtpSetting,
  getAuthSetting,
  updateAuthSetting,
  getSlaSetting,
  updateSlaSetting,
  getAiSetting,
  updateAiSetting,
  testAiSetting,
  backfill,
} from "@/client/sdk.gen";
import type {
  SmtpSetting,
  AuthSetting,
  SlaSetting,
  AiSetting,
  Sla,
} from "@/client/types.gen";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ----------------------------- SMTP ----------------------------- */
function SmtpCard() {
  const [form, setForm] = useState<SmtpSetting>({
    server: "",
    port: 587,
    userName: "",
  });
  const [testEmail, setTestEmail] = useState("");

  const { data } = useQuery({
    queryKey: ["setting-smtp"],
    queryFn: async () => (await getSmtpSetting({ throwOnError: true })).data,
  });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      await updateSmtpSetting({ body: form, throwOnError: true });
    },
    onSuccess: () => toast.success("SMTP settings saved"),
    onError: () => toast.error("Failed to save SMTP settings"),
  });

  const test = useMutation({
    mutationFn: async () =>
      (await testSmtpSetting({ query: { email: testEmail }, throwOnError: true })).data,
    onSuccess: (ok) =>
      ok ? toast.success("Test email sent") : toast.error("SMTP test failed"),
    onError: () => toast.error("SMTP test failed"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMTP</CardTitle>
        <CardDescription>Outbound email server configuration.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-server">Server</Label>
              <Input
                id="smtp-server"
                value={form.server}
                onChange={(e) => setForm((f) => ({ ...f, server: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: num(e.target.value) }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-name">Display Name</Label>
              <Input
                id="smtp-name"
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-user">Username</Label>
              <Input
                id="smtp-user"
                value={form.userName}
                onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-pass">Password</Label>
              <Input
                id="smtp-pass"
                type="password"
                placeholder="••••••••"
                value={form.password ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.useSsl ?? false}
                onCheckedChange={(v) => setForm((f) => ({ ...f, useSsl: v }))}
              />
              Use SSL
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.ignoreSsl ?? false}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ignoreSsl: v }))}
              />
              Ignore SSL errors
            </label>
          </div>
          <Separator />
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="smtp-test-email">Send test email to</Label>
              <Input
                id="smtp-test-email"
                type="email"
                className="w-64"
                placeholder="you@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={test.isPending || !testEmail}
              onClick={() => test.mutate()}
            >
              {test.isPending ? "Testing…" : "Send Test"}
            </Button>
            <Button type="submit" disabled={save.isPending} className="ml-auto">
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* -------------------------- Authentication -------------------------- */
function AuthCard() {
  const [form, setForm] = useState<AuthSetting>({
    openIdConnectSetting: {},
  });

  const { data } = useQuery({
    queryKey: ["setting-auth"],
    queryFn: async () => (await getAuthSetting({ throwOnError: true })).data,
  });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      await updateAuthSetting({ body: form, throwOnError: true });
    },
    onSuccess: () => toast.success("Authentication settings saved"),
    onError: () => toast.error("Failed to save authentication settings"),
  });

  const oidc = form.openIdConnectSetting;
  const setOidc = (patch: Partial<AuthSetting["openIdConnectSetting"]>) =>
    setForm((f) => ({ ...f, openIdConnectSetting: { ...f.openIdConnectSetting, ...patch } }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authentication</CardTitle>
        <CardDescription>Login methods and OpenID Connect (SSO).</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.disablePasswordLogon ?? false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, disablePasswordLogon: v }))}
            />
            Disable password logon
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.allowRegister ?? false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, allowRegister: v }))}
            />
            Allow self-registration
          </label>
          <div className="space-y-2">
            <Label htmlFor="auth-whitelist">Whitelisted email domains</Label>
            <Textarea
              id="auth-whitelist"
              placeholder="example.com&#10;company.org"
              value={form.whiteListEmails ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, whiteListEmails: e.target.value }))}
            />
          </div>

          <Separator />
          <h3 className="text-sm font-semibold">OpenID Connect</h3>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={oidc.enable ?? false}
              onCheckedChange={(v) => setOidc({ enable: v })}
            />
            Enable OIDC provider
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="oidc-name">Display name</Label>
              <Input
                id="oidc-name"
                value={oidc.displayName ?? ""}
                onChange={(e) => setOidc({ displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oidc-authority">Authority</Label>
              <Input
                id="oidc-authority"
                value={oidc.authority ?? ""}
                onChange={(e) => setOidc({ authority: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oidc-client">Client ID</Label>
              <Input
                id="oidc-client"
                value={oidc.clientId ?? ""}
                onChange={(e) => setOidc({ clientId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oidc-secret">Client Secret</Label>
              <Input
                id="oidc-secret"
                type="password"
                placeholder="••••••••"
                value={oidc.clientSecret ?? ""}
                onChange={(e) => setOidc({ clientSecret: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oidc-scheme">Scheme override</Label>
              <Input
                id="oidc-scheme"
                value={oidc.schemeOverride ?? ""}
                onChange={(e) => setOidc({ schemeOverride: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ------------------------------- SLA ------------------------------- */
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

function SlaCard() {
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
    <Card>
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
  );
}

/* -------------------------------- AI -------------------------------- */
function AiCard() {
  const [form, setForm] = useState<AiSetting>({});

  const { data } = useQuery({
    queryKey: ["setting-ai"],
    queryFn: async () => (await getAiSetting({ throwOnError: true })).data,
  });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      await updateAiSetting({ body: form, throwOnError: true });
    },
    onSuccess: () => toast.success("AI settings saved"),
    onError: () => toast.error("Failed to save AI settings"),
  });

  const test = useMutation({
    mutationFn: async () => (await testAiSetting({ body: form, throwOnError: true })).data,
    onSuccess: (ok) =>
      ok ? toast.success("AI connection OK") : toast.error("AI test failed"),
    onError: () => toast.error("AI test failed"),
  });

  const rebuild = useMutation({
    mutationFn: async () => (await backfill({ throwOnError: true })).data,
    onSuccess: (res) =>
      toast.success(`Search index rebuilt (${res?.processed ?? 0} findings)`),
    onError: () => toast.error("Failed to rebuild search index"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI</CardTitle>
        <CardDescription>LLM endpoint for triage and semantic search.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.enabled ?? false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
            Enable AI features
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-endpoint">Endpoint</Label>
              <Input
                id="ai-endpoint"
                placeholder="https://api.openai.com/v1"
                value={form.endpoint ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-key">API Key</Label>
              <Input
                id="ai-key"
                type="password"
                placeholder="••••••••"
                value={form.apiKey ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                placeholder="gpt-4o-mini"
                value={form.model ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-embed">Embedding Model</Label>
              <Input
                id="ai-embed"
                placeholder="text-embedding-3-small"
                value={form.embeddingModel ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, embeddingModel: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={test.isPending}
              onClick={() => test.mutate()}
            >
              {test.isPending ? "Testing…" : "Test Connection"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={rebuild.isPending || !form.enabled}
              onClick={() => {
                if (
                  window.confirm(
                    "Rebuild the AI semantic-search index over all existing findings? This may take a while.",
                  )
                ) {
                  rebuild.mutate();
                }
              }}
            >
              {rebuild.isPending ? "Rebuilding…" : "Rebuild search index"}
            </Button>
            <Button type="submit" disabled={save.isPending} className="ml-auto">
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function GeneralSettingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Global Settings</h1>
      <SmtpCard />
      <AuthCard />
      <SlaCard />
      <AiCard />
    </div>
  );
}
