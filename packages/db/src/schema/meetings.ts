import {
  type AnyPgColumn,
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    title: text("title").notNull(),

    // "sync" = 사용자 주도 실시간 회의, "async" = 에이전트 자율 비동기 회의
    type: text("type", { enum: ["sync", "async"] }).notNull(),

    status: text("status", {
      enum: ["scheduled", "in_progress", "concluded", "cancelled"],
    })
      .notNull()
      .default("scheduled"),

    // 어떻게 시작됐는가
    triggerType: text("trigger_type", {
      enum: ["user_initiated", "agent_initiated", "scheduled"],
    }).notNull(),

    // null이면 사용자가 직접 시작한 것
    initiatedById: uuid("initiated_by_id").references((): AnyPgColumn => agents.id),

    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    concludedAt: timestamp("concluded_at", { withTimezone: true }),

    // 회의 종료 후 CEO/비서가 작성하는 요약
    summary: text("summary"),

    // 회의 결과로 생성된 이슈 IDs (UUID 배열)
    actionItemIssueIds: uuid("action_item_issue_ids").array().notNull().default([]),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("meetings_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
  }),
);

export const meetingParticipants = pgTable(
  "meeting_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),

    // null이면 사용자(보드 오퍼레이터)
    agentId: uuid("agent_id").references((): AnyPgColumn => agents.id),

    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // 같은 회의에 같은 에이전트가 중복 참여 방지
    // agentId가 null인 경우(사용자)는 회의당 1명만 허용
    meetingAgentUniqueIdx: uniqueIndex("meeting_participants_meeting_agent_unique").on(
      table.meetingId,
      table.agentId,
    ),
  }),
);

export const meetingMessages = pgTable(
  "meeting_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),

    // null이면 사용자가 직접 작성
    senderAgentId: uuid("sender_agent_id").references((): AnyPgColumn => agents.id),

    content: text("content").notNull(),

    contentType: text("content_type", {
      enum: ["text", "action_request", "action_result"],
    })
      .notNull()
      .default("text"),

    // 비서가 인라인 액션을 요청할 때 사용하는 구조화된 payload
    actionPayload: text("action_payload"), // JSON string

    actionStatus: text("action_status", {
      enum: ["pending", "confirmed", "rejected", "expired"],
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    meetingCreatedIdx: index("meeting_messages_meeting_created_idx").on(
      table.meetingId,
      table.createdAt,
    ),
  }),
);
