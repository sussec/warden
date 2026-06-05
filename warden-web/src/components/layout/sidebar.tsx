"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  SearchCode,
  Package,
  Shield,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "APPLICATION",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/project", label: "Project", icon: FolderGit2 },
      { href: "/finding", label: "Finding", icon: SearchCode },
      { href: "/dependency", label: "Dependency", icon: Package },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { href: "/rule", label: "Rule", icon: Shield },
      { href: "/user", label: "User Manager", icon: Users },
      { href: "/setting", label: "Setting", icon: Settings },
    ],
  },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const pathname = usePathname();

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
          "fixed left-4 top-16 bottom-4 z-40 w-64 overflow-y-auto rounded-lg bg-sidebar p-4 shadow-sm transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-[120%]",
        )}
      >
      {groups.map((group) => (
        <div key={group.label} className="mb-4">
          <div className="px-3 py-2 text-xs font-bold tracking-wider text-sidebar-foreground">
            {group.label}
          </div>
          <nav className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    // close the drawer after navigating on mobile
                    if (typeof window !== "undefined" && window.innerWidth <= 991) onClose?.();
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                  )}
                >
                  <item.icon className="size-4.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
      </aside>
    </>
  );
}
