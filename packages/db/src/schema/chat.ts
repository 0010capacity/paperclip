import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { meetings } from "./meetings.js";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),

    // "user" = 사용자(보드 오퍼레이터), "secretary" = 비서 에이전트
    senderType: text("sender_type", { enum: ["user", "secretary"] }).notNull(),
    senderId: text("sender_id"), // userId 또는 agentId

    content: text("content").notNull(),

    contentType: text("content_type", {
      enum: ["text", "action_request", "action_result", "meeting_event"],
    })
      .notNull()
      .default("text"),

    // 동기 회의와 연결된 채팅 메시지인 경우
    meetingId: uuid("meeting_id").references(() => meetings.id),

    // 비서가 사용자에게 확인을 요청할 때 포함하는 payload
    actionPayload: text("action_payload"), // JSON string

    actionStatus: text("action_status", {
      enum: ["pending", "confirmed", "rejected", "expired"],
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("chat_messages_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
    meetingIdx: index("chat_messages_meeting_idx").on(table.meetingId),
  }),
);
