"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/lib/auth/guard";
import { installAuthInterceptors } from "@/lib/auth/interceptors";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

installAuthInterceptors();

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(true);

  // default: open on desktop, closed on mobile (991px parity with Angular)
  useEffect(() => {
    setMenuOpen(window.innerWidth > 991);
  }, []);

  return (
    <AuthGuard>
      <Topbar onMenuToggle={() => setMenuOpen((v) => !v)} />
      <Sidebar open={menuOpen} />
      <main
        className={
          "min-h-dvh bg-muted pt-18 pb-4 pr-4 transition-[padding] duration-200 " +
          (menuOpen ? "pl-4 lg:pl-72" : "pl-4")
        }
      >
        {children}
      </main>
    </AuthGuard>
  );
}
