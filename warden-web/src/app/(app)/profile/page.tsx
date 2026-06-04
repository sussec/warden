"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/lib/auth/use-session";

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
    </div>
  );
}
