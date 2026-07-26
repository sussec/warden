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
  const [publicOrigin, setPublicOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setPublicOrigin(window.location.origin);
  }, []);

  const { data } = useQuery({
    queryKey: ["setting-auth"],
    queryFn: async () => (await getAuthSetting({ throwOnError: true })).data,
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data);
  }

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

  const redirectUri = publicOrigin
    ? `${publicOrigin}/auth/oidc/callback`
    : "https://<your-warden-host>/auth/oidc/callback";
  const ssoStart = publicOrigin
    ? `${publicOrigin}/auth/sso?returnUrl=/dashboard`
    : "/auth/sso?returnUrl=/dashboard";

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Authentication</h1>
          <p className="text-xs text-muted-foreground">
            Password logon and general OpenID Connect (SSO) for any OIDC provider.
          </p>
        </div>
        <Button type="submit" form="auth-setting-form" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>
              Login methods and OpenID Connect SSO. Works with Keycloak, Azure AD / Entra ID,
              Google Workspace, Okta, Auth0, Dex, Authentik, and any OIDC-compliant IdP.
            </CardDescription>
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
                Disable password logon (SSO only)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.allowRegister ?? false}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, allowRegister: v }))}
                />
                Allow self-registration via SSO (auto-create users on first login)
              </label>
              <div className="space-y-2">
                <Label htmlFor="auth-whitelist">Whitelisted email domains</Label>
                <Textarea
                  id="auth-whitelist"
                  placeholder={"example.com\ncompany.org"}
                  value={form.whiteListEmails ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, whiteListEmails: e.target.value }))}
                />
              </div>

              <Separator />
              <h3 className="text-sm font-semibold">OpenID Connect (general SSO)</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Warden uses the authorization-code flow. Register a confidential client at your IdP
                with redirect URI below, scopes <code className="font-mono text-[11px]">openid profile email</code>,
                and map the email claim (or UPN). The login page shows{" "}
                <span className="font-mono">Sign in with …</span> when enabled.
              </p>

              <label className="flex items-center gap-2 text-sm">
                <Switch checked={oidc.enable ?? false} onCheckedChange={(v) => setOidc({ enable: v })} />
                Enable OIDC provider
              </label>

              <div className="grid gap-3 rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Redirect URI (register at IdP)
                  </p>
                  <code className="mt-1 block break-all font-mono text-[11px] text-foreground">
                    {redirectUri}
                  </code>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    SSO start (Next.js)
                  </p>
                  <code className="mt-1 block break-all font-mono text-[11px] text-foreground">
                    {ssoStart}
                  </code>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="oidc-name">Display name</Label>
                  <Input
                    id="oidc-name"
                    placeholder="Okta · Azure AD · Keycloak"
                    value={oidc.displayName ?? ""}
                    onChange={(e) => setOidc({ displayName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oidc-authority">Authority (issuer)</Label>
                  <Input
                    id="oidc-authority"
                    placeholder="https://login.microsoftonline.com/{tenant}/v2.0"
                    value={oidc.authority ?? ""}
                    onChange={(e) => setOidc({ authority: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Base URL that serves <code className="font-mono">.well-known/openid-configuration</code>
                  </p>
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
                    placeholder="Leave blank to keep existing"
                    value={oidc.clientSecret ?? ""}
                    onChange={(e) => setOidc({ clientSecret: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="oidc-scheme">Scheme override</Label>
                  <Input
                    id="oidc-scheme"
                    placeholder="https"
                    value={oidc.schemeOverride ?? ""}
                    onChange={(e) => setOidc({ schemeOverride: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Set to <code className="font-mono">https</code> when TLS terminates at a reverse
                    proxy / Cloudflare tunnel so the redirect_uri uses HTTPS.
                  </p>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
