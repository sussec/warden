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

export function Sidebar({ open }: { open: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-4 top-16 bottom-4 z-40 w-64 overflow-y-auto rounded-lg bg-sidebar p-4 shadow-sm transition-transform duration-200 lg:translate-x-0",
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
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-semibold text-sidebar-primary"
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
  );
}
