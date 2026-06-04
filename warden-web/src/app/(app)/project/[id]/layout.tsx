"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bug, Boxes, ScanLine, Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getProjectInfo } from "@/client/sdk.gen";

const TABS = [
  { label: "Overview", segment: "overview", icon: ScanLine },
  { label: "Finding", segment: "finding", icon: Bug },
  { label: "Dependency", segment: "dependency", icon: Boxes },
  { label: "Setting", segment: "setting", icon: Settings },
] as const;

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project-info", id],
    queryFn: async () =>
      (await getProjectInfo({ path: { projectId: id }, throwOnError: true })).data,
  });

  return (
    <Card className="min-w-md overflow-x-auto p-6">
      <div className="flex flex-col gap-1">
        {isLoading ? (
          <Skeleton className="h-7 w-48" />
        ) : (
          <h1 className="text-xl font-bold">{project?.name ?? "Project"}</h1>
        )}
        {project && (
          <span className="text-sm text-muted-foreground">{project.sourceType}</span>
        )}
      </div>

      <nav className="mt-4 flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => {
          const href = `/project/${id}/${tab.segment}`;
          const active = pathname.startsWith(href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.segment}
              href={href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">{children}</div>
    </Card>
  );
}
