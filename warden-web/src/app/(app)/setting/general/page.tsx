"use client";

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { getSmtpSetting, testSmtpSetting, updateSmtpSetting } from "@/client/sdk.gen";
import type { SmtpSetting } from "@/client/types.gen";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function GeneralSettingPage() {
  const [form, setForm] = useState<SmtpSetting>({ server: "", port: 587, userName: "" });
  const [testEmail, setTestEmail] = useState("");

  const { data } = useQuery({
    queryKey: ["setting-smtp"],
    queryFn: async () => (await getSmtpSetting({ throwOnError: true })).data,
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data);
  }

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
    onSuccess: (ok) => (ok ? toast.success("Test email sent") : toast.error("SMTP test failed")),
    onError: (err: unknown) => {
      // Surface the real SMTP/server error (e.g. "535 Authentication unsuccessful")
      // returned in the API response, not a generic message.
      const detail = (err as { errors?: string[] })?.errors?.[0];
      toast.error(detail ?? "SMTP test failed", { duration: 8000 });
    },
  });

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      {/* header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-medium tracking-tight">General</h1>
          <p className="text-xs text-muted-foreground">Workspace &amp; outbound email configuration</p>
        </div>
      </div>

      {/* scrollable settings region — page stays fixed */}
      <div className="min-h-0 flex-1 space-y-6 overflow-auto">
      <Card className="bg-card">
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
      </div>
    </div>
  );
}
