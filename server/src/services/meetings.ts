import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { meetings, meetingParticipants, meetingMessages } from "@paperclipai/db";

export interface CreateMeetingInput {
  title: string;
  type: "sync" | "async";
  participantAgentIds: string[];
  scheduledAt?: string | null;
}

export interface ConcludeMeetingInput {
  summary?: string | null;
  actionItemIssueIds?: string[] | null;
}

export interface CreateMeetingMessageInput {
  content: string;
  contentType?: "text" | "action_request" | "action_result" | null;
  actionPayload?: Record<string, unknown> | null;
}

export function meetingService(db: Db) {
  return {
    list: async (companyId: string) => {
      return db
        .select()
        .from(meetings)
        .where(eq(meetings.companyId, companyId))
        .orderBy(desc(meetings.createdAt));
    },

    get: async (meetingId: string) => {
      const [meeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId))
        .limit(1);
      return meeting ?? null;
    },

    create: async (
      companyId: string,
      input: CreateMeetingInput,
      initiatedById: string | null,
    ) => {
      const [meeting] = await db
        .insert(meetings)
        .values({
          companyId,
          title: input.title,
          type: input.type,
          status: "in_progress",
          triggerType: initiatedById ? "agent_initiated" : "user_initiated",
          initiatedById: initiatedById ?? null,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          startedAt: new Date(),
        })
        .returning();

      // 참여자 등록
      if (input.participantAgentIds.length > 0) {
        await db.insert(meetingParticipants).values(
          input.participantAgentIds.map((agentId) => ({
            meetingId: meeting.id,
            agentId,
          })),
        );
      }

      return meeting;
    },

    conclude: async (meetingId: string, input: ConcludeMeetingInput) => {
      const [updated] = await db
        .update(meetings)
        .set({
          status: "concluded",
          concludedAt: new Date(),
          summary: input.summary ?? null,
          actionItemIssueIds: input.actionItemIssueIds ?? [],
          updatedAt: new Date(),
        })
        .where(eq(meetings.id, meetingId))
        .returning();
      return updated;
    },

    cancel: async (meetingId: string) => {
      const [updated] = await db
        .update(meetings)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(meetings.id, meetingId))
        .returning();
      return updated;
    },

    getParticipants: async (meetingId: string) => {
      return db
        .select()
        .from(meetingParticipants)
        .where(eq(meetingParticipants.meetingId, meetingId));
    },

    addParticipant: async (meetingId: string, agentId: string | null) => {
      const [participant] = await db
        .insert(meetingParticipants)
        .values({ meetingId, agentId: agentId ?? null })
        .onConflictDoNothing()
        .returning();
      return participant ?? null;
    },

    listMessages: async (meetingId: string) => {
      return db
        .select()
        .from(meetingMessages)
        .where(eq(meetingMessages.meetingId, meetingId))
        .orderBy(meetingMessages.createdAt);
    },

    addMessage: async (
      meetingId: string,
      senderAgentId: string | null,
      input: CreateMeetingMessageInput,
    ) => {
      const [message] = await db
        .insert(meetingMessages)
        .values({
          meetingId,
          senderAgentId: senderAgentId ?? null,
          content: input.content,
          contentType: input.contentType ?? "text",
          actionPayload: input.actionPayload
            ? JSON.stringify(input.actionPayload)
            : null,
          actionStatus: input.contentType === "action_request" ? "pending" : null,
        })
        .returning();
      return message;
    },

    resolveMessageAction: async (
      messageId: string,
      decision: "confirmed" | "rejected",
    ) => {
      const [updated] = await db
        .update(meetingMessages)
        .set({ actionStatus: decision })
        .where(eq(meetingMessages.id, messageId))
        .returning();
      return updated ?? null;
    },
  };
}
