"use client";

import Link from "next/link";
import { Menu, Moon, Sun, User, LogOut, Settings } from "lucide-react";
import { WardenLogo } from "./logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/use-theme";
import { useLogout, useProfile } from "@/lib/auth/use-session";

export function Topbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { dark, toggle } = useTheme();
  const logout = useLogout();
  const { data: profile } = useProfile();

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 bg-background px-4">
      <Button variant="ghost" size="icon" onClick={onMenuToggle} aria-label="Toggle menu">
        <Menu className="size-5" />
      </Button>
      <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold tracking-wide uppercase text-primary">
        <WardenLogo className="size-7" />
        <span className="text-foreground">Techanv Warden</span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" size="icon" className="rounded-full" aria-label="Profile menu">
              <User className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">
              {profile?.fullName ?? profile?.userName ?? "Account"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User className="size-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/setting">
                <Settings className="size-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} variant="destructive">
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
