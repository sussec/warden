"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/client/sdk.gen";

function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const reset = useMutation({
    mutationFn: async () =>
      (
        await resetPassword({
          body: {
            token: search.get("token") ?? "",
            username: search.get("username") ?? "",
            password,
          },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("Password updated. Sign in with your new password.");
      router.replace("/auth/login");
    },
    onError: () => toast.error("Password reset failed. The link may have expired."),
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <h1 className="text-2xl font-medium">Reset password</h1>
      <form
        className="mt-6 w-full max-w-md space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (password !== confirm) {
            toast.error("Passwords do not match.");
            return;
          }
          reset.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={reset.isPending}>
          {reset.isPending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
