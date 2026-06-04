"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getProfile, logout as logoutOp } from "@/client/sdk.gen";
import { session } from "./session";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await getProfile({ throwOnError: true });
      return data;
    },
    enabled: session.isAuthenticated(),
    staleTime: 5 * 60_000,
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async () => {
    try {
      // refresh token comes from the httpOnly cookie server-side
      await logoutOp({ body: {} });
    } catch {
      /* best-effort server-side token revoke */
    }
    session.clear();
    queryClient.clear();
    router.replace("/auth/login");
  };
}
