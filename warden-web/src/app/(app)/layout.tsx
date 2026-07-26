"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/lib/auth/guard";
import { installAuthInterceptors } from "@/lib/auth/interceptors";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";

installAuthInterceptors();

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(true);

  // Restore the user's last sidebar choice; fall back to open on desktop only.
  // window is unavailable during SSR; reading at render time causes hydration mismatch.
  useEffect(() => {
    const saved = window.localStorage.getItem("sidebar-open");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(saved !== null ? saved === "1" : window.innerWidth > 991);
  }, []);

  const toggleMenu = () =>
    setMenuOpen((v) => {
      const next = !v;
      window.localStorage.setItem("sidebar-open", next ? "1" : "0");
      return next;
    });

  return (
    <AuthGuard>
      <Topbar onMenuToggle={toggleMenu} />
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main
        className={
          "min-h-dvh bg-background pt-14 pb-4 pr-0 transition-[padding] duration-200 " +
          (menuOpen ? "pl-0 lg:pl-64" : "pl-0")
        }
      >
        {/* Odyssey canvas — pure black field, hairline only, no glass panel */}
        <div className="relative min-h-[calc(100dvh-3.5rem)] border-l border-border/80 bg-background p-4 sm:p-5 md:p-6">
          <div className="relative">
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
