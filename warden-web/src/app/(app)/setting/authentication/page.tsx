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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { getAuthSetting, updateAuthSetting } from "@/client/sdk.gen";
import type { AuthSetting } from "@/client/types.gen";

export default function AuthenticationSettingPage() {
  const [form, setForm] = useState<AuthSetting>({ openIdConnectSetting: {} });

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
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      {/* header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Authentication</h1>
          <p className="text-xs text-muted-foreground">Login methods and OpenID Connect (SSO).</p>
        </div>
        <Button type="submit" form="auth-setting-form" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* scroll region — form scrolls, page stays fixed */}
      <div className="min-h-0 flex-1 overflow-auto">
        <Card className="bg-card/70 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Login methods and OpenID Connect (SSO).</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="auth-setting-form"
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
              <Switch checked={oidc.enable ?? false} onCheckedChange={(v) => setOidc({ enable: v })} />
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
          </form>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
