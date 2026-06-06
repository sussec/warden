"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { confirmEmail } from "@/client/sdk.gen";

function ConfirmEmailHandler() {
  const search = useSearchParams();
  const [state, setState] = useState<"pending" | "ok" | "failed">("pending");
  const token = search.get("token");
  const username = search.get("username");

  const confirm = useMutation({
    mutationFn: async () =>
      (
        await confirmEmail({
          body: { token: token ?? "", username: username ?? "" },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => setState("ok"),
    onError: () => setState("failed"),
  });

  // run once when arriving with a token link
  useEffect(() => {
    if (token && username) confirm.mutate();
    // fallback of a one-shot mutation trigger; cannot be a render-phase pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setState("failed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-2xl font-bold">Email confirmation</h1>
      {state === "pending" && <p className="text-muted-foreground">Confirming…</p>}
      {state === "ok" && (
        <p className="text-muted-foreground">Email confirmed. You can sign in now.</p>
      )}
      {state === "failed" && (
        <p className="text-muted-foreground">
          Confirmation failed. The link may be invalid or expired — check your inbox for
          the latest email.
        </p>
      )}
      <Link href="/auth/login" className="text-sm text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense>
      <ConfirmEmailHandler />
    </Suspense>
  );
}
