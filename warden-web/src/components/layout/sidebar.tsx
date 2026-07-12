"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  History,
  KeyRound,
  LayoutDashboard,
  FolderGit2,
  Lock,
  Plug,
  Radar,
  ScanSearch,
  SearchCode,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Package,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavChild = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavItem = NavChild & { children?: NavChild[] };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "APPLICATION",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/project", label: "Project", icon: FolderGit2 },
      { href: "/finding", label: "Finding", icon: SearchCode },
      { href: "/dependency", label: "Dependency", icon: Package },
      {
        href: "/scanner",
        label: "Scanner",
        icon: Radar,
        children: [
          { href: "/scanner", label: "Scan Fleet", icon: ScanSearch },
          { href: "/scanner/runs", label: "Scan Runs", icon: History },
          { href: "/scanner/registered", label: "Registered", icon: ShieldCheck },
        ],
      },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { href: "/rule", label: "Rule", icon: Shield },
      { href: "/user", label: "User Manager", icon: Users },
      {
        href: "/setting",
        label: "Setting",
        icon: Settings,
        children: [
          { href: "/setting/general", label: "General", icon: SlidersHorizontal },
          { href: "/setting/authentication", label: "Authentication", icon: Lock },
          { href: "/setting/sla", label: "SLA", icon: Timer },
          { href: "/setting/ai", label: "AI", icon: Sparkles },
          { href: "/setting/ci-token", label: "CI Token", icon: KeyRound },
          { href: "/setting/integration", label: "Integrations", icon: Plug },
        ],
      },
    ],
  },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // sections with an active child render expanded; manual toggles override
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const closeOnMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth <= 991) onClose?.();
  };

  return (
    <>
      {/* mobile scrim: closes the menu when tapping outside it */}
      {open && (
        <div
          className="fixed inset-0 top-14 z-30 bg-black/50 lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          // Ops rail: near-black glass, hairline border, cyan active rail.
          "fixed left-3 top-16 bottom-3 z-40 w-64 overflow-y-auto rounded-lg border border-sidebar-border/70 bg-sidebar p-3 shadow-sm backdrop-blur-xl transition-transform duration-200 supports-[backdrop-filter]:bg-sidebar/80 motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-[120%]",
        )}
      >
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="warden-mono-label px-3 py-2">{group.label}</div>
            <nav className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);

                if (!item.children) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeOnMobile}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "warden-nav-active"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                      )}
                    >
                      <item.icon className="size-4.5 shrink-0" />
                      {item.label}
                    </Link>
                  );
                }

                const isOpen = expanded[item.href] ?? active;
                return (
                  <div key={item.href}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [item.href]: !isOpen }))
                      }
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "font-semibold text-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                      )}
                    >
                      <item.icon className="size-4.5 shrink-0" />
                      {item.label}
                      <ChevronRight
                        className={cn(
                          "ml-auto size-4 transition-transform duration-200",
                          isOpen && "rotate-90",
                        )}
                      />
                    </button>
                    {isOpen && (
                      <div className="ml-5 mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                        {item.children.map((child) => {
                          // exact match — child routes are leaves (avoids /scanner
                          // matching /scanner/runs via startsWith)
                          const childActive = pathname === child.href;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={closeOnMobile}
                              className={cn(
                                "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                                childActive
                                  ? "warden-nav-active"
                                  : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                              )}
                            >
                              <child.icon className="size-4 shrink-0" />
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        ))}
      </aside>
    </>
  );
}
