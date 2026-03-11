# Agent 1 작업 계획서 — DB / Backend

> **이 계획서는 병렬 작업 중 Agent 1이 담당하는 범위를 정의한다.**
> Agent 3(Shared Contracts)이 먼저 완료되면 여기서 정의한 타입·상수를 import해서 사용한다.
> Agent 2(Frontend)는 여기서 만든 API 엔드포인트를 호출한다.

---

## 역할 요약

| 항목 | 내용 |
|------|------|
| **담당 범위** | `packages/db/`, `server/src/` |
| **핵심 산출물** | DB 스키마 마이그레이션, 서버 라우트/서비스, WebSocket 이벤트, 하트비트 wake reason 연동 |
| **선행 조건** | Agent 3의 `packages/shared` 빌드가 완료된 후 import 가능. 단, 스키마 작성과 서비스 골격은 먼저 진행 가능 |
| **건드리지 않는 것** | `ui/`, `packages/shared/` (읽기만 가능), 기존 V1 라우트 동작 |

---

## 읽어야 할 문서

작업 시작 전 반드시 읽을 것:

1. `doc/AGENTS.md` — 전체 기여 규칙
2. `doc/SPEC-implementation.md` — V1 데이터 모델과 컨트랙트
3. `doc/DATABASE.md` — DB 운영 규칙, 마이그레이션 절차
4. `doc/DEVELOPING.md` — 로컬 dev 환경 설정
5. `doc/COWORKER-AUTONOMY.md` — 섹션 8(채팅 시스템), 9(Proposal), 10(Advisory), 14(DB 총정리), 15(API 총정리)
6. `doc/AUTONOMOUS-COMPANY-ROADMAP.md` — Phase 1(회의 엔티티·API), Phase 2(ApprovalMatrix)

---

## 현재 상태 파악

작업 전 아래 파일들의 현재 내용을 반드시 읽어 파악한다:

```
packages/db/src/schema/                    ← 기존 테이블 스키마
packages/db/src/schema/index.ts            ← 기존 export 목록
packages/db/drizzle.config.ts              ← 마이그레이션 설정
server/src/routes/                         ← 기존 라우트 목록
server/src/services/                       ← 기존 서비스 목록
server/src/services/approvals.ts           ← 기존 approval 서비스 (확장 대상)
server/src/services/agent-permissions.ts   ← 기존 권한 서비스 (Agent 3이 확장)
server/src/lib/live-events.ts              ← 기존 WebSocket 이벤트 브로드캐스트
```

---

## 데이터베이스 변경 워크플로

**중요:** 스키마를 변경할 때는 반드시 아래 순서를 따른다.

```sh
# 1. packages/db/src/schema/*.ts 파일 편집

# 2. schema/index.ts에서 새 테이블 export 확인

# 3. 마이그레이션 생성 (packages/db를 먼저 컴파일)
pnpm db:generate

# 4. 타입 검사
pnpm -r typecheck
```

`packages/db/drizzle.config.ts`는 컴파일된 `dist/schema/*.js`를 읽으므로,
`pnpm db:generate`가 내부적으로 컴파일을 먼저 실행한다.

---

## 작업 목록

---

### Task 1 — DB 스키마: `meetings` 테이블

**파일:** `packages/db/src/schema/meetings.ts` (신규)

```typescript
import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { agents } from "./agents";

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  title: text("title").notNull(),

  // "sync" = 사용자 주도 실시간 회의, "async" = 에이전트 자율 비동기 회의
  type: text("type", { enum: ["sync", "async"] }).notNull(),

  status: text("status", {
    enum: ["scheduled", "in_progress", "concluded", "cancelled"],
  }).notNull().default("scheduled"),

  // 어떻게 시작됐는가
  triggerType: text("trigger_type", {
    enum: ["user_initiated", "agent_initiated", "scheduled"],
  }).notNull(),

  // null이면 사용자가 직접 시작한 것
  initiatedById: uuid("initiated_by_id").references(() => agents.id),

  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  concludedAt: timestamp("concluded_at", { withTimezone: true }),

  // 회의 종료 후 CEO/비서가 작성하는 요약
  summary: text("summary"),

  // 회의 결과로 생성된 이슈 IDs (UUID 배열)
  actionItemIssueIds: uuid("action_item_issue_ids").array().notNull().default([]),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

### Task 2 — DB 스키마: `meeting_participants` 테이블

**파일:** `packages/db/src/schema/meetings.ts` (위 파일에 이어서)

```typescript
export const meetingParticipants = pgTable("meeting_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),

  // null이면 사용자(보드 오퍼레이터)
  agentId: uuid("agent_id").references(() => agents.id),

  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**인덱스 (같은 파일에 추가):**

```typescript
import { uniqueIndex, index } from "drizzle-orm/pg-core";

// 같은 회의에 같은 에이전트가 중복 참여 방지
// agentId가 null인 경우(사용자)는 회의당 1명만 허용
export const meetingParticipantsUniqueIdx = uniqueIndex(
  "meeting_participants_meeting_agent_unique"
).on(meetingParticipants.meetingId, meetingParticipants.agentId);
```

---

### Task 3 — DB 스키마: `meeting_messages` 테이블

**파일:** `packages/db/src/schema/meetings.ts` (위 파일에 이어서)

```typescript
export const meetingMessages = pgTable("meeting_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),

  // null이면 사용자가 직접 작성
  senderAgentId: uuid("sender_agent_id").references(() => agents.id),

  content: text("content").notNull(),

  contentType: text("content_type", {
    enum: ["text", "action_request", "action_result"],
  }).notNull().default("text"),

  // 비서가 인라인 액션을 요청할 때 사용하는 구조화된 payload
  actionPayload: text("action_payload"),   // JSON string (JSONB는 drizzle json() 사용)

  actionStatus: text("action_status", {
    enum: ["pending", "confirmed", "rejected", "expired"],
  }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

`actionPayload`는 Drizzle의 `json()` 또는 `jsonb()` 컬럼으로 선언해도 무방하다.
프로젝트의 기존 JSONB 컬럼 선언 방식을 따른다 (`approvals.payload` 참고).

---

### Task 4 — DB 스키마: `chat_messages` 테이블

**파일:** `packages/db/src/schema/chat.ts` (신규)

```typescript
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { meetings } from "./meetings";

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),

  // "user" = 사용자(보드 오퍼레이터), "secretary" = 비서 에이전트
  senderType: text("sender_type", { enum: ["user", "secretary"] }).notNull(),
  senderId: text("sender_id"),   // userId 또는 agentId

  content: text("content").notNull(),

  contentType: text("content_type", {
    enum: ["text", "action_request", "action_result", "meeting_event"],
  }).notNull().default("text"),

  // 동기 회의와 연결된 채팅 메시지인 경우
  meetingId: uuid("meeting_id").references(() => meetings.id),

  // 비서가 사용자에게 확인을 요청할 때 포함하는 payload
  actionPayload: text("action_payload"),   // JSON string

  actionStatus: text("action_status", {
    enum: ["pending", "confirmed", "rejected", "expired"],
  }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

### Task 5 — DB 스키마 index.ts 업데이트

**파일:** `packages/db/src/schema/index.ts`

새로 만든 테이블들을 export에 추가한다:

```typescript
// 기존 export는 유지하고 아래를 추가
export * from "./meetings";   // meetings, meetingParticipants, meetingMessages
export * from "./chat";       // chatMessages
```

---

### Task 6 — 마이그레이션 생성

스키마 파일 작성 완료 후:

```sh
pnpm db:generate
pnpm -r typecheck
```

생성된 마이그레이션 파일(`packages/db/drizzle/migrations/`)을 커밋한다.
마이그레이션 파일을 수동으로 편집하지 않는다.

---

### Task 7 — 회의 서비스 구현

**파일:** `server/src/services/meetings.ts` (신규)

```typescript
import type { Db } from "../db";
import { meetings, meetingParticipants, meetingMessages } from "@paperclip/db";
import { eq, and, desc } from "drizzle-orm";
import type {
  CreateMeetingInput,
  ConcludeMeetingInput,
  CreateMeetingMessageInput,
} from "@paperclip/shared";

export function meetingService(db: Db) {
  return {
    async list(companyId: string) {
      return db
        .select()
        .from(meetings)
        .where(eq(meetings.companyId, companyId))
        .orderBy(desc(meetings.createdAt));
    },

    async get(meetingId: string) {
      const [meeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId))
        .limit(1);
      return meeting ?? null;
    },

    async create(companyId: string, input: CreateMeetingInput, initiatedById: string | null) {
      const [meeting] = await db
        .insert(meetings)
        .values({
          companyId,
          title: input.title,
          type: input.type,
          status: "in_progress",
          triggerType: initiatedById ? "agent_initiated" : "user_initiated",
          initiatedById: initiatedById ?? undefined,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
          startedAt: new Date(),
        })
        .returning();

      // 참여자 등록
      if (input.participantAgentIds.length > 0) {
        await db.insert(meetingParticipants).values(
          input.participantAgentIds.map((agentId) => ({
            meetingId: meeting.id,
            agentId,
          }))
        );
      }

      return meeting;
    },

    async conclude(meetingId: string, input: ConcludeMeetingInput) {
      const [updated] = await db
        .update(meetings)
        .set({
          status: "concluded",
          concludedAt: new Date(),
          summary: input.summary,
          actionItemIssueIds: input.actionItemIssueIds ?? [],
          updatedAt: new Date(),
        })
        .where(eq(meetings.id, meetingId))
        .returning();
      return updated;
    },

    async cancel(meetingId: string) {
      const [updated] = await db
        .update(meetings)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(meetings.id, meetingId))
        .returning();
      return updated;
    },

    async getParticipants(meetingId: string) {
      return db
        .select()
        .from(meetingParticipants)
        .where(eq(meetingParticipants.meetingId, meetingId));
    },

    async addParticipant(meetingId: string, agentId: string | null) {
      const [participant] = await db
        .insert(meetingParticipants)
        .values({ meetingId, agentId: agentId ?? undefined })
        .onConflictDoNothing()
        .returning();
      return participant;
    },

    async listMessages(meetingId: string) {
      return db
        .select()
        .from(meetingMessages)
        .where(eq(meetingMessages.meetingId, meetingId))
        .orderBy(meetingMessages.createdAt);
    },

    async addMessage(
      meetingId: string,
      senderAgentId: string | null,
      input: CreateMeetingMessageInput
    ) {
      const [message] = await db
        .insert(meetingMessages)
        .values({
          meetingId,
          senderAgentId: senderAgentId ?? undefined,
          content: input.content,
          contentType: input.contentType ?? "text",
          actionPayload: input.actionPayload
            ? JSON.stringify(input.actionPayload)
            : undefined,
          actionStatus: input.contentType === "action_request" ? "pending" : undefined,
        })
        .returning();
      return message;
    },

    async resolveMessageAction(
      messageId: string,
      decision: "confirmed" | "rejected"
    ) {
      const [updated] = await db
        .update(meetingMessages)
        .set({ actionStatus: decision })
        .where(eq(meetingMessages.id, messageId))
        .returning();
      return updated;
    },
  };
}
```

---

### Task 8 — 채팅 서비스 구현

**파일:** `server/src/services/chat.ts` (신규)

```typescript
import type { Db } from "../db";
import { chatMessages } from "@paperclip/db";
import { eq, desc } from "drizzle-orm";
import type { SendChatMessageInput } from "@paperclip/shared";

export function chatService(db: Db) {
  return {
    async list(companyId: string, limit = 50, before?: string) {
      // before가 있으면 해당 메시지 이전 것만 반환 (페이지네이션)
      return db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.companyId, companyId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit);
    },

    async send(
      companyId: string,
      senderType: "user" | "secretary",
      senderId: string | null,
      input: SendChatMessageInput,
      options?: {
        contentType?: "text" | "action_request" | "action_result" | "meeting_event";
        meetingId?: string;
        actionPayload?: Record<string, unknown>;
      }
    ) {
      const [message] = await db
        .insert(chatMessages)
        .values({
          companyId,
          senderType,
          senderId: senderId ?? undefined,
          content: input.content,
          contentType: options?.contentType ?? "text",
          meetingId: options?.meetingId ?? undefined,
          actionPayload: options?.actionPayload
            ? JSON.stringify(options.actionPayload)
            : undefined,
          actionStatus:
            options?.contentType === "action_request" ? "pending" : undefined,
        })
        .returning();
      return message;
    },

    async resolveAction(messageId: string, decision: "confirmed" | "rejected") {
      const [updated] = await db
        .update(chatMessages)
        .set({ actionStatus: decision })
        .where(eq(chatMessages.id, messageId))
        .returning();
      return updated;
    },
  };
}
```

---

### Task 9 — Advisory 서비스 구현

**파일:** `server/src/services/advisory.ts` (신규)

Advisory는 별도 테이블 없이 기존 `activity_log`를 사용한다.
`ADVISORY_ACTIONS` 상수는 Agent 3이 `packages/shared`에 정의한다.

```typescript
import type { Db } from "../db";
import { activityLog } from "@paperclip/db";
import { eq, and, like, desc } from "drizzle-orm";
import { ADVISORY_ACTIONS } from "@paperclip/shared";

export function advisoryService(db: Db) {
  return {
    async list(companyId: string) {
      return db
        .select()
        .from(activityLog)
        .where(
          and(
            eq(activityLog.companyId, companyId),
            // ADVISORY_ACTIONS 중 하나로 시작하는 것만 필터
            like(activityLog.action, "agent.advisory.%")
          )
        )
        .orderBy(desc(activityLog.createdAt))
        .limit(100);
    },

    async create(
      companyId: string,
      agentId: string,
      action: (typeof ADVISORY_ACTIONS)[number],
      details: {
        summary: string;
        linkedIssueIds?: string[];
        linkedGoalIds?: string[];
      }
    ) {
      const [entry] = await db
        .insert(activityLog)
        .values({
          companyId,
          actorType: "agent",
          actorId: agentId,
          action,
          details: JSON.stringify(details),
        })
        .returning();
      return entry;
    },
  };
}
```

---

### Task 10 — Approval 서비스 확장: `executeOnApproveAction`

**파일:** `server/src/services/approvals.ts` (기존 파일 수정)

기존 `approve()` 메서드 내부에 `executeOnApproveAction` 호출을 추가한다.
기존 로직을 변경하지 않고, 승인 처리 완료 후 자동 실행 블록만 추가한다.

```typescript
// approvals.ts 의 approve 핸들러 내부에 추가할 헬퍼 함수

async function executeOnApproveAction(
  db: Db,
  approval: typeof approvals.$inferSelect
): Promise<{ resultEntityType?: string; resultEntityId?: string }> {
  const payload = approval.payload as Record<string, unknown> | null;
  if (!payload) return {};

  const action = (payload as { onApproveAction?: Record<string, unknown> })
    .onApproveAction;
  if (!action || action.type === "none") return {};

  switch (action.type) {
    case "create_goal": {
      // goalService를 통해 목표 생성
      const goalData = action.goal as {
        title: string;
        level: string;
        description?: string;
        parentId?: string;
      };
      const goal = await goalService(db).create(approval.companyId, {
        title: goalData.title,
        level: goalData.level,
        description: goalData.description,
        parentId: goalData.parentId,
        ownerAgentId: approval.requestedByAgentId ?? undefined,
      });
      return { resultEntityType: "goal", resultEntityId: goal.id };
    }

    case "create_project": {
      const projectData = action.project as {
        title: string;
        description?: string;
        goalId?: string;
      };
      const project = await projectService(db).create(approval.companyId, {
        title: projectData.title,
        description: projectData.description,
        goalId: projectData.goalId,
      });
      return { resultEntityType: "project", resultEntityId: project.id };
    }

    case "update_budget": {
      const budgetData = action as {
        agentId: string;
        newBudgetMonthlyCents: number;
      };
      await agentService(db).update(budgetData.agentId, {
        budgetMonthlyCents: budgetData.newBudgetMonthlyCents,
      });
      return { resultEntityType: "agent", resultEntityId: budgetData.agentId };
    }

    case "create_hire_approval": {
      // 2단계 승인: propose_hiring 승인 → hire_agent 결재 자동 생성
      const hire = await db
        .insert(approvals)
        .values({
          companyId: approval.companyId,
          type: "hire_agent",
          requestedByAgentId: approval.requestedByAgentId,
          payload: action.hirePayload as Record<string, unknown>,
          status: "pending",
        })
        .returning();
      return { resultEntityType: "approval", resultEntityId: hire[0].id };
    }

    default:
      return {};
  }
}
```

기존 `approve()` 함수 내에서 승인 상태를 `"approved"`로 변경한 직후에 호출한다:

```typescript
// 기존 approve 로직 완료 후 추가
const autoResult = await executeOnApproveAction(db, updatedApproval);
if (autoResult.resultEntityType) {
  // activity_log에 자동 실행 결과 기록
  await logActivity(db, {
    companyId: updatedApproval.companyId,
    action: "approval.auto_executed",
    details: JSON.stringify(autoResult),
  });
}
```

**중요:** 자동 실행이 실패해도 승인 상태는 `"approved"`로 유지한다.
실패는 `activity_log`에 에러로 기록하고 throw하지 않는다.

---

### Task 11 — Rate Limit 체크 구현

**파일:** `server/src/services/approvals.ts` (기존 파일 수정)

Proposal 생성 전에 Rate Limit을 검사하는 헬퍼를 추가한다.
`PROPOSAL_RATE_LIMITS` 상수는 Agent 3이 `packages/shared`에 정의한다.

```typescript
import { PROPOSAL_RATE_LIMITS } from "@paperclip/shared";

async function checkProposalRateLimit(
  db: Db,
  companyId: string,
  agentId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // 에이전트의 미결 proposal 수
  const pendingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(approvals)
    .where(
      and(
        eq(approvals.requestedByAgentId, agentId),
        eq(approvals.status, "pending")
      )
    );

  if (
    (pendingCount[0]?.count ?? 0) >=
    PROPOSAL_RATE_LIMITS.maxPendingProposalsPerAgent
  ) {
    return {
      allowed: false,
      reason: `미결 제안이 ${PROPOSAL_RATE_LIMITS.maxPendingProposalsPerAgent}개를 초과했습니다.`,
    };
  }

  // 회사 전체 미결 proposal 수
  const companyPendingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(approvals)
    .where(
      and(eq(approvals.companyId, companyId), eq(approvals.status, "pending"))
    );

  if (
    (companyPendingCount[0]?.count ?? 0) >=
    PROPOSAL_RATE_LIMITS.maxPendingProposalsPerCompany
  ) {
    return {
      allowed: false,
      reason: "회사 전체 미결 제안 한도에 도달했습니다.",
    };
  }

  return { allowed: true };
}
```

---

### Task 12 — 회의 라우트 구현

**파일:** `server/src/routes/meetings.ts` (신규)

```typescript
import { Router } from "express";
import { meetingService } from "../services/meetings";
import { broadcastToCompany } from "../lib/live-events";
import { wakeupAgent } from "../services/heartbeat";
import {
  CreateMeetingSchema,
  ConcludeMeetingSchema,
  CreateMeetingMessageSchema,
} from "@paperclip/shared";
import { requireCompanyAccess } from "../middleware/auth";

const router = Router();

// 회의 목록
router.get("/companies/:companyId/meetings", requireCompanyAccess, async (req, res) => {
  const list = await meetingService(req.db).list(req.params.companyId);
  res.json(list);
});

// 회의 생성
router.post("/companies/:companyId/meetings", requireCompanyAccess, async (req, res) => {
  const parsed = CreateMeetingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: parsed.error.flatten() });
  }

  const initiatedById = req.body.initiatedByAgentId ?? null;
  const meeting = await meetingService(req.db).create(
    req.params.companyId,
    parsed.data,
    initiatedById
  );

  // 참여 에이전트 wake
  const wakeReason =
    parsed.data.type === "sync" ? "sync_meeting_started" : "async_meeting_invited";
  for (const agentId of parsed.data.participantAgentIds) {
    await wakeupAgent(req.db, agentId, wakeReason, {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
    }).catch(() => {
      // wake 실패가 회의 생성을 막지 않음
    });
  }

  broadcastToCompany(req.params.companyId, "meeting.started", {
    meetingId: meeting.id,
    title: meeting.title,
    type: meeting.type,
    participantAgentIds: parsed.data.participantAgentIds,
  });

  res.status(201).json(meeting);
});

// 회의 상세
router.get("/meetings/:meetingId", async (req, res) => {
  const meeting = await meetingService(req.db).get(req.params.meetingId);
  if (!meeting) return res.status(404).json({ error: "Not found" });
  res.json(meeting);
});

// 회의 종료
router.post("/meetings/:meetingId/conclude", async (req, res) => {
  const parsed = ConcludeMeetingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: parsed.error.flatten() });
  }

  const meeting = await meetingService(req.db).get(req.params.meetingId);
  if (!meeting) return res.status(404).json({ error: "Not found" });
  if (meeting.status === "concluded" || meeting.status === "cancelled") {
    return res.status(409).json({ error: "이미 종료된 회의입니다." });
  }

  const updated = await meetingService(req.db).conclude(
    req.params.meetingId,
    parsed.data
  );

  broadcastToCompany(meeting.companyId, "meeting.concluded", {
    meetingId: updated.id,
    summary: updated.summary,
  });

  res.json(updated);
});

// 회의 취소
router.delete("/meetings/:meetingId", async (req, res) => {
  const meeting = await meetingService(req.db).get(req.params.meetingId);
  if (!meeting) return res.status(404).json({ error: "Not found" });

  const updated = await meetingService(req.db).cancel(req.params.meetingId);
  res.json(updated);
});

// 발언 목록
router.get("/meetings/:meetingId/messages", async (req, res) => {
  const messages = await meetingService(req.db).listMessages(req.params.meetingId);
  res.json(messages);
});

// 발언 추가
router.post("/meetings/:meetingId/messages", async (req, res) => {
  const parsed = CreateMeetingMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: parsed.error.flatten() });
  }

  const meeting = await meetingService(req.db).get(req.params.meetingId);
  if (!meeting) return res.status(404).json({ error: "Not found" });
  if (meeting.status === "concluded" || meeting.status === "cancelled") {
    return res.status(409).json({ error: "종료된 회의에는 발언할 수 없습니다." });
  }

  const senderAgentId = req.body.senderAgentId ?? null;
  const message = await meetingService(req.db).addMessage(
    req.params.meetingId,
    senderAgentId,
    parsed.data
  );

  broadcastToCompany(meeting.companyId, "meeting.message", { message });

  // 동기 회의인 경우 다른 참여자들 wake
  if (meeting.type === "sync" && senderAgentId) {
    const participants = await meetingService(req.db).getParticipants(
      req.params.meetingId
    );
    for (const p of participants) {
      if (p.agentId && p.agentId !== senderAgentId) {
        await wakeupAgent(req.db, p.agentId, "sync_meeting_message", {
          meetingId: meeting.id,
          messageId: message.id,
        }).catch(() => {});
      }
    }
  }

  res.status(201).json(message);
});

// 참여자 추가
router.post("/meetings/:meetingId/participants", async (req, res) => {
  const { agentId } = req.body;
  const participant = await meetingService(req.db).addParticipant(
    req.params.meetingId,
    agentId ?? null
  );
  res.status(201).json(participant);
});

export default router;
```

---

### Task 13 — 채팅 라우트 구현

**파일:** `server/src/routes/chat.ts` (신규)

```typescript
import { Router } from "express";
import { chatService } from "../services/chat";
import { broadcastToCompany } from "../lib/live-events";
import { wakeupAgent } from "../services/heartbeat";
import { SendChatMessageSchema, ResolveChatActionSchema } from "@paperclip/shared";
import { requireCompanyAccess } from "../middleware/auth";
import { getSecretaryAgent } from "../services/agents";

const router = Router();

// 채팅 메시지 목록
router.get("/companies/:companyId/chat", requireCompanyAccess, async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const messages = await chatService(req.db).list(req.params.companyId, limit);
  // 시간순 정렬 (오래된 것 먼저)
  res.json(messages.reverse());
});

// 메시지 전송 (사용자 → 비서)
router.post("/companies/:companyId/chat", requireCompanyAccess, async (req, res) => {
  const parsed = SendChatMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: parsed.error.flatten() });
  }

  const message = await chatService(req.db).send(
    req.params.companyId,
    "user",
    req.user?.id ?? null,
    parsed.data
  );

  broadcastToCompany(req.params.companyId, "chat.message", { message });

  // 비서 에이전트 wake
  const secretary = await getSecretaryAgent(req.db, req.params.companyId);
  if (secretary) {
    await wakeupAgent(req.db, secretary.id, "user_chat_message", {
      messageId: message.id,
      content: message.content,
    }).catch(() => {});
  }

  res.status(201).json(message);
});

// 인라인 액션 응답 (사용자가 승인/거부)
router.post("/chat/:messageId/action", async (req, res) => {
  const parsed = ResolveChatActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: parsed.error.flatten() });
  }

  const updated = await chatService(req.db).resolveAction(
    req.params.messageId,
    parsed.data.decision
  );
  if (!updated) return res.status(404).json({ error: "Not found" });

  broadcastToCompany(updated.companyId, "chat.action_resolved", {
    messageId: updated.id,
    decision: parsed.data.decision,
    actionPayload: updated.actionPayload,
  });

  res.json(updated);
});

export default router;
```

---

### Task 14 — Advisory 라우트 구현

**파일:** `server/src/routes/advisories.ts` (신규)

```typescript
import { Router } from "express";
import { advisoryService } from "../services/advisory";
import { wakeupAgent } from "../services/heartbeat";
import { getSecretaryAgent } from "../services/agents";
import { requireCompanyAccess } from "../middleware/auth";
import { ADVISORY_ACTIONS } from "@paperclip/shared";
import { z } from "zod";

const router = Router();

const CreateAdvisorySchema = z.object({
  agentId: z.string().uuid(),
  action: z.enum(ADVISORY_ACTIONS),
  summary: z.string().min(1),
  linkedIssueIds: z.array(z.string().uuid()).optional(),
  linkedGoalIds: z.array(z.string().uuid()).optional(),
});

// Advisory 목록
router.get("/companies/:companyId/advisories", requireCompanyAccess, async (req, res) => {
  const list = await advisoryService(req.db).list(req.params.companyId);
  res.json(list);
});

// Advisory 생성 (에이전트가 호출)
router.post("/companies/:companyId/advisories", requireCompanyAccess, async (req, res) => {
  const parsed = CreateAdvisorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: parsed.error.flatten() });
  }

  const entry = await advisoryService(req.db).create(
    req.params.companyId,
    parsed.data.agentId,
    parsed.data.action,
    {
      summary: parsed.data.summary,
      linkedIssueIds: parsed.data.linkedIssueIds,
      linkedGoalIds: parsed.data.linkedGoalIds,
    }
  );

  res.status(201).json(entry);
});

// Advisory → Proposal 승격 요청
router.post("/advisories/:advisoryId/promote", async (req, res) => {
  // advisory(activity_log 항목)를 찾아서 해당 에이전트를 wake
  // 에이전트가 깨어나서 직접 Proposal 결재를 생성하는 구조
  const { advisoryId } = req.params;

  // activity_log에서 advisory 조회
  const advisory = await req.db.query.activityLog.findFirst({
    where: (t, { eq }) => eq(t.id, advisoryId),
  });

  if (!advisory) return res.status(404).json({ error: "Not found" });
  if (!advisory.actorId) {
    return res.status(400).json({ error: "Advisory에 에이전트 정보가 없습니다." });
  }

  await wakeupAgent(req.db, advisory.actorId, "advisory_promote_requested", {
    advisoryId,
    originalSummary: advisory.details,
  });

  res.json({ ok: true, message: "에이전트에게 Proposal 생성을 요청했습니다." });
});

export default router;
```

---

### Task 15 — 라우트 등록

**파일:** `server/src/routes/index.ts` (또는 기존 라우터 등록 파일)

기존 라우트 등록 파일에서 새 라우터를 import하고 등록한다:

```typescript
import meetingsRouter from "./meetings";
import chatRouter from "./chat";
import advisoriesRouter from "./advisories";

// 기존 라우터 등록 아래에 추가
app.use("/api", meetingsRouter);
app.use("/api", chatRouter);
app.use("/api", advisoriesRouter);
```

기존 라우터 등록 패턴을 그대로 따른다.

---

### Task 16 — WebSocket 이벤트 타입 등록

**파일:** `server/src/lib/live-events.ts` (기존 파일 수정)

기존 이벤트 타입 목록에 회의/채팅 관련 이벤트를 추가한다.

```typescript
// 기존 LIVE_EVENT_TYPES 배열 또는 상수에 추가
"chat.message",           // 새 채팅 메시지
"chat.action_resolved",   // 인라인 액션 처리됨
"meeting.started",        // 회의 시작됨
"meeting.message",        // 회의 발언 추가됨
"meeting.concluded",      // 회의 종료됨
```

기존 파일의 타입 선언 방식을 그대로 따른다.
`broadcastToCompany` 함수 시그니처를 변경하지 않는다.

---

### Task 17 — 인덱스 마이그레이션 추가

DB 마이그레이션 생성 후, 아래 인덱스가 마이그레이션에 포함됐는지 확인한다.
포함되지 않았다면 별도 마이그레이션 파일에 추가한다:

```sql
-- 회사별 회의 목록 조회 성능
CREATE INDEX IF NOT EXISTS idx_meetings_company
  ON meetings (company_id, created_at DESC);

-- 회의별 발언 목록 조회 성능
CREATE INDEX IF NOT EXISTS idx_meeting_messages_meeting
  ON meeting_messages (meeting_id, created_at);

-- 회사별 채팅 메시지 페이지네이션
CREATE INDEX IF NOT EXISTS idx_chat_messages_company
  ON chat_messages (company_id, created_at DESC);

-- 채팅 메시지 중 회의와 연결된 것 조회
CREATE INDEX IF NOT EXISTS idx_chat_messages_meeting
  ON chat_messages (meeting_id, created_at)
  WHERE meeting_id IS NOT NULL;

-- 에이전트별 미결 proposal 빠른 조회
CREATE INDEX IF NOT EXISTS idx_approvals_agent_pending
  ON approvals (requested_by_agent_id, status)
  WHERE status = 'pending';

-- advisory 빠른 조회
CREATE INDEX IF NOT EXISTS idx_activity_log_advisory
  ON activity_log (company_id, action, created_at)
  WHERE action LIKE 'agent.advisory.%';
```

---

## 완료 기준

모든 Task 완료 후 아래를 확인한다:

```sh
# 스키마 타입 검사
pnpm -r typecheck

# 전체 빌드
pnpm build

# 테스트
pnpm test:run
```

### 체크리스트

- [ ] `meetings`, `meeting_participants`, `meeting_messages` 테이블 스키마 작성됨
- [ ] `chat_messages` 테이블 스키마 작성됨
- [ ] `packages/db/src/schema/index.ts`에서 새 테이블 export됨
- [ ] `pnpm db:generate`로 마이그레이션 파일 생성됨
- [ ] `meetingService` 구현됨 (list, get, create, conclude, cancel, messages CRUD)
- [ ] `chatService` 구현됨 (list, send, resolveAction)
- [ ] `advisoryService` 구현됨 (list, create)
- [ ] `approvals.ts`에 `executeOnApproveAction()` 추가됨 (기존 로직 보존)
- [ ] Rate Limit 체크 `checkProposalRateLimit()` 추가됨
- [ ] 회의 라우트 (`/companies/:id/meetings`, `/meetings/:id/*`) 구현됨
- [ ] 채팅 라우트 (`/companies/:id/chat`, `/chat/:id/action`) 구현됨
- [ ] Advisory 라우트 (`/companies/:id/advisories`, `/advisories/:id/promote`) 구현됨
- [ ] 라우터가 메인 앱에 등록됨
- [ ] WebSocket 이벤트 타입 5개 추가됨
- [ ] 회의 생성 시 참여 에이전트 wake 연동됨 (sync: `sync_meeting_started`, async: `async_meeting_invited`)
- [ ] 회의 발언 추가 시 참여 에이전트 wake 연동됨 (`sync_meeting_message`)
- [ ] 채팅 메시지 전송 시 비서 에이전트 wake 연동됨 (`user_chat_message`)
- [ ] `pnpm -r typecheck` 통과
- [ ] `pnpm build` 통과

---

## 주의사항

1. **기존 라우트 보존**: 기존 V1 엔드포인트의 동작을 변경하지 않는다.
2. **company 범위 강제**: 모든 엔드포인트에서 `companyId` 기반 접근 권한을 확인한다.
3. **에러 응답 일관성**: `400/401/403/404/409/422/500` 형식을 기존 라우트와 동일하게 유지한다.
4. **wake 실패 허용**: 에이전트 wake 실패가 API 응답을 막지 않도록 `.catch(() => {})` 처리한다.
5. **자동 실행 실패 허용**: `executeOnApproveAction` 실패 시 승인 상태는 유지하고 로그만 남긴다.
6. **Agent 3 의존**: `@paperclip/shared`의 신규 상수·타입이 빌드되어 있어야 한다. Agent 3 완료 후 import 가능.
7. **activity_log 구조 확인**: `advisoryService`에서 사용하는 `activityLog` 테이블의 컬럼명을 기존 스키마에서 확인한 후 맞춘다.

---

## 참고 문서

- `doc/COWORKER-AUTONOMY.md` §8 — 채팅 시스템 상세
- `doc/COWORKER-AUTONOMY.md` §9 — Proposal 시스템 (executeOnApproveAction 패턴)
- `doc/COWORKER-AUTONOMY.md` §10 — Advisory 상세
- `doc/COWORKER-AUTONOMY.md` §14 — DB 변경사항 총정리
- `doc/COWORKER-AUTONOMY.md` §15 — API 변경사항 총정리
- `doc/AUTONOMOUS-COMPANY-ROADMAP.md` §Phase 1 — 회의 엔티티·API 설계
- `doc/DATABASE.md` — DB 운영 규칙
- `doc/AGENTS.md` — 엔지니어링 규칙