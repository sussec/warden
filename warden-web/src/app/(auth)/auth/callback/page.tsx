"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";
import { session } from "@/lib/auth/session";

// OIDC return target. The API redirects here with ?oidc=true[&message=…];
// the session itself arrives as httpOnly cookies (never in the URL).
function CallbackHandler() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const message = search.get("message");
    if (session.isAuthenticated()) {
      router.replace("/dashboard");
      return;
    }
    if (message) toast.error(message);
    router.replace("/auth/login");
  }, [router, search]);

  return <p className="text-center text-muted-foreground">Signing you in…</p>;
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
