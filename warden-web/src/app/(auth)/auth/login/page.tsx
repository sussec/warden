"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { getAuthConfig, login } from "@/client/sdk.gen";
import { GuestGuard } from "@/lib/auth/guard";
import { ssoStartUrl } from "@/lib/auth/sso";
import { WardenLogo } from "@/components/layout/logo";
import { LoginBackdrop } from "@/components/auth/login-backdrop";
import { GlassCard } from "@/components/auth/glass-card";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const returnUrl = search.get("returnUrl") ?? "/dashboard";
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { data: authConfig, isLoading: authConfigLoading } = useQuery({
    queryKey: ["auth-config"],
    queryFn: async () => (await getAuthConfig({ throwOnError: true })).data,
  });

  useEffect(() => {
    const err = search.get("error");
    if (err) toast.error(err);
  }, [search]);

  const signIn = useMutation({
    mutationFn: async () =>
      (await login({ body: { userName, password }, throwOnError: true })).data,
    onSuccess: (data) => {
      if (data?.requireTwoFactor) {
        router.push("/auth/two-step");
        return;
      }
      if (data?.requireConfirmEmail) {
        router.push("/auth/confirm-email");
        return;
      }
      if (data?.accessToken) {
        // session cookies were set by the API (httpOnly)
        router.replace(returnUrl.startsWith("/") ? returnUrl : "/dashboard");
      }
    },
    onError: () => toast.error("Sign in failed. Check your credentials."),
  });

  const ssoEnabled = Boolean(authConfig?.openIdConnectEnable);
  const passwordEnabled = !authConfig?.disablePasswordLogon;
  const ssoHref = ssoStartUrl(returnUrl);
  const providerLabel = authConfig?.openIdConnectProvider?.trim() || "SSO";

  return (
    /* Self-contained, viewport-level auth surface. The shared (auth) layout wraps
       every auth page in an opaque card; the login screen instead presents the
       ambient field + frosted card, so we render a fixed full-viewport layer that
       sits over that wrapper (it stays untouched in the DOM behind this) and host
       the backdrop + GlassCard here. All existing auth logic/fields are unchanged. */
    <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto p-4">
      <LoginBackdrop />

      <GlassCard className="relative z-10 w-full max-w-xl p-8 sm:p-10 warden-ops-panel">
        <div className="flex flex-col items-center gap-2">
          <WardenLogo className="mb-2 size-12 text-primary" />
          <p className="warden-mono-label">security as a blocking constraint</p>
          <h1 className="text-2xl font-normal tracking-tight">
            <span className="text-primary">$_</span>warden
          </h1>
          <p className="font-mono text-xs tracking-wide text-muted-foreground">
            sign in to the console
          </p>
          <form
            className="mt-6 w-full max-w-md space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              signIn.mutate();
            }}
          >
            <p className="text-center text-sm text-muted-foreground">
              {ssoEnabled && !passwordEnabled
                ? "Continue with your organization identity provider"
                : "Enter your credential to access your account"}
            </p>

            {/* General OIDC / SSO — full-page navigation (IdP redirect chain) */}
            {!authConfigLoading && ssoEnabled && (
              <div className="space-y-3">
                <Button asChild variant={passwordEnabled ? "secondary" : "default"} className="w-full">
                  <a href={ssoHref}>Sign in with {providerLabel}</a>
                </Button>
                {passwordEnabled && (
                  <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      or email
                    </span>
                    <Separator className="flex-1" />
                  </div>
                )}
              </div>
            )}

            {passwordEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Email</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    placeholder="Email address"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-3 text-sm text-muted-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox /> Remember me
                  </label>
                  <Link href="/auth/forgot-password" className="text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Button type="submit" className="w-full" disabled={signIn.isPending}>
                  {signIn.isPending ? "Signing in…" : "Sign In"}
                </Button>
              </>
            )}

            {!authConfigLoading && !passwordEnabled && !ssoEnabled && (
              <p className="text-center text-sm text-critical">
                No sign-in methods are enabled. Ask an administrator to configure password
                logon or OpenID Connect under Setting → Authentication.
              </p>
            )}
          </form>
        </div>
      </GlassCard>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <GuestGuard>
        <LoginForm />
      </GuestGuard>
    </Suspense>
  );
}
