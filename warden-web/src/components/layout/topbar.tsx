"use client";

import Link from "next/link";
import { Menu, Moon, Sun, User, LogOut, Settings } from "lucide-react";
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
  const { dark, setDarkMode } = useTheme();
  const logout = useLogout();
  const { data: profile } = useProfile();

  return (
    <header className="warden-topbar fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
        className="cursor-pointer"
      >
        <Menu className="size-5" />
      </Button>
      <Link href="/dashboard" aria-label="Warden — dashboard" className="ody-brand group">
        <span className="prompt">$_</span>
        <span>warden</span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 pr-0.5">
          <Sun
            aria-hidden
            className={`size-4 transition-colors ${dark ? "text-muted-foreground/50" : "text-primary"}`}
          />
          <ElasticToggle
            checked={dark}
            onCheckedChange={(isDark) => setDarkMode(isDark)}
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
              variant="outline"
              size="icon"
              className="cursor-pointer border-border bg-transparent"
              aria-label="Profile menu"
            >
              <User className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-none border-border bg-card">
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
