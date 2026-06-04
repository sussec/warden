"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/client/sdk.gen";
import { useProfile } from "@/lib/auth/use-session";

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const change = useMutation({
    mutationFn: async () =>
      (
        await changePassword({
          body: { currentPassword, newPassword },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>
          Minimum 8 characters with upper, lower, digit and symbol.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (newPassword !== confirm) {
              toast.error("Passwords do not match.");
              return;
            }
            change.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();

  const name = profile?.fullName ?? profile?.userName ?? "Unknown";
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                {profile?.avatar && <AvatarImage src={profile.avatar} alt={name} />}
                <AvatarFallback className="text-xl">{initial}</AvatarFallback>
              </Avatar>
              <dl className="space-y-1">
                <dt className="sr-only">Name</dt>
                <dd className="text-lg font-semibold">{name}</dd>
                <dt className="sr-only">Username</dt>
                <dd className="text-sm text-muted-foreground">
                  @{profile?.userName ?? "unknown"}
                </dd>
                <dt className="sr-only">Email</dt>
                <dd className="text-sm text-muted-foreground">{profile?.email ?? "—"}</dd>
              </dl>
            </div>
          )}
        </CardContent>
      </Card>
      <ChangePasswordCard />
    </div>
  );
}
