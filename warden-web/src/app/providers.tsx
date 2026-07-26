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
          // Odyssey: sharp mono panels, chatak red accents.
          classNames: {
            toast:
              "group !font-mono gap-2.5 !rounded-none !border-border !bg-card !text-card-foreground !shadow-none p-4 tracking-wide",
            icon: "[&>svg]:size-4.5",
            title: "text-sm font-medium tracking-tight",
            description: "!text-muted-foreground text-[13px] leading-relaxed",
            actionButton:
              "!rounded-none !bg-primary !text-primary-foreground text-xs font-medium",
            cancelButton:
              "!rounded-none !bg-muted !text-muted-foreground text-xs font-medium",
            closeButton:
              "!border-border !bg-card !text-muted-foreground hover:!text-foreground hover:!bg-muted !rounded-none",
            success: "[&_[data-icon]>svg]:text-red-17",
            error: "[&_[data-icon]>svg]:text-primary",
            warning: "[&_[data-icon]>svg]:text-red-15",
            info: "[&_[data-icon]>svg]:text-primary",
          },
        }}
      />
    </QueryClientProvider>
  );
}
