import { eq, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { chatMessages } from "@paperclipai/db";

export interface SendChatMessageInput {
  content: string;
}

export function chatService(db: Db) {
  return {
    list: async (companyId: string, limit = 50, before?: string) => {
      // before가 있으면 해당 메시지 이전 것만 반환 (페이지네이션)
      // TODO: Add cursor-based pagination with 'before' parameter
      return db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.companyId, companyId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit);
    },

    send: async (
      companyId: string,
      senderType: "user" | "secretary",
      senderId: string | null,
      input: SendChatMessageInput,
      options?: {
        contentType?: "text" | "action_request" | "action_result" | "meeting_event";
        meetingId?: string;
        actionPayload?: Record<string, unknown>;
      },
    ) => {
      const [message] = await db
        .insert(chatMessages)
        .values({
          companyId,
          senderType,
          senderId: senderId ?? null,
          content: input.content,
          contentType: options?.contentType ?? "text",
          meetingId: options?.meetingId ?? null,
          actionPayload: options?.actionPayload
            ? JSON.stringify(options.actionPayload)
            : null,
          actionStatus:
            options?.contentType === "action_request" ? "pending" : null,
        })
        .returning();
      return message;
    },

    resolveAction: async (messageId: string, decision: "confirmed" | "rejected") => {
      const [updated] = await db
        .update(chatMessages)
        .set({ actionStatus: decision })
        .where(eq(chatMessages.id, messageId))
        .returning();
      return updated ?? null;
    },

    getById: async (messageId: string) => {
      const [message] = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.id, messageId))
        .limit(1);
      return message ?? null;
    },
  };
}
