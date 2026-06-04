"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { session } from "./session";

/** Client-side auth guard: children render only with a token present. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!session.isAuthenticated()) {
      router.replace(`/auth/login?returnUrl=${encodeURIComponent(pathname)}`);
    } else {
      setReady(true);
    }
  }, [router, pathname]);

  if (!ready) return null;
  return <>{children}</>;
}

/** Reverse guard for auth pages: redirect signed-in users away. */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const search = useSearchParams();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (session.isAuthenticated()) {
      router.replace(search.get("returnUrl") ?? "/dashboard");
    } else {
      setReady(true);
    }
  }, [router, search]);

  if (!ready) return null;
  return <>{children}</>;
}
