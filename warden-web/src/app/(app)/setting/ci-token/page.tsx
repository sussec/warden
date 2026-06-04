"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Copy, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type ColumnDef, type PageState } from "@/components/data-table/data-table";
import { getCiTokens, createCiToken, deleteCiToken } from "@/client/sdk.gen";
import type { CiTokens } from "@/client/types.gen";

export default function CiTokenPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState<PageState>({ page: 1, size: 20 });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CiTokens | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ci-tokens"],
    queryFn: async () => (await getCiTokens({ throwOnError: true })).data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ci-tokens"] });

  const createMut = useMutation({
    mutationFn: async () =>
      (await createCiToken({ body: { name }, throwOnError: true })).data,
    onSuccess: (token) => {
      toast.success("Token created");
      setCreatedToken(token?.value ?? null);
      setName("");
      refresh();
    },
    onError: () => toast.error("Failed to create token"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await deleteCiToken({ path: { id }, throwOnError: true });
    },
    onSuccess: () => {
      toast.success("Token deleted");
      setDeleteTarget(null);
      refresh();
    },
    onError: () => toast.error("Failed to delete token"),
  });

  const copy = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreatedToken(null);
    setName("");
  };

  // client-side paginate the full list returned by the API
  const allRows = data ?? [];
  const pageRows = allRows.slice((page.page - 1) * page.size, page.page * page.size);
  const pageCount = Math.max(1, Math.ceil(allRows.length / page.size));

  const columns: ColumnDef<CiTokens>[] = [
    {
      key: "name",
      header: "Name",
      cell: (t) => <span className="font-semibold">{t.name ?? "—"}</span>,
    },
    {
      key: "createdAt",
      header: "Created At",
      cell: (t) => (
        <span className="text-muted-foreground">
          {t.createdAt ? format(new Date(t.createdAt), "yyyy-MM-dd HH:mm") : "—"}
        </span>
      ),
    },
    {
      key: "expiredAt",
      header: "Expires",
      cell: (t) => (
        <span className="text-muted-foreground">
          {t.expiredAt ? format(new Date(t.expiredAt), "yyyy-MM-dd") : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (t) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete token"
          onClick={() => setDeleteTarget(t)}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      ),
    },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">CI Tokens</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create Token
        </Button>
      </div>
      <div className="my-4" />
      <DataTable
        columns={columns}
        rows={pageRows}
        loading={isLoading}
        count={allRows.length}
        pageCount={pageCount}
        page={page}
        onPageChange={setPage}
        emptyMessage="No CI tokens yet"
      />

      {/* Create token */}
      <Dialog open={createOpen} onOpenChange={(o) => (o ? setCreateOpen(true) : closeCreate())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create CI Token</DialogTitle>
            <DialogDescription>
              Tokens are used by CI pipelines to upload scan results.
            </DialogDescription>
          </DialogHeader>

          {createdToken ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Copy this token now — it will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={createdToken} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copy} aria-label="Copy token">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <form
              id="create-token-form"
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate();
              }}
            >
              <Label htmlFor="token-name">Name</Label>
              <Input
                id="token-name"
                placeholder="github-actions"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </form>
          )}

          <DialogFooter>
            {createdToken ? (
              <Button onClick={closeCreate}>Done</Button>
            ) : (
              <>
                <Button variant="outline" type="button" onClick={closeCreate}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="create-token-form"
                  disabled={createMut.isPending || !name}
                >
                  {createMut.isPending ? "Creating…" : "Create"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Token</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? Any pipeline
              using it will stop working.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget?.id && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
