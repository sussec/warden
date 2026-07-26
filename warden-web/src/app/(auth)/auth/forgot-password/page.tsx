"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/client/sdk.gen";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [sent, setSent] = useState(false);

  const request = useMutation({
    mutationFn: async () =>
      (await forgotPassword({ body: { username }, throwOnError: true })).data,
    onSuccess: () => setSent(true),
    onError: () => toast.error("Could not send the reset email."),
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <h1 className="text-2xl font-medium">Forgot password</h1>
      {sent ? (
        <p className="mt-4 text-center text-muted-foreground">
          If the account exists, a reset link has been sent to its email.
        </p>
      ) : (
        <form
          className="mt-6 w-full max-w-md space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="username">Email</Label>
            <Input
              id="username"
              placeholder="Email address"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={request.isPending}>
            {request.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <Link href="/auth/login" className="mt-4 text-sm text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
