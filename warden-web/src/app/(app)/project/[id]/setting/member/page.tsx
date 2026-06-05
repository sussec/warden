"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Trash2, Pencil, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import { DataTable, type ColumnDef, type PageState } from "@/components/data-table/data-table";
import {
  getProjectUsers,
  addMember,
  updateProjectMember,
  deleteProjectMember,
  listProjectManagerUser,
} from "@/client/sdk.gen";
import type { ProjectMember, ProjectRole } from "@/client/types.gen";

const ROLES: ProjectRole[] = ["Developer", "Validator", "Manager"];

export default function ProjectMemberPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [page, setPage] = useState<PageState>({ page: 1, size: 20 });
  const [name, setName] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<ProjectRole>("Developer");

  const [editMember, setEditMember] = useState<ProjectMember | null>(null);
  const [editRole, setEditRole] = useState<ProjectRole>("Developer");

  const [deleteTarget, setDeleteTarget] = useState<ProjectMember | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["project-members", id, page, name],
    queryFn: async () =>
      (
        await getProjectUsers({
          path: { projectId: id },
          body: { page: page.page, size: page.size, name: name || null, desc: true },
          throwOnError: true,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const { data: candidateUsers } = useQuery({
    queryKey: ["project-manager-users"],
    queryFn: async () => (await listProjectManagerUser({ throwOnError: true })).data,
    enabled: addOpen,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["project-members", id] });
  }

  const addMut = useMutation({
    mutationFn: async () =>
      (
        await addMember({
          path: { projectId: id },
          body: { userId: newUserId, role: newRole },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("Member added.");
      setAddOpen(false);
      setNewUserId("");
      setNewRole("Developer");
      invalidate();
    },
    onError: () => toast.error("Could not add member."),
  });

  const updateMut = useMutation({
    mutationFn: async () =>
      (
        await updateProjectMember({
          path: { projectId: id, userId: editMember!.userId },
          body: { role: editRole },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("Member updated.");
      setEditMember(null);
      invalidate();
    },
    onError: () => toast.error("Could not update member."),
  });

  const deleteMut = useMutation({
    mutationFn: async () =>
      (
        await deleteProjectMember({
          path: { projectId: id, userId: deleteTarget!.userId },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("Member removed.");
      setDeleteTarget(null);
      invalidate();
    },
    onError: () => toast.error("Could not remove member."),
  });

  const columns: ColumnDef<ProjectMember>[] = [
    {
      key: "user",
      header: "User",
      className: "min-w-72",
      cell: (m) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            {m.avatar && <AvatarImage src={m.avatar} alt={m.userName ?? ""} />}
            <AvatarFallback>{(m.fullName ?? m.userName ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{m.fullName ?? m.userName}</span>
            <span className="text-xs text-muted-foreground">{m.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (m) => <Badge variant="secondary">{m.role}</Badge>,
    },
    {
      key: "createdAt",
      header: "Added",
      cell: (m) => (
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      className: "w-20",
      cell: (m) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Edit member"
            onClick={() => {
              setEditMember(m);
              setEditRole(m.role);
            }}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove member"
            onClick={() => setDeleteTarget(m)}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      {/* header + filters */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Members</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 bg-card/70 backdrop-blur-md"
              placeholder="Search members…"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPage((p) => ({ ...p, page: 1 }));
              }}
            />
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4" /> Add member
        </Button>
      </div>

      {/* table region — scrolls inside, page stays fixed */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-md">
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={isLoading}
          count={data?.count}
          pageCount={data?.pageCount}
          page={page}
          onPageChange={setPage}
          emptyMessage="No members found"
        />
      </div>

      {/* Add member */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>Select a user and assign a project role.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={newUserId} onValueChange={setNewUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {candidateUsers?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName ?? u.userName} {u.email ? `(${u.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as ProjectRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => addMut.mutate()} disabled={!newUserId || addMut.isPending}>
              {addMut.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit role */}
      <Dialog open={!!editMember} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update role</DialogTitle>
            <DialogDescription>
              {editMember?.fullName ?? editMember?.userName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={editRole} onValueChange={(v) => setEditRole(v as ProjectRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>
              Cancel
            </Button>
            <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
              {updateMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              Remove {deleteTarget?.fullName ?? deleteTarget?.userName} from this project?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
