"use client";

import { useState } from "react";
import { useQuery, keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type ColumnDef, type PageState } from "@/components/data-table/data-table";
import {
  getUserDetailByFilter,
  getRoles,
  createUser,
  updateUser,
  sendConfirmEmail,
} from "@/client/sdk.gen";
import type { UserDetail, UserStatus } from "@/client/types.gen";

const ALL = "__all__";

function initials(name?: string | null, fallback?: string | null) {
  const src = (name || fallback || "?").trim();
  return src.charAt(0).toUpperCase();
}

export default function UserListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState<PageState>({ page: 1, size: 20 });
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<string>(ALL);

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDetail | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", page, name, roleId],
    queryFn: async () =>
      (
        await getUserDetailByFilter({
          body: {
            page: page.page,
            size: page.size,
            name: name || null,
            roleId: roleId === ALL ? null : roleId,
            sortBy: "CreatedAt",
            desc: true,
          },
          throwOnError: true,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await getRoles({ throwOnError: true })).data,
    staleTime: 5 * 60_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  // create-user dialog state
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newVerified, setNewVerified] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const createMut = useMutation({
    mutationFn: async () =>
      (
        await createUser({
          body: {
            email: newEmail,
            role: newRole,
            verified: newVerified,
            userName: newUserName || null,
            fullName: newFullName || null,
            password: newPassword || null,
          },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("User created");
      setCreateOpen(false);
      setNewEmail("");
      setNewRole("");
      setNewVerified(false);
      setNewUserName("");
      setNewFullName("");
      setNewPassword("");
      refresh();
    },
    onError: () => toast.error("Failed to create user"),
  });

  // edit-role dialog state
  const [editRole, setEditRole] = useState("");

  const updateRoleMut = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      await updateUser({
        path: { userId: editUser.id },
        body: { role: editRole },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      toast.success("Role updated");
      setEditUser(null);
      refresh();
    },
    onError: () => toast.error("Failed to update role"),
  });

  const toggleStatusMut = useMutation({
    mutationFn: async (user: UserDetail) => {
      const next: UserStatus = user.status === "Active" ? "Disabled" : "Active";
      await updateUser({
        path: { userId: user.id },
        body: { status: next },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      refresh();
    },
    onError: () => toast.error("Failed to update status"),
  });

  const resendConfirmMut = useMutation({
    mutationFn: async (user: UserDetail) => {
      await sendConfirmEmail({ path: { userId: user.id }, throwOnError: true });
    },
    onSuccess: () => toast.success("Confirmation email sent"),
    onError: () => toast.error("Failed to send confirmation email"),
  });

  const columns: ColumnDef<UserDetail>[] = [
    {
      key: "user",
      header: "User",
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            {u.avatar && <AvatarImage src={u.avatar} alt={u.fullName ?? ""} />}
            <AvatarFallback>{initials(u.fullName, u.userName)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-semibold">{u.fullName ?? u.userName ?? "Unknown"}</span>
            <span className="text-xs text-muted-foreground">{u.email ?? "—"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (u) => <Badge variant="secondary">{u.role ?? "—"}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      cell: (u) => (
        <Badge variant={u.status === "Active" ? "default" : "destructive"}>{u.status}</Badge>
      ),
    },
    {
      key: "verified",
      header: "Verified",
      cell: (u) =>
        u.verified ? (
          <Badge variant="default">Verified</Badge>
        ) : (
          <Badge variant="outline">Pending</Badge>
        ),
    },
    {
      key: "createdAt",
      header: "Created At",
      cell: (u) => (
        <span className="text-muted-foreground">
          {format(new Date(u.createdAt), "yyyy-MM-dd")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (u) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditUser(u);
              setEditRole(u.role ?? "");
            }}
          >
            Edit role
          </Button>
          <Button
            variant={u.status === "Active" ? "destructive" : "secondary"}
            size="sm"
            disabled={toggleStatusMut.isPending}
            onClick={() => toggleStatusMut.mutate(u)}
          >
            {u.status === "Active" ? "Deactivate" : "Activate"}
          </Button>
          {!u.verified && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={resendConfirmMut.isPending}
                  onClick={() => resendConfirmMut.mutate(u)}
                >
                  Resend confirmation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Users</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-4" />
          Add User
        </Button>
      </div>
      <div className="my-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-64 pl-9"
            placeholder="Search users…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setPage((p) => ({ ...p, page: 1 }));
            }}
          />
        </div>
        <Select
          value={roleId}
          onValueChange={(v) => {
            setRoleId(v);
            setPage((p) => ({ ...p, page: 1 }));
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
            {roles?.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={data?.items}
        loading={isLoading}
        count={data?.count}
        pageCount={data?.pageCount}
        page={page}
        onPageChange={setPage}
      />

      {/* Create user */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Invite a user by email. They will receive a confirmation email.
            </DialogDescription>
          </DialogHeader>
          <form
            id="create-user-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-username">Username (optional)</Label>
                <Input
                  id="new-username"
                  placeholder="defaults to email prefix"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-fullname">Full name (optional)</Label>
                <Input
                  id="new-fullname"
                  placeholder="defaults to username"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password (optional)</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="leave empty to send an invite email"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="new-role" className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((r) => (
                    <SelectItem key={r.name ?? ""} value={r.name ?? ""}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={newVerified}
                onCheckedChange={(v) => setNewVerified(v === true)}
              />
              Mark as verified
            </label>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-user-form"
              disabled={createMut.isPending || !newRole}
            >
              {createMut.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit role */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Change the role for {editUser?.fullName ?? editUser?.email ?? "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-role">Role</Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger id="edit-role" className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((r) => (
                  <SelectItem key={r.name ?? ""} value={r.name ?? ""}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateRoleMut.mutate()}
              disabled={updateRoleMut.isPending || !editRole}
            >
              {updateRoleMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
