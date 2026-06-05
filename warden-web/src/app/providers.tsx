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
        gap={10}
        offset={20}
        toastOptions={{
          // Mirror the app's Card surface (rounded-xl, bg-card, shadow-sm) and
          // the Outfit body font so toasts feel native to the warm-editorial UI.
          classNames: {
            toast:
              "group !font-sans gap-2.5 !rounded-xl !border-border !bg-card !text-card-foreground !shadow-sm p-4",
            icon: "[&>svg]:size-4.5",
            title: "text-sm font-semibold tracking-tight",
            description: "!text-muted-foreground text-[13px] leading-relaxed",
            actionButton:
              "!rounded-md !bg-primary !text-primary-foreground text-xs font-medium",
            cancelButton:
              "!rounded-md !bg-muted !text-muted-foreground text-xs font-medium",
            closeButton:
              "!border-border !bg-card !text-muted-foreground hover:!text-foreground hover:!bg-muted",
            success: "[&_[data-icon]>svg]:text-emerald-600",
            error: "[&_[data-icon]>svg]:text-red-600",
            warning: "[&_[data-icon]>svg]:text-amber-600",
            info: "[&_[data-icon]>svg]:text-primary",
          },
        }}
      />
    </QueryClientProvider>
  );
}
