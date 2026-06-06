"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { backfill, getAiSetting, testAiSetting, updateAiSetting } from "@/client/sdk.gen";
import type { AiProvider, AiSetting } from "@/client/types.gen";

const PROVIDERS: { value: AiProvider; label: string; hint: string; endpoint: string; model: string }[] = [
  {
    value: "OpenAiCompatible",
    label: "OpenAI-compatible",
    hint: "OpenAI, Ollama, OpenRouter, vLLM, LM Studio, z.ai /v4 — any /v1 chat-completions endpoint.",
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
  },
  {
    value: "Anthropic",
    label: "Anthropic",
    hint: "Anthropic Messages API (api.anthropic.com or a compatible gateway). Set the embedding fields below — Anthropic has no embeddings API.",
    endpoint: "https://api.anthropic.com",
    model: "claude-sonnet-4-6",
  },
  {
    value: "AzureOpenAi",
    label: "Azure OpenAI",
    hint: "Azure OpenAI resource. Use the deployment name as the model and the resource URL as the endpoint.",
    endpoint: "https://<resource>.openai.azure.com",
    model: "<deployment-name>",
  },
];

export default function AiSettingPage() {
  const [form, setForm] = useState<AiSetting>({ provider: "OpenAiCompatible" });

  const { data } = useQuery({
    queryKey: ["setting-ai"],
    queryFn: async () => (await getAiSetting({ throwOnError: true })).data,
  });
  const [seededFrom, setSeededFrom] = useState<unknown>(null);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data);
  }

  const provider = PROVIDERS.find((p) => p.value === (form.provider ?? "OpenAiCompatible")) ?? PROVIDERS[0];
  const isAnthropic = provider.value === "Anthropic";

  const save = useMutation({
    mutationFn: async () => {
      await updateAiSetting({ body: form, throwOnError: true });
    },
    onSuccess: () => toast.success("AI settings saved"),
    onError: () => toast.error("Failed to save AI settings"),
  });

  const test = useMutation({
    mutationFn: async () => (await testAiSetting({ body: form, throwOnError: true })).data,
    onSuccess: (ok) => (ok ? toast.success("AI connection OK") : toast.error("AI test failed")),
    onError: () => toast.error("AI test failed"),
  });

  const rebuild = useMutation({
    mutationFn: async () => (await backfill({ throwOnError: true })).data,
    onSuccess: (res) =>
      toast.success(`Search index rebuilt (${res?.processed ?? 0} findings)`),
    onError: () => toast.error("Failed to rebuild search index"),
  });

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      {/* header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">AI</h1>
          <p className="text-xs text-muted-foreground">
            LLM endpoint for remediation suggestions, triage &amp; semantic search
          </p>
        </div>
      </div>

      {/* scrollable form region — page stays fixed */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-md">
        <Card className="border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle>AI provider</CardTitle>
          <CardDescription>
            LLM endpoint for remediation suggestions, triage, and semantic search.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.enabled ?? false}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
              Enable AI features
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={form.provider ?? "OpenAiCompatible"}
                  onValueChange={(v) => setForm((f) => ({ ...f, provider: v as AiProvider }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden sm:block" />
            </div>
            <p className="text-xs text-muted-foreground">{provider.hint}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ai-endpoint">Endpoint</Label>
                <Input
                  id="ai-endpoint"
                  placeholder={provider.endpoint}
                  value={form.endpoint ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-key">API Key</Label>
                <Input
                  id="ai-key"
                  type="password"
                  placeholder="••••••••"
                  value={form.apiKey ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-model">Chat model</Label>
                <Input
                  id="ai-model"
                  placeholder={provider.model}
                  value={form.model ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                />
              </div>
            </div>

            <Separator />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Embeddings (semantic search)</h3>
              <p className="text-xs text-muted-foreground">
                Embeddings always use an OpenAI-compatible endpoint.
                {isAnthropic
                  ? " Anthropic has no embeddings API — set a dedicated endpoint here, or leave blank to disable semantic search."
                  : " Leave the endpoint blank to reuse the chat endpoint above."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ai-embed-model">Embedding model</Label>
                <Input
                  id="ai-embed-model"
                  placeholder="text-embedding-3-small"
                  value={form.embeddingModel ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, embeddingModel: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-embed-dim">Embedding dimension</Label>
                <Input
                  id="ai-embed-dim"
                  type="number"
                  min={1}
                  placeholder="1536"
                  value={form.embeddingDimension ?? 1536}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, embeddingDimension: Number(e.target.value) || 1536 }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Must match the model: OpenAI 3-small = 1536, nomic-embed-text = 768,
                  mxbai-embed-large = 1024. Changing it requires Rebuild search index.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-embed-endpoint">
                  Embedding endpoint {isAnthropic ? "" : "(optional)"}
                </Label>
                <Input
                  id="ai-embed-endpoint"
                  placeholder={isAnthropic ? "https://api.openai.com/v1" : "(reuse chat endpoint)"}
                  value={form.embeddingEndpoint ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, embeddingEndpoint: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-embed-key">Embedding API key (optional)</Label>
                <Input
                  id="ai-embed-key"
                  type="password"
                  placeholder="(reuse chat key)"
                  value={form.embeddingApiKey ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, embeddingApiKey: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={test.isPending}
                onClick={() => test.mutate()}
              >
                {test.isPending ? "Testing…" : "Test Connection"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={rebuild.isPending || !form.enabled}
                onClick={() => {
                  if (
                    window.confirm(
                      "Rebuild the AI semantic-search index over all existing findings? This may take a while.",
                    )
                  ) {
                    rebuild.mutate();
                  }
                }}
              >
                {rebuild.isPending ? "Rebuilding…" : "Rebuild search index"}
              </Button>
              <Button type="submit" disabled={save.isPending} className="ml-auto">
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
