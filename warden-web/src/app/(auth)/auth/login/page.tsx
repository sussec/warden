"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getAuthConfig, login } from "@/client/sdk.gen";
import { session } from "@/lib/auth/session";
import { GuestGuard } from "@/lib/auth/guard";
import { WardenLogo } from "@/components/layout/logo";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { data: authConfig } = useQuery({
    queryKey: ["auth-config"],
    queryFn: async () => (await getAuthConfig({ throwOnError: true })).data,
  });

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
        router.replace(search.get("returnUrl") ?? "/dashboard");
      }
    },
    onError: () => toast.error("Sign in failed. Check your credentials."),
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <WardenLogo className="mb-2 size-14 text-primary" />
      <h1 className="text-2xl font-bold">Welcome to Techanv Warden!</h1>
      <p className="text-muted-foreground">Sign in to continue</p>
      <form
        className="mt-6 w-full max-w-md space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          signIn.mutate();
        }}
      >
        <p className="text-center text-sm text-muted-foreground">
          Enter your credential to access your account
        </p>
        {!authConfig?.disablePasswordLogon && (
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
        {authConfig?.openIdConnectEnable && (
          <Button asChild variant="secondary" className="w-full">
            {/* full page navigation — OIDC handshake is a server redirect chain */}
            <a href="/api/login/oidc">
              Sign in with {authConfig.openIdConnectProvider || "SSO"}
            </a>
          </Button>
        )}
      </form>
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
