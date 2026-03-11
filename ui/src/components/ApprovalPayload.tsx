import { UserPlus, Lightbulb, ShieldCheck, Target, DollarSign, Users, AlertTriangle, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const typeLabel: Record<string, string> = {
  hire_agent: "Hire Agent",
  approve_ceo_strategy: "CEO Strategy",
  propose_goal: "Goal Proposal",
  propose_project: "Project Proposal",
  propose_strategy: "Strategy Proposal",
  request_budget: "Budget Request",
  propose_process: "Process Proposal",
  propose_hiring: "Hiring Proposal",
  escalation: "Escalation",
};

export const typeIcon: Record<string, typeof UserPlus> = {
  hire_agent: UserPlus,
  approve_ceo_strategy: Lightbulb,
  propose_goal: Target,
  propose_project: GitBranch,
  propose_strategy: Lightbulb,
  request_budget: DollarSign,
  propose_process: GitBranch,
  propose_hiring: Users,
  escalation: AlertTriangle,
};

export const defaultTypeIcon = ShieldCheck;

// Proposal types (new in 2.0)
const PROPOSAL_TYPES = [
  "propose_goal",
  "propose_project",
  "propose_strategy",
  "request_budget",
  "propose_process",
  "propose_hiring",
  "escalation",
];

function PayloadField({ label, value }: { label: string; value: unknown }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">{label}</span>
      <span>{String(value)}</span>
    </div>
  );
}

export function HireAgentPayload({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">Name</span>
        <span className="font-medium">{String(payload.name ?? "—")}</span>
      </div>
      <PayloadField label="Role" value={payload.role} />
      <PayloadField label="Title" value={payload.title} />
      <PayloadField label="Icon" value={payload.icon} />
      {!!payload.capabilities && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs pt-0.5">Capabilities</span>
          <span className="text-muted-foreground">{String(payload.capabilities)}</span>
        </div>
      )}
      {!!payload.adapterType && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">Adapter</span>
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
            {String(payload.adapterType)}
          </span>
        </div>
      )}
    </div>
  );
}

export function CeoStrategyPayload({ payload }: { payload: Record<string, unknown> }) {
  const plan = payload.plan ?? payload.description ?? payload.strategy ?? payload.text;
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <PayloadField label="Title" value={payload.title} />
      {!!plan && (
        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto">
          {String(plan)}
        </div>
      )}
      {!plan && (
        <pre className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground overflow-x-auto max-h-48">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function ApprovalPayloadRenderer({ type, payload }: { type: string; payload: Record<string, unknown> }) {
  if (type === "hire_agent") return <HireAgentPayload payload={payload} />;
  if (PROPOSAL_TYPES.includes(type)) return <ProposalPayload type={type} payload={payload} />;
  return <CeoStrategyPayload payload={payload} />;
}

// Proposal payload renderer for 2.0 proposal types
function ProposalPayload({ type, payload }: { type: string; payload: Record<string, unknown> }) {
  const urgencyColor: Record<string, string> = {
    low: "text-muted-foreground bg-muted",
    medium: "text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30",
    high: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
  };

  const estimatedCost = payload.estimatedCost as Record<string, unknown> | undefined;
  const onApproveAction = payload.onApproveAction as { type?: string } | undefined;
  const fromMeetingContext = payload.fromMeetingContext as { meetingType?: string } | undefined;

  // Extract string fields with inline type narrowing
  const summary: string | null = typeof payload.summary === "string" && payload.summary.length > 0 ? payload.summary : null;
  const rationale: string | null = typeof payload.rationale === "string" && payload.rationale.length > 0 ? payload.rationale : null;
  const urgency: string | null = typeof payload.urgency === "string" && payload.urgency.length > 0 ? payload.urgency : null;
  const costJustification: string | null = typeof estimatedCost?.costJustification === "string" && estimatedCost.costJustification.length > 0 ? estimatedCost.costJustification : null;

  const hasStructuredFields = summary !== null || rationale !== null || estimatedCost !== undefined;

  return (
    <div className="mt-3 space-y-3">
      {/* Type and urgency badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{typeLabel[type] ?? type}</Badge>
        {urgency !== null && (
          <Badge className={urgencyColor[urgency] ?? ""}>
            {urgency === "high" ? "🔴 Urgent" : urgency === "medium" ? "🟡 Medium" : "🟢 Low"}
          </Badge>
        )}
        {fromMeetingContext !== null && fromMeetingContext !== undefined && typeof fromMeetingContext.meetingType === "string" && (
          <Badge variant="outline">
            📋 {fromMeetingContext.meetingType}
          </Badge>
        )}
      </div>

      {/* Summary */}
      {summary !== null && (
        <p className="text-sm font-medium text-foreground">{summary}</p>
      )}

      {/* Rationale */}
      {rationale !== null && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Rationale</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{rationale}</p>
        </div>
      )}

      {/* Cost estimate */}
      {estimatedCost !== null && estimatedCost !== undefined && (estimatedCost.monthlyCents || estimatedCost.oneTimeCents) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-400">💰 Cost Estimate</p>
          {typeof estimatedCost.monthlyCents === "number" && (
            <p className="text-sm text-amber-900 dark:text-amber-100">
              Monthly: ${(estimatedCost.monthlyCents / 100).toFixed(2)}
            </p>
          )}
          {typeof estimatedCost.oneTimeCents === "number" && (
            <p className="text-sm text-amber-900 dark:text-amber-100">
              One-time: ${(estimatedCost.oneTimeCents / 100).toFixed(2)}
            </p>
          )}
          {costJustification !== null && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {costJustification}
            </p>
          )}
        </div>
      )}

      {/* Auto-execute on approve preview */}
      {onApproveAction !== null && onApproveAction !== undefined && onApproveAction.type && onApproveAction.type !== "none" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-2 dark:border-green-800 dark:bg-green-950/30">
          <p className="text-xs text-green-700 dark:text-green-400">
            ✨ Auto-execute on approve: <span className="font-medium">{String(onApproveAction.type)}</span>
          </p>
        </div>
      )}

      {/* Fallback: show raw payload if no structured fields */}
      {!hasStructuredFields && (
        <pre className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground overflow-x-auto max-h-48">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
