import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { approvalComments, approvals, goals, projects, activityLog } from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";
import { agentService } from "./agents.js";
import { notifyHireApproved } from "./hire-hook.js";
import { goalService } from "./goals.js";
import { projectService } from "./projects.js";

// Rate limit constants for proposals
export const PROPOSAL_RATE_LIMITS = {
  maxPendingProposalsPerAgent: 5,
  maxPendingProposalsPerCompany: 20,
} as const;

export type ApprovalResolutionResult = {
  approval: typeof approvals.$inferSelect;
  /** True if the state transitioned from pending/revision_requested to the terminal state. */
  stateChanged: boolean;
  /** For hire_agent approvals, the agent ID that was created or activated. */
  hireApprovedAgentId?: string | null;
  /** Result of automatic on-approve action execution */
  autoActionResult?: { resultEntityType?: string; resultEntityId?: string };
};

/**
 * Execute automatic actions when an approval is approved.
 * This is called after the approval status is set to "approved".
 */
async function executeOnApproveAction(
  db: Db,
  approval: typeof approvals.$inferSelect,
): Promise<{ resultEntityType?: string; resultEntityId?: string }> {
  const payload = approval.payload as Record<string, unknown> | null;
  if (!payload) return {};

  const action = (payload as { onApproveAction?: Record<string, unknown> }).onApproveAction;
  if (!action || action.type === "none") return {};

  try {
    switch (action.type) {
      case "create_goal": {
        const goalData = action.goal as {
          title: string;
          level: string;
          description?: string;
          parentId?: string;
        } | undefined;
        if (!goalData) return {};

        const goal = await goalService(db).create(approval.companyId, {
          title: goalData.title,
          level: goalData.level as "company" | "team" | "agent" | "task",
          description: goalData.description ?? null,
          parentId: goalData.parentId ?? null,
          ownerAgentId: approval.requestedByAgentId ?? null,
          status: "planned",
        });
        return { resultEntityType: "goal", resultEntityId: goal.id };
      }

      case "create_project": {
        const projectData = action.project as {
          title: string;
          description?: string;
          goalId?: string;
        } | undefined;
        if (!projectData) return {};

        const project = await projectService(db).create(approval.companyId, {
          name: projectData.title,
          description: projectData.description ?? null,
          goalId: projectData.goalId ?? null,
        });
        return { resultEntityType: "project", resultEntityId: project.id };
      }

      case "update_budget": {
        const budgetData = action as {
          agentId?: string;
          newBudgetMonthlyCents?: number;
        };
        if (!budgetData.agentId || typeof budgetData.newBudgetMonthlyCents !== "number") return {};

        await agentService(db).update(budgetData.agentId, {
          budgetMonthlyCents: budgetData.newBudgetMonthlyCents,
        });
        return { resultEntityType: "agent", resultEntityId: budgetData.agentId };
      }

      case "create_hire_approval": {
        // 2단계 승인: propose_hiring 승인 → hire_agent 결재 자동 생성
        const hirePayload = action.hirePayload as Record<string, unknown> | undefined;
        if (!hirePayload) return {};

        const [hire] = await db
          .insert(approvals)
          .values({
            companyId: approval.companyId,
            type: "hire_agent",
            requestedByAgentId: approval.requestedByAgentId ?? null,
            payload: hirePayload,
            status: "pending",
          })
          .returning();
        return { resultEntityType: "approval", resultEntityId: hire.id };
      }

      default:
        return {};
    }
  } catch (error) {
    // Log error but don't throw - approval state should remain approved
    console.error("executeOnApproveAction failed:", error);
    return {};
  }
}

/**
 * Check if an agent can create a new proposal based on rate limits.
 */
export async function checkProposalRateLimit(
  db: Db,
  companyId: string,
  agentId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  // 에이전트의 미결 proposal 수
  const agentPending = await db
    .select({ count: sql<number>`count(*)` })
    .from(approvals)
    .where(
      and(eq(approvals.requestedByAgentId, agentId), eq(approvals.status, "pending")),
    );

  if ((agentPending[0]?.count ?? 0) >= PROPOSAL_RATE_LIMITS.maxPendingProposalsPerAgent) {
    return {
      allowed: false,
      reason: `미결 제안이 ${PROPOSAL_RATE_LIMITS.maxPendingProposalsPerAgent}개를 초과했습니다.`,
    };
  }

  // 회사 전체 미결 proposal 수
  const companyPending = await db
    .select({ count: sql<number>`count(*)` })
    .from(approvals)
    .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")));

  if ((companyPending[0]?.count ?? 0) >= PROPOSAL_RATE_LIMITS.maxPendingProposalsPerCompany) {
    return {
      allowed: false,
      reason: "회사 전체 미결 제안 한도에 도달했습니다.",
    };
  }

  return { allowed: true };
}

/**
 * Log an activity to activity_log table.
 */
async function logActivity(
  db: Db,
  input: {
    companyId: string;
    action: string;
    details: Record<string, unknown>;
    actorType?: string;
    actorId?: string;
    entityType?: string;
    entityId?: string;
  },
) {
  try {
    await db.insert(activityLog).values({
      companyId: input.companyId,
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? "system",
      action: input.action,
      entityType: input.entityType ?? "approval",
      entityId: input.entityId ?? "",
      details: input.details,
    });
  } catch (error) {
    // Log error but don't throw
    console.error("logActivity failed:", error);
  }
}

export function approvalService(db: Db) {
  const agentsSvc = agentService(db);
  const canResolveStatuses = new Set(["pending", "revision_requested"]);

  async function getExistingApproval(id: string) {
    const existing = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, id))
      .then((rows) => rows[0] ?? null);
    if (!existing) throw notFound("Approval not found");
    return existing;
  }

  return {
    list: (companyId: string, status?: string) => {
      const conditions = [eq(approvals.companyId, companyId)];
      if (status) conditions.push(eq(approvals.status, status));
      return db.select().from(approvals).where(and(...conditions));
    },

    getById: (id: string) =>
      db
        .select()
        .from(approvals)
        .where(eq(approvals.id, id))
        .then((rows) => rows[0] ?? null),

    create: (companyId: string, data: Omit<typeof approvals.$inferInsert, "companyId">) =>
      db
        .insert(approvals)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    approve: async (id: string, decidedByUserId: string, decisionNote?: string | null): Promise<ApprovalResolutionResult> => {
      const existing = await getExistingApproval(id);

      // Idempotent: if already approved with same decision, return without side effects
      if (existing.status === "approved") {
        return { approval: existing, stateChanged: false, hireApprovedAgentId: null };
      }

      if (!canResolveStatuses.has(existing.status)) {
        throw unprocessable("Only pending or revision requested approvals can be approved");
      }

      const now = new Date();
      const updated = await db
        .update(approvals)
        .set({
          status: "approved",
          decidedByUserId,
          decisionNote: decisionNote ?? null,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(approvals.id, id))
        .returning()
        .then((rows) => rows[0]);

      let hireApprovedAgentId: string | null = null;
      if (updated.type === "hire_agent") {
        const payload = updated.payload as Record<string, unknown>;
        const payloadAgentId = typeof payload.agentId === "string" ? payload.agentId : null;
        if (payloadAgentId) {
          await agentsSvc.activatePendingApproval(payloadAgentId);
          hireApprovedAgentId = payloadAgentId;
        } else {
          const created = await agentsSvc.create(updated.companyId, {
            name: String(payload.name ?? "New Agent"),
            role: String(payload.role ?? "general"),
            title: typeof payload.title === "string" ? payload.title : null,
            reportsTo: typeof payload.reportsTo === "string" ? payload.reportsTo : null,
            capabilities: typeof payload.capabilities === "string" ? payload.capabilities : null,
            adapterType: String(payload.adapterType ?? "process"),
            adapterConfig:
              typeof payload.adapterConfig === "object" && payload.adapterConfig !== null
                ? (payload.adapterConfig as Record<string, unknown>)
                : {},
            budgetMonthlyCents:
              typeof payload.budgetMonthlyCents === "number" ? payload.budgetMonthlyCents : 0,
            metadata:
              typeof payload.metadata === "object" && payload.metadata !== null
                ? (payload.metadata as Record<string, unknown>)
                : null,
            status: "idle",
            spentMonthlyCents: 0,
            permissions: undefined,
            lastHeartbeatAt: null,
          });
          hireApprovedAgentId = created?.id ?? null;
        }
        if (hireApprovedAgentId) {
          void notifyHireApproved(db, {
            companyId: updated.companyId,
            agentId: hireApprovedAgentId,
            source: "approval",
            sourceId: id,
            approvedAt: now,
          }).catch(() => {});
        }
      }

      // Execute automatic on-approve action if defined
      const autoActionResult = await executeOnApproveAction(db, updated);
      if (autoActionResult.resultEntityType) {
        // Log the auto-execution result
        await logActivity(db, {
          companyId: updated.companyId,
          action: "approval.auto_executed",
          details: autoActionResult,
          entityType: "approval",
          entityId: updated.id,
        });
      }

      return { approval: updated, stateChanged: true, hireApprovedAgentId, autoActionResult };
    },

    reject: async (id: string, decidedByUserId: string, decisionNote?: string | null): Promise<ApprovalResolutionResult> => {
      const existing = await getExistingApproval(id);

      // Idempotent: if already rejected, return without side effects
      if (existing.status === "rejected") {
        return { approval: existing, stateChanged: false };
      }

      if (!canResolveStatuses.has(existing.status)) {
        throw unprocessable("Only pending or revision requested approvals can be rejected");
      }

      const now = new Date();
      const updated = await db
        .update(approvals)
        .set({
          status: "rejected",
          decidedByUserId,
          decisionNote: decisionNote ?? null,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(approvals.id, id))
        .returning()
        .then((rows) => rows[0]);

      if (updated.type === "hire_agent") {
        const payload = updated.payload as Record<string, unknown>;
        const payloadAgentId = typeof payload.agentId === "string" ? payload.agentId : null;
        if (payloadAgentId) {
          await agentsSvc.terminate(payloadAgentId);
        }
      }

      return { approval: updated, stateChanged: true };
    },

    requestRevision: async (id: string, decidedByUserId: string, decisionNote?: string | null) => {
      const existing = await getExistingApproval(id);
      if (existing.status !== "pending") {
        throw unprocessable("Only pending approvals can request revision");
      }

      const now = new Date();
      return db
        .update(approvals)
        .set({
          status: "revision_requested",
          decidedByUserId,
          decisionNote: decisionNote ?? null,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(approvals.id, id))
        .returning()
        .then((rows) => rows[0]);
    },

    resubmit: async (id: string, payload?: Record<string, unknown>) => {
      const existing = await getExistingApproval(id);
      if (existing.status !== "revision_requested") {
        throw unprocessable("Only revision requested approvals can be resubmitted");
      }

      const now = new Date();
      return db
        .update(approvals)
        .set({
          status: "pending",
          payload: payload ?? existing.payload,
          decisionNote: null,
          decidedByUserId: null,
          decidedAt: null,
          updatedAt: now,
        })
        .where(eq(approvals.id, id))
        .returning()
        .then((rows) => rows[0]);
    },

    listComments: async (approvalId: string) => {
      const existing = await getExistingApproval(approvalId);
      return db
        .select()
        .from(approvalComments)
        .where(
          and(
            eq(approvalComments.approvalId, approvalId),
            eq(approvalComments.companyId, existing.companyId),
          ),
        )
        .orderBy(asc(approvalComments.createdAt));
    },

    addComment: async (
      approvalId: string,
      body: string,
      actor: { agentId?: string; userId?: string },
    ) => {
      const existing = await getExistingApproval(approvalId);
      return db
        .insert(approvalComments)
        .values({
          companyId: existing.companyId,
          approvalId,
          authorAgentId: actor.agentId ?? null,
          authorUserId: actor.userId ?? null,
          body,
        })
        .returning()
        .then((rows) => rows[0]);
    },
  };
}
