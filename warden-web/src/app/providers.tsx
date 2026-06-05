"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      <Toaster
        position="bottom-right"
        closeButton
        gap={8}
        toastOptions={{
          classNames: {
            toast:
              "group rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
            title: "text-sm font-semibold",
            description: "text-muted-foreground",
            actionButton: "rounded-md bg-primary text-primary-foreground",
            cancelButton: "rounded-md bg-muted text-muted-foreground",
            closeButton:
              "border-border bg-popover text-muted-foreground hover:text-foreground",
            success: "[&_[data-icon]>svg]:text-emerald-600",
            error: "[&_[data-icon]>svg]:text-destructive",
            warning: "[&_[data-icon]>svg]:text-primary",
            info: "[&_[data-icon]>svg]:text-primary",
          },
        }}
      />
    </QueryClientProvider>
  );
}
