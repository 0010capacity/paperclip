# Agent 3 작업 계획서 — Shared Contracts

> **이 계획서는 병렬 작업 중 Agent 3이 담당하는 범위를 정의한다.**
> Agent 1(DB/Backend), Agent 2(Frontend/UI)가 모두 여기서 정의한 타입·상수를 import한다.
> **따라서 이 작업을 가장 먼저 완료해야 한다.**

---

## 역할 요약

| 항목 | 내용 |
|------|------|
| **담당 패키지** | `packages/shared/`, `packages/db/src/schema/` (스키마 타입 정의) |
| **핵심 산출물** | 상수, 타입, Zod 검증기, 에이전트 권한 정의, Rate Limit 설정 |
| **다른 에이전트와의 관계** | Agent 1, 2 모두 여기서 export한 것을 사용. 먼저 완료해야 블로킹 없음 |
| **건드리지 않는 것** | `server/` 라우트/서비스, `ui/` 컴포넌트, DB 마이그레이션 파일 |

---

## 읽어야 할 문서

작업 시작 전 반드시 읽을 것:

1. `doc/AGENTS.md` — 전체 기여 규칙
2. `doc/SPEC-implementation.md` — V1 데이터 모델과 컨트랙트
3. `doc/COWORKER-AUTONOMY.md` — 섹션 9(Proposal), 10(Advisory), 11(권한·Rate Limit), 14(DB 총정리)
4. `doc/AUTONOMOUS-COMPANY-ROADMAP.md` — Phase 1(회의 설계 원칙), Phase 2(ApprovalMatrix)
5. `packages/shared/src/` — 기존 상수·타입 파악

---

## 현재 상태 파악

작업 전 아래 파일들의 현재 내용을 읽어 파악한다:

```
packages/shared/src/constants.ts          ← APPROVAL_TYPES 등 기존 상수
packages/shared/src/types.ts              ← 기존 공유 타입
packages/shared/src/validators/           ← 기존 Zod 스키마
packages/shared/src/index.ts              ← export 목록
server/src/services/agent-permissions.ts  ← 기존 권한 서비스
```

---

## 작업 목록

### Task 1 — APPROVAL_TYPES 확장

**파일:** `packages/shared/src/constants.ts`

기존 `APPROVAL_TYPES` 배열에 신규 Proposal 유형을 추가한다.

```typescript
// 기존 (변경하지 않음)
"hire_agent",
"approve_ceo_strategy",

// 신규 추가
"propose_goal",       // 목표 제안 → 승인 시 goal 자동 생성 가능
"propose_project",    // 프로젝트 제안
"propose_strategy",   // 전략/방향 제안 (임원급)
"request_budget",     // 예산 요청
"propose_process",    // 프로세스 개선 제안
"propose_hiring",     // 채용 제안 → 승인 시 hire_agent 결재 자동 생성
"escalation",         // 에스컬레이션 (차단 상황 도움 요청)
```

**주의:** 기존 값은 절대 제거하거나 변경하지 않는다. 배열에 추가만 한다.

---

### Task 2 — 회의 관련 Wake Reason 상수 추가

**파일:** `packages/shared/src/constants.ts`

기존 wake reason 상수(있다면)에 회의 관련 항목을 추가한다.
없다면 신규 상수로 생성한다.

```typescript
export const MEETING_WAKE_REASONS = [
  "sync_meeting_started",       // 동기 회의가 시작됨 — 참여 에이전트 wake
  "sync_meeting_message",       // 동기 회의 중 새 메시지 수신
  "async_meeting_invited",      // 비동기 정기 회의에 초대됨
] as const;

export type MeetingWakeReason = typeof MEETING_WAKE_REASONS[number];
```

기존 wake reason 상수가 있으면 해당 파일에 통합한다. 중복 정의 금지.

---

### Task 3 — Advisory Action 상수 추가

**파일:** `packages/shared/src/constants.ts`

Advisory는 결재 불필요 관찰/의견이다. `activity_log`의 `action` 컬럼에 사용된다.

```typescript
export const ADVISORY_ACTIONS = [
  "agent.advisory.observation",    // "이런 걸 발견했습니다"
  "agent.advisory.suggestion",     // "이렇게 하면 좋을 것 같아요"
  "agent.advisory.concern",        // "이 부분이 걱정됩니다"
  "agent.advisory.progress_note",  // "이 작업 이렇게 진행 중입니다"
] as const;

export type AdvisoryAction = typeof ADVISORY_ACTIONS[number];
```

---

### Task 4 — Meeting 관련 타입 정의

**파일:** `packages/shared/src/types.ts` (또는 `packages/shared/src/types/meeting.ts` 신규)

DB 스키마와 1:1 대응하는 TypeScript 인터페이스를 정의한다.
(실제 DB 스키마는 Agent 1이 작성한다. 여기서는 공유 타입만 정의.)

```typescript
export type MeetingType = "sync" | "async";
export type MeetingStatus = "scheduled" | "in_progress" | "concluded" | "cancelled";
export type MeetingTriggerType = "user_initiated" | "agent_initiated" | "scheduled";

export interface Meeting {
  id: string;
  companyId: string;
  title: string;
  type: MeetingType;
  status: MeetingStatus;
  triggerType: MeetingTriggerType;
  initiatedById: string | null; // agentId. null = 사용자가 시작
  scheduledAt: string | null;
  startedAt: string | null;
  concludedAt: string | null;
  summary: string | null;
  actionItemIssueIds: string[];
  createdAt: string;
}

export interface MeetingParticipant {
  id: string;
  meetingId: string;
  agentId: string | null; // null = 사용자
  joinedAt: string;
}

export type MeetingMessageContentType = "text" | "action_request" | "action_result";
export type MeetingMessageActionStatus = "pending" | "confirmed" | "rejected" | "expired";

export interface MeetingMessage {
  id: string;
  meetingId: string;
  senderAgentId: string | null; // null = 사용자가 직접 작성
  content: string;
  contentType: MeetingMessageContentType;
  actionPayload: Record<string, unknown> | null;
  actionStatus: MeetingMessageActionStatus | null;
  createdAt: string;
}
```

---

### Task 5 — Chat 관련 타입 정의

**파일:** `packages/shared/src/types.ts` (또는 `packages/shared/src/types/chat.ts` 신규)

사용자 ↔ 비서 1:1 채팅 메시지 타입.

```typescript
export type ChatSenderType = "user" | "secretary";
export type ChatContentType = "text" | "action_request" | "action_result" | "meeting_event";
export type ChatActionStatus = "pending" | "confirmed" | "rejected" | "expired";

export interface ChatMessage {
  id: string;
  companyId: string;
  senderType: ChatSenderType;
  senderId: string | null;
  content: string;
  contentType: ChatContentType;
  meetingId: string | null;        // 동기 회의와 연결된 경우
  actionPayload: Record<string, unknown> | null;
  actionStatus: ChatActionStatus | null;
  createdAt: string;
}
```

---

### Task 6 — Proposal Payload 타입 및 Zod 검증기

**파일:** `packages/shared/src/validators/proposal.ts` (신규)

모든 Proposal은 기존 `approvals.payload` JSONB에 저장된다.
새 테이블 없이 payload 스키마만 정의한다.

```typescript
import { z } from "zod";

// 공통 필드
const ProposalPayloadBaseSchema = z.object({
  summary: z.string().min(1).max(500),
  rationale: z.string().min(1),
  details: z.string().optional(),

  estimatedCost: z.object({
    monthlyCents: z.number().int().nonnegative().optional(),
    oneTimeCents: z.number().int().nonnegative().optional(),
    costJustification: z.string().min(1),
  }).optional(),

  linkedIssueIds: z.array(z.string().uuid()).optional(),
  linkedGoalIds: z.array(z.string().uuid()).optional(),

  urgency: z.enum(["low", "medium", "high"]).optional(),

  fromMeetingContext: z.object({
    meetingType: z.enum(["daily", "weekly", "monthly"]),
    meetingId: z.string().uuid().optional(),
  }).optional(),

  onApproveAction: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("create_goal"),
      goal: z.object({
        title: z.string().min(1),
        level: z.enum(["company", "team", "agent", "task"]),
        description: z.string().optional(),
        parentId: z.string().uuid().optional(),
      }),
    }),
    z.object({
      type: z.literal("create_project"),
      project: z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        goalId: z.string().uuid().optional(),
      }),
    }),
    z.object({
      type: z.literal("update_budget"),
      agentId: z.string().uuid(),
      newBudgetMonthlyCents: z.number().int().positive(),
    }),
    z.object({
      type: z.literal("create_hire_approval"),
      hirePayload: z.record(z.unknown()),
    }),
    z.object({
      type: z.literal("none"),
    }),
  ]).optional(),
});

export const ProposalPayloadSchema = ProposalPayloadBaseSchema;
export type ProposalPayload = z.infer<typeof ProposalPayloadSchema>;

// 유형별 검증기 (type-narrowed)
export const ProposeGoalPayloadSchema = ProposalPayloadBaseSchema.extend({
  onApproveAction: z.object({
    type: z.literal("create_goal"),
    goal: z.object({
      title: z.string().min(1),
      level: z.enum(["company", "team", "agent", "task"]),
      description: z.string().optional(),
      parentId: z.string().uuid().optional(),
    }),
  }),
});

export const RequestBudgetPayloadSchema = ProposalPayloadBaseSchema.extend({
  onApproveAction: z.object({
    type: z.literal("update_budget"),
    agentId: z.string().uuid(),
    newBudgetMonthlyCents: z.number().int().positive(),
  }),
});
```

이 파일을 `packages/shared/src/validators/index.ts`에서 export한다.

---

### Task 7 — Meeting API 요청/응답 Zod 검증기

**파일:** `packages/shared/src/validators/meeting.ts` (신규)

```typescript
import { z } from "zod";

export const CreateMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["sync", "async"]),
  participantAgentIds: z.array(z.string().uuid()).min(1),
  scheduledAt: z.string().datetime().optional(),
});

export type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>;

export const ConcludeMeetingSchema = z.object({
  summary: z.string().min(1),
  actionItemIssueIds: z.array(z.string().uuid()).optional(),
});

export type ConcludeMeetingInput = z.infer<typeof ConcludeMeetingSchema>;

export const CreateMeetingMessageSchema = z.object({
  content: z.string().min(1),
  contentType: z.enum(["text", "action_request", "action_result"]).default("text"),
  actionPayload: z.record(z.unknown()).optional(),
});

export type CreateMeetingMessageInput = z.infer<typeof CreateMeetingMessageSchema>;
```

---

### Task 8 — Chat API 요청 Zod 검증기

**파일:** `packages/shared/src/validators/chat.ts` (신규)

```typescript
import { z } from "zod";

export const SendChatMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

export type SendChatMessageInput = z.infer<typeof SendChatMessageSchema>;

export const ResolveChatActionSchema = z.object({
  decision: z.enum(["confirmed", "rejected"]),
});

export type ResolveChatActionInput = z.infer<typeof ResolveChatActionSchema>;
```

---

### Task 9 — 에이전트 권한 타입 및 기본값 확장

**파일:** `server/src/services/agent-permissions.ts`

기존 `NormalizedAgentPermissions` 인터페이스에 Proposal 관련 권한 필드를 추가한다.
기존 필드(`canCreateAgents` 등)는 절대 변경하지 않는다.

```typescript
// 기존 인터페이스에 추가할 필드
interface NormalizedAgentPermissions {
  // 기존 유지
  canCreateAgents: boolean;

  // 신규 추가 — Proposal 권한
  canProposeGoals: boolean;       // 매니저급 이상
  canProposeProjects: boolean;    // 매니저급 이상
  canProposeStrategy: boolean;    // 임원급 (CEO, CTO, CSO, CFO, CMO)
  canRequestBudget: boolean;      // 모든 에이전트 (자기 예산 범위)
  canProposeHiring: boolean;      // 매니저급 이상
  canEscalate: boolean;           // 모든 에이전트
  canAdvisory: boolean;           // 모든 에이전트
}
```

기존 `defaultPermissionsForRole` 함수에 새 필드를 추가한다:

```typescript
function defaultPermissionsForRole(role: string): NormalizedAgentPermissions {
  const isExecutive = ["ceo", "cto", "cmo", "cfo", "cso"].includes(role);
  const isManager = isExecutive || ["pm", "lead"].includes(role);

  return {
    // 기존 유지
    canCreateAgents: role === "ceo",

    // 신규
    canProposeGoals: isManager,
    canProposeProjects: isManager,
    canProposeStrategy: isExecutive,
    canRequestBudget: true,         // 모든 역할
    canProposeHiring: isManager,
    canEscalate: true,              // 모든 역할
    canAdvisory: true,              // 모든 역할
  };
}
```

**중요:** 기존 로직과 필드를 보존하면서 신규 필드만 추가한다.
파일의 기존 export 구조를 유지한다.

---

### Task 10 — Proposal Rate Limit 상수 정의

**파일:** `packages/shared/src/constants.ts`

```typescript
export const PROPOSAL_RATE_LIMITS = {
  maxPendingProposalsPerAgent: 3,      // 에이전트당 미결 제안 최대
  maxProposalsPerAgentPerDay: 5,       // 에이전트당 일일 제안 최대
  maxAdvisoriesPerAgentPerDay: 10,     // 에이전트당 일일 advisory 최대
  maxPendingProposalsPerCompany: 20,   // 회사 전체 미결 제안 최대
} as const;

export type ProposalRateLimits = typeof PROPOSAL_RATE_LIMITS;
```

---

### Task 11 — 역할별 기본 모델 매핑 파일 생성

**파일:** `packages/shared/src/role-model-defaults.ts` (신규)

```typescript
export interface RoleModelDefault {
  adapter: string;
  model: string;
}

// V1 기본 역할
export const ROLE_MODEL_DEFAULTS: Record<string, RoleModelDefault> = {
  ceo:       { adapter: "opencode_local", model: "anthropic/claude-opus-4" },
  cto:       { adapter: "opencode_local", model: "anthropic/claude-sonnet-4" },
  cfo:       { adapter: "opencode_local", model: "openai/gpt-4o" },
  cmo:       { adapter: "opencode_local", model: "google/gemini-pro" },
  developer: { adapter: "opencode_local", model: "zai/zai-coding" },
  marketing: { adapter: "opencode_local", model: "google/gemini-flash" },
  support:   { adapter: "opencode_local", model: "openai/gpt-4o-mini" },

  // Phase 2 신규 — 전략 부서 역할
  cso:                { adapter: "opencode_local", model: "anthropic/claude-sonnet-4" },
  futures_researcher: { adapter: "opencode_local", model: "anthropic/claude-sonnet-4" },
  business_analyst:   { adapter: "opencode_local", model: "openai/gpt-4o" },
};

/**
 * 역할에 대한 기본 모델 설정을 반환한다.
 * 알 수 없는 역할이면 undefined를 반환한다.
 */
export function getDefaultModelForRole(role: string): RoleModelDefault | undefined {
  return ROLE_MODEL_DEFAULTS[role.toLowerCase()];
}
```

`packages/shared/src/index.ts`에서 export 추가:

```typescript
export * from "./role-model-defaults";
```

---

### Task 12 — API 경로 상수 추가

**파일:** `packages/shared/src/api-paths.ts` (없으면 신규, 있으면 추가)

Agent 1(서버)과 Agent 2(UI) 모두 사용할 API 경로 상수:

```typescript
export const MEETING_API = {
  list:       (companyId: string) => `/api/companies/${companyId}/meetings`,
  create:     (companyId: string) => `/api/companies/${companyId}/meetings`,
  get:        (meetingId: string) => `/api/meetings/${meetingId}`,
  conclude:   (meetingId: string) => `/api/meetings/${meetingId}/conclude`,
  cancel:     (meetingId: string) => `/api/meetings/${meetingId}`,
  messages:   (meetingId: string) => `/api/meetings/${meetingId}/messages`,
  participants: (meetingId: string) => `/api/meetings/${meetingId}/participants`,
} as const;

export const CHAT_API = {
  send:       (companyId: string) => `/api/companies/${companyId}/chat`,
  list:       (companyId: string) => `/api/companies/${companyId}/chat`,
  action:     (messageId: string) => `/api/chat/${messageId}/action`,
} as const;

export const ADVISORY_API = {
  create:     (companyId: string) => `/api/companies/${companyId}/advisories`,
  list:       (companyId: string) => `/api/companies/${companyId}/advisories`,
  promote:    (advisoryId: string) => `/api/advisories/${advisoryId}/promote`,
} as const;
```

`packages/shared/src/index.ts`에서 export 추가.

---

### Task 13 — WebSocket 이벤트 타입 상수 추가

**파일:** `packages/shared/src/constants.ts`

기존 `LIVE_EVENT_TYPES` (또는 해당하는 WebSocket 이벤트 상수)에 추가:

```typescript
// 기존 이벤트 타입에 추가할 항목
"chat.message"              // 새 채팅 메시지 (비서 ↔ 사용자)
"chat.action_resolved"      // 인라인 액션 처리됨
"meeting.started"           // 동기/비동기 회의 시작됨
"meeting.message"           // 회의 발언 추가됨
"meeting.concluded"         // 회의 종료됨
```

기존 상수 배열이 `as const`로 선언된 경우 해당 배열에 값을 추가한다.
별도 상수로 분리되어 있다면 동일한 패턴을 따른다.

---

## 완료 기준

모든 Task 완료 후 아래를 확인한다:

```sh
# 타입 검사
pnpm -r typecheck

# 빌드 (shared 패키지)
pnpm --filter @paperclip/shared build

# 테스트 (있는 경우)
pnpm test:run
```

### 체크리스트

- [ ] `APPROVAL_TYPES`에 7개 신규 타입 추가됨
- [ ] `MEETING_WAKE_REASONS` 상수 정의 및 export됨
- [ ] `ADVISORY_ACTIONS` 상수 정의 및 export됨
- [ ] `Meeting`, `MeetingParticipant`, `MeetingMessage` 타입 정의 및 export됨
- [ ] `ChatMessage` 타입 정의 및 export됨
- [ ] `ProposalPayloadSchema` Zod 검증기 정의 및 export됨
- [ ] `CreateMeetingSchema`, `ConcludeMeetingSchema`, `CreateMeetingMessageSchema` export됨
- [ ] `SendChatMessageSchema`, `ResolveChatActionSchema` export됨
- [ ] `agent-permissions.ts`에 신규 권한 필드 추가됨 (기존 로직 보존)
- [ ] `PROPOSAL_RATE_LIMITS` 상수 정의 및 export됨
- [ ] `role-model-defaults.ts` 파일 생성 및 export됨
- [ ] API 경로 상수 (`MEETING_API`, `CHAT_API`, `ADVISORY_API`) export됨
- [ ] WebSocket 이벤트 상수에 회의/채팅 이벤트 추가됨
- [ ] `packages/shared/src/index.ts`에서 모든 신규 export 포함됨
- [ ] `pnpm -r typecheck` 통과

---

## 주의사항

1. **기존 코드 보존**: 기존 상수·타입·함수를 변경하거나 제거하지 않는다. 추가만 한다.
2. **중복 정의 금지**: 비슷한 타입이 이미 있으면 새로 만들지 말고 확장한다.
3. **import 정합성**: 새 파일을 만들 때 반드시 `packages/shared/src/index.ts`에서 re-export한다.
4. **Zod 버전 확인**: 기존 `package.json`의 zod 버전과 동일하게 사용한다. 버전을 올리지 않는다.
5. **Agent 1 의존 없음**: DB 스키마 파일(`packages/db/`)은 수정하지 않는다. 타입만 `packages/shared/`에 정의한다.
6. **타입 일치 보장**: 여기서 정의한 타입(예: `Meeting`)은 Agent 1이 만들 DB 스키마의 컬럼명과 camelCase 기준으로 정확히 일치해야 한다. 이 계획서의 타입 정의가 기준이다.

---

## 참고 문서

- `doc/COWORKER-AUTONOMY.md` §9 — Proposal 시스템 상세
- `doc/COWORKER-AUTONOMY.md` §10 — Advisory 상세
- `doc/COWORKER-AUTONOMY.md` §11 — 권한 및 Rate Limit 상세
- `doc/COWORKER-AUTONOMY.md` §14 — DB 변경사항 총정리
- `doc/AUTONOMOUS-COMPANY-ROADMAP.md` §Phase 1 — 회의 엔티티 정의
- `doc/AUTONOMOUS-COMPANY-ROADMAP.md` §Phase 2 — ApprovalMatrix
- `doc/ROLE_BASED_MODEL_ASSIGNMENT.md` — 역할별 모델 매핑 정본