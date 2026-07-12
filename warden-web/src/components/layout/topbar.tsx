"use client";

import Link from "next/link";
import { Menu, Moon, Sun, User, LogOut, Settings } from "lucide-react";
import { WardenBadge } from "./logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ElasticToggle } from "@/components/ui/elastic-toggle";
import { useTheme } from "@/lib/use-theme";
import { useLogout, useProfile } from "@/lib/auth/use-session";

export function Topbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { dark, toggle } = useTheme();
  const logout = useLogout();
  const { data: profile } = useProfile();

  return (
    <header className="warden-topbar fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
        className="cursor-pointer"
      >
        <Menu className="size-5" />
      </Button>
      <Link
        href="/dashboard"
        aria-label="Techanv Warden — dashboard"
        className="group flex items-center gap-2 text-primary"
      >
        <WardenBadge className="transition-transform duration-300 group-hover:scale-[1.06]" />
        <span className="hidden font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:inline">
          Techanv · Warden
        </span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 pr-0.5">
          <Sun
            aria-hidden
            className={`size-4 transition-colors ${dark ? "text-muted-foreground/50" : "text-primary"}`}
          />
          <ElasticToggle
            checked={dark}
            onCheckedChange={toggle}
            aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
          />
          <Moon
            aria-hidden
            className={`size-4 transition-colors ${dark ? "text-primary" : "text-muted-foreground/50"}`}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="cursor-pointer rounded-full"
              aria-label="Profile menu"
            >
              <User className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-mono text-xs tracking-wide">
              {profile?.fullName ?? profile?.userName ?? "Account"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <User className="size-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/setting" className="cursor-pointer">
                <Settings className="size-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} variant="destructive" className="cursor-pointer">
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
