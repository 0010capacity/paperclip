import { and, eq, like, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { activityLog } from "@paperclipai/db";
import { ADVISORY_ACTIONS, type AdvisoryAction } from "@paperclipai/shared";

export interface CreateAdvisoryInput {
  summary: string;
  linkedIssueIds?: string[] | null;
  linkedGoalIds?: string[] | null;
}

export function advisoryService(db: Db) {
  return {
    list: async (companyId: string) => {
      return db
        .select()
        .from(activityLog)
        .where(
          and(
            eq(activityLog.companyId, companyId),
            // ADVISORY_ACTIONS 중 하나로 시작하는 것만 필터
            like(activityLog.action, "agent.advisory.%"),
          ),
        )
        .orderBy(desc(activityLog.createdAt))
        .limit(100);
    },

    create: async (
      companyId: string,
      agentId: string,
      action: AdvisoryAction,
      details: CreateAdvisoryInput,
    ) => {
      const [entry] = await db
        .insert(activityLog)
        .values({
          companyId,
          actorType: "agent",
          actorId: agentId,
          agentId,
          action,
          entityType: "advisory",
          entityId: agentId, // Using agentId as entityId for advisory entries
          details: {
            summary: details.summary,
            linkedIssueIds: details.linkedIssueIds ?? [],
            linkedGoalIds: details.linkedGoalIds ?? [],
          },
        })
        .returning();
      return entry;
    },

    getById: async (advisoryId: string) => {
      const [entry] = await db
        .select()
        .from(activityLog)
        .where(eq(activityLog.id, advisoryId))
        .limit(1);
      return entry ?? null;
    },
  };
}
