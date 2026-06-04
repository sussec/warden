"use client";

import { installAuthInterceptors } from "@/lib/auth/interceptors";

installAuthInterceptors();

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl rounded-[2.5rem] border border-primary/60 bg-card p-10 shadow-lg">
        {children}
      </div>
    </div>
  );
}
