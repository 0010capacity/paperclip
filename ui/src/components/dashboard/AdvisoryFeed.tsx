import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Lightbulb, MessageSquare, AlertTriangle, FileText, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { advisoriesApi, type AdvisoryEntry } from "../../api/advisories";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, { label: string; icon: typeof Lightbulb; color: string }> = {
  "agent.advisory.observation": { label: "Observation", icon: Lightbulb, color: "text-blue-500" },
  "agent.advisory.suggestion": { label: "Suggestion", icon: MessageSquare, color: "text-green-500" },
  "agent.advisory.concern": { label: "Concern", icon: AlertTriangle, color: "text-amber-500" },
  "agent.advisory.progress_note": { label: "Progress", icon: FileText, color: "text-muted-foreground" },
};

interface Props {
  companyId: string;
}

export function AdvisoryFeed({ companyId }: Props) {
  const { t } = useTranslation("components");
  const queryClient = useQueryClient();

  const { data: advisories = [], isLoading } = useQuery({
    queryKey: queryKeys.advisories(companyId),
    queryFn: () => advisoriesApi.list(companyId),
    enabled: !!companyId,
  });

  const promoteMutation = useMutation({
    mutationFn: (advisoryId: string) => advisoriesApi.promote(advisoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.advisories(companyId) });
    },
  });

  const handlePromote = async (advisoryId: string) => {
    await promoteMutation.mutateAsync(advisoryId);
  };

  const parseDetails = (details: string): { summary?: string } => {
    try {
      return JSON.parse(details);
    } catch {
      return { summary: details };
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground animate-pulse">{t("common.loading")}</p>
      </div>
    );
  }

  if (advisories.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
        <span>🔔</span> {t("advisory_feed.title")}
      </h3>

      <div className="space-y-2">
        {advisories.slice(0, 5).map((advisory) => {
          const details = parseDetails(advisory.details);
          const actionInfo = ACTION_LABELS[advisory.action] ?? {
            label: advisory.action,
            icon: MessageSquare,
            color: "text-muted-foreground",
          };
          const Icon = actionInfo.icon;

          return (
            <div
              key={advisory.id}
              className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("h-3.5 w-3.5", actionInfo.color)} />
                  <span className="text-xs text-muted-foreground">{actionInfo.label}</span>
                </div>
                <p className="mt-0.5 truncate text-sm text-foreground">
                  {details.summary ?? advisory.details}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(advisory.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 text-xs text-primary"
                onClick={() => handlePromote(advisory.id)}
                disabled={promoteMutation.isPending}
              >
                <ArrowUpRight className="mr-1 h-3 w-3" />
                {t("advisory_feed.promote")}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
