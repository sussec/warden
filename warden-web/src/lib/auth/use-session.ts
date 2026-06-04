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
      const token = session.getRefresh();
      if (token) await logoutOp({ body: { token } });
    } catch {
      /* best-effort server-side token revoke */
    }
    session.clear();
    queryClient.clear();
    router.replace("/auth/login");
  };
}
