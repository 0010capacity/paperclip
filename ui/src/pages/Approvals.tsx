import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { PageTabBar } from "../components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { ApprovalCard } from "../components/ApprovalCard";
import { PageSkeleton } from "../components/PageSkeleton";

type StatusFilter = "pending" | "all";
type TypeFilter = "all" | "proposals" | "hiring" | "strategy";

const PROPOSAL_TYPES = [
  "propose_goal",
  "propose_project",
  "propose_strategy",
  "request_budget",
  "propose_process",
  "propose_hiring",
  "escalation",
];

export function Approvals() {
  const { t } = useTranslation("pages");
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const pathSegment = location.pathname.split("/").pop() ?? "pending";
  const statusFilter: StatusFilter = pathSegment === "all" ? "all" : "pending";
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: t("approvals.title") }]);
  }, [setBreadcrumbs, t]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: (_approval, id) => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      navigate(`/approvals/${id}?resolved=approved`);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reject");
    },
  });

  const filtered = (data ?? [])
    .filter(
      (a) => statusFilter === "all" || a.status === "pending" || a.status === "revision_requested",
    )
    .filter((a) => {
      if (typeFilter === "all") return true;
      if (typeFilter === "proposals") return PROPOSAL_TYPES.includes(a.type);
      if (typeFilter === "hiring") return a.type === "hire_agent";
      if (typeFilter === "strategy") return a.type === "approve_ceo_strategy";
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pendingCount = (data ?? []).filter(
    (a) => a.status === "pending" || a.status === "revision_requested",
  ).length;

  const pendingProposalCount = (data ?? []).filter(
    (a) => (a.status === "pending" || a.status === "revision_requested") && PROPOSAL_TYPES.includes(a.type),
  ).length;

  if (!selectedCompanyId) {
    return <p className="text-sm text-muted-foreground">Select a company first.</p>;
  }

  if (isLoading) {
    return <PageSkeleton variant="approvals" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => navigate(`/approvals/${v}`)}>
          <PageTabBar items={[
            { value: "pending", label: <>{t("approvals.pending")}{pendingCount > 0 && (
              <span className={cn(
                "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                "bg-yellow-500/20 text-yellow-500"
              )}>
                {pendingCount}
              </span>
            )}</> },
            { value: "all", label: t("approvals.all") },
          ]} />
        </Tabs>

        {/* Type filter tabs */}
        <div className="flex gap-1">
          {(["all", "proposals", "hiring", "strategy"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition",
                typeFilter === f
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {f === "all" && t("approvals.type.all")}
              {f === "proposals" && (
                <>
                  {t("approvals.type.proposals")}
                  {pendingProposalCount > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      {pendingProposalCount}
                    </Badge>
                  )}
                </>
              )}
              {f === "hiring" && t("approvals.type.hiring")}
              {f === "strategy" && t("approvals.type.strategy")}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {statusFilter === "pending" ? t("approvals.no_approvals.pending") : t("approvals.no_approvals.all")}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid gap-3">
          {filtered.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              requesterAgent={approval.requestedByAgentId ? (agents ?? []).find((a) => a.id === approval.requestedByAgentId) ?? null : null}
              onApprove={() => approveMutation.mutate(approval.id)}
              onReject={() => rejectMutation.mutate(approval.id)}
              detailLink={`/approvals/${approval.id}`}
              isPending={approveMutation.isPending || rejectMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
