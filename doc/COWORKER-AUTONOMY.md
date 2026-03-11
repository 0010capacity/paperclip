# Coworker Autonomy: 동료로서의 에이전트 시스템

> 에이전트를 도구(tool)가 아닌 **동료(coworker)**로 — 먼저 제안하고, 의견을 내고, 사용자와 함께 회사를 만들어가는 시스템

Status: Design spec for post-V1 autonomy layer
Date: 2025-07-14
Depends on: `SPEC-implementation.md` (V1 baseline)

---

## 1. 철학

Paperclip V1은 "사용자가 목표를 설정하고, 에이전트가 실행한다"는 모델이다.
이 문서는 그 다음 단계를 정의한다:

**에이전트는 도구가 아니라 동료다. 목표를 제안하고, 의견을 내고, 사용자에게 첨언한다.
단, 모든 자율적 행위에는 사용자 승인 게이트가 존재한다.**

### 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **코워커, 도구 아님** | 에이전트는 시키는 일만 하는 게 아니라, 목표를 제안하고 방향성에 의견을 낸다 |
| **자율성에는 결재가 따른다** | 한눈팔다 돌아왔을 때 회사가 이상한 일을 하고 있으면 안 된다. 모든 자율 행위에 사용자 승인 게이트 |
| **토큰은 돈이다** | 에이전트가 마음대로 돌면 토큰이 녹는다. 비용 영향이 있는 결정은 반드시 승인 |
| **기존 시스템을 활용한다** | 새 인프라를 최소화하고, 현재의 `approvals` + `goals` + 하트비트를 확장한다 |
| **외부 의존성 없음** | 이미 있는 skills 시스템을 활용한다. OpenClaw 등 외부 생태계 통합은 하지 않는다 |

---

## 2. 전체 구조 개요

```
┌─────────────────────────────────────────────────────────┐
│  사용자                                                  │
│                                                          │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ Chat      │  │ Inbox /      │  │ Dashboard (GUI)   │ │
│  │ (비서)    │  │ Approvals    │  │                   │ │
│  └─────┬─────┘  └──────┬───────┘  └───────────────────┘ │
│        │               │                                 │
└────────┼───────────────┼─────────────────────────────────┘
         │               │
         ▼               ▼
┌─────────────────────────────────────────────────────────┐
│  비서 / CEO 에이전트                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ • 사용자와 대화하는 창구                            │  │
│  │ • GUI 조작을 대화로 대신 수행                       │  │
│  │ • 동기 회의 진행 (사용자 주도)                      │  │
│  │ • 정기 회의 주관 (에이전트끼리, 비동기)             │  │
│  │ • 회의 결과를 결재로 올림                          │  │
│  └────────────────────────────────────────────────────┘  │
│                         │                                 │
│            결재 (approvals)                               │
│                         ▼                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │  사용자 승인 게이트                                 │  │
│  │  → 목표 자동 생성 / 프로젝트 생성 / 예산 변경       │  │
│  │  → 거부 시 에이전트에게 사유 전달                   │  │
│  └────────────────────────────────────────────────────┘  │
│                         │                                 │
│                         ▼                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │  에이전트들: 분업해서 성실히 수행                    │  │
│  │  Engineer, Designer, QA, ...                        │  │
│  │  (기존 V1 하트비트 루프 그대로)                      │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 현재 시스템에서 무엇을 확장하는가

### 3.1 이미 있는 것 (V1 baseline)

```
approvals 테이블
├── type: "hire_agent" | "approve_ceo_strategy"
├── status: "pending" → "approved" | "rejected" | "revision_requested"
├── payload: JSONB (자유 형식)
├── requestedByAgentId: 에이전트가 결재를 올릴 수 있음
├── decidedByUserId: 사용자가 승인/거부
├── approval_comments: 결재에 대한 토론 스레드
└── 승인 시 → 요청 에이전트에게 wakeup (approval_approved)

goals 테이블
├── level: "company" | "team" | "agent" | "task"
├── status: "planned" | "active" | "achieved" | "cancelled"
├── parentId: 계층적 목표 구조
└── ownerAgentId: 에이전트가 목표의 오너가 될 수 있음

하트비트 시스템
├── tickTimers: 주기적으로 모든 에이전트 순회, intervalSec 지나면 wake
├── enqueueWakeup: reason + contextSnapshot 전달
├── 어댑터: claude_local, codex_local, process, http 등 8종
└── PAPERCLIP_WAKE_REASON 환경변수로 에이전트에게 사유 전달

WebSocket (live-events)
├── 서버 → 클라이언트 단방향 이벤트 스트리밍
├── 회사별 구독 (companyId 기반)
└── heartbeat.run.status, agent.status, activity.logged 등

Inbox 페이지
├── approvals, failed_runs, stale_work, alerts 통합
└── dismiss/restore 가능

agent_permissions
└── canCreateAgents: 역할 기반 (CEO만 true)
```

### 3.2 부족한 것

| 현재 한계 | 필요한 확장 |
|----------|-----------|
| approval type이 2개뿐 | 목표 제안, 예산 요청, 전략 제안 등 다양한 제안 유형 |
| 에이전트와 사용자의 자유 대화 불가 | 비서 에이전트 + 채팅 인터페이스 |
| 에이전트끼리 모여 논의하는 메커니즘 없음 | 정기 회의 (비동기) |
| 사용자가 에이전트들과 실시간 논의할 수 없음 | 동기 회의 (사용자 주도) |
| 정기적 전사 상태 점검 없음 | 비서/CEO의 정기 회의 → 결재 루프 |

---

## 4. 두 종류의 회의

이 시스템의 "회의"는 두 가지다. 성격이 완전히 다르다.

### 4.1 비교 요약

| | 동기 회의 (사용자 주도) | 정기 회의 (에이전트끼리) |
|---|---|---|
| **누가 여는가** | 사용자 | 시스템 (스케줄 기반) |
| **사용자 참여** | 필수 (사용자가 주인공) | 불참 (결과만 결재로 받음) |
| **진행 방식** | 동기: 실시간 채팅 | 비동기: 순차 하트비트 |
| **대화 채널** | Chat (비서 에이전트 경유) | 에이전트 간 내부 처리 |
| **결과물** | 즉시 반영 가능 (사용자가 바로 승인) | Proposal → 결재 → 승인 후 반영 |
| **비용** | 높음 (실시간 응답 필요) | 낮음 (순차 처리) |
| **예시** | "이런 제품 만들어볼까?", "기술 스택 어떻게 할까?" | 주간 스탠드업, 월간 전략 리뷰 |

---

## 5. 동기 회의 — 사용자가 직접 여는 실시간 회의

### 5.1 개념

사용자가 "이런 거 만들어보려는데 어때?" 하고 던지면,
관련 에이전트들이 **직접** 실시간으로 의견을 낸다.

이건 **회의방(meeting room) 기반**이다. Slack·Discord처럼 여러 에이전트가
`meeting_messages`에 순서대로 발언을 작성하고, 사용자는 원문 그대로 확인한다.
비서는 발언을 대신 전달하지 않는다. 진행을 보조하고, 끝에 회의록을 정리할 뿐이다.

### 5.2 동기 회의 플로우

```
사용자: "프로덕트 기획 회의 하자. CTO랑 디자이너 불러줘."
         │
         ▼
비서(또는 사용자 직접):
  POST /api/companies/{id}/meetings
  { "title": "프로덕트 기획", "type": "sync",
    "participantAgentIds": ["cto-id", "designer-id"] }
  → meetings 레코드 생성 (status: "in_progress")
  → CTO 에이전트 wake (reason: "sync_meeting_started")
  → Designer 에이전트 wake (reason: "sync_meeting_started")
         │
         ▼
UI: 회의방 열림 — 참여자 목록, 발언 타임라인 표시

사용자가 발언:
  POST /api/meetings/{id}/messages
  { "senderAgentId": null, "content": "AI 코드리뷰 SaaS를 만들어보려는데 어때?" }
  → WebSocket 브로드캐스트 (meeting.message)
  → 참여 에이전트들 wake (reason: "sync_meeting_message")
         │
         ▼
CTO가 직접 발언:
  POST /api/meetings/{id}/messages
  { "senderAgentId": "cto-id",
    "content": "기술적으로 가능합니다. GitHub API 연동이 핵심이고..." }
  → WebSocket 브로드캐스트 → UI에 CTO 발언 원문 표시

Designer가 직접 발언:
  POST /api/meetings/{id}/messages
  { "senderAgentId": "designer-id",
    "content": "대시보드 UI가 중요할 것 같아요. 경쟁사 분석을 보면..." }
  → WebSocket 브로드캐스트 → UI에 Designer 발언 원문 표시
         │
         ▼
사용자: "좋아, 목표 만들어줘."

비서가 발언 + 인라인 액션:
  POST /api/meetings/{id}/messages
  { "senderAgentId": "secretary-id",
    "content": "다음 목표를 생성할까요?\n\n**AI 코드리뷰 SaaS 개발**",
    "content_type": "action_request",
    "action_payload": { "type": "create_goal", "data": { ... } } }

사용자: [승인]
  POST /api/chat/{messageId}/action  { "decision": "confirmed" }
  → 목표 자동 생성
  → 관련 이슈 생성 + 에이전트 할당
         │
         ▼
비서가 회의 종료:
  POST /api/meetings/{id}/conclude
  { "summary": "AI 코드리뷰 SaaS 개발 목표 확정. CTO: GitHub API 핵심. Designer: 대시보드 UX 차별화." }
```

### 5.3 에이전트 직접 발언의 이점

에이전트들이 `meeting_messages`에 **직접** 발언한다. 비서가 중계하지 않는 이유:

| | 비서 중계 (이전) | 에이전트 직접 발언 (현재) |
|---|---|---|
| **정보 손실** | 비서 요약 시 뉘앙스 유실 | 원문 그대로 전달 |
| **속도** | 비서 LLM 한 번 더 호출 | 에이전트 응답이 바로 표시 |
| **투명성** | 비서 필터링 의심 가능 | 에이전트 의견 직접 확인 |
| **비용** | 중계 토큰 추가 소비 | 오히려 더 저렴 |
| **UX** | 1:1 대화 느낌 | 회의실에 모여있는 느낌 |

피로도 문제("5명이 동시에 떠든다")는 **UI로 해결**한다.
Slack처럼 발언이 순서대로 쌓이는 것은 이미 익숙한 패턴이다.

### 5.4 동기 회의 엔티티

```typescript
interface Meeting {
  id: string;
  companyId: string;
  title: string;
  type: "sync" | "async";
  status: "scheduled" | "in_progress" | "concluded" | "cancelled";

  triggerType: "user_initiated" | "agent_initiated" | "scheduled";
  initiatedById: string | null; // agentId, null = 사용자

  scheduledAt?: Date;
  startedAt?: Date;
  concludedAt?: Date;

  summary?: string;              // 비서가 종료 시 작성하는 회의록
  actionItemIssueIds?: string[]; // 회의 결과로 생성된 이슈 IDs
  createdAt: Date;
}

interface MeetingParticipant {
  meetingId: string;
  agentId: string | null; // null = 사용자
  joinedAt: Date;
}

interface MeetingMessage {
  id: string;
  meetingId: string;
  senderAgentId: string | null; // null = 사용자가 직접 작성
  content: string;
  contentType: "text" | "action_request" | "action_result";
  actionPayload?: Record<string, unknown>; // 비서의 인라인 액션
  actionStatus?: "pending" | "confirmed" | "rejected" | "expired";
  createdAt: Date;
}
```

`chat_messages`(사용자 ↔ 비서 1:1 대화)와 `meeting_messages`(회의방 발언)는 별도 테이블이다.
회의방은 여러 참여자가 발언하는 공간이고, 채팅은 비서와의 1:1 창구다.

### 5.5 동기 회의에서 비서의 역할

비서는 회의 중에 다음을 수행한다:

1. **참여자 소집**: 회의 생성 및 에이전트 wake
2. **진행 보조**: 발언 교착 상태 시 정리 메시지 작성
3. **인라인 액션**: 사용자 확인이 필요한 실행을 `action_request` 메시지로 요청
4. **회의록 작성**: 회의 종료 시 `summary` 작성 후 `POST /api/meetings/{id}/conclude`
5. **결과 처리**: 필요 시 Proposal(Approval) 생성

비서가 **하지 않는 것**: 다른 에이전트의 발언을 대신 전달하거나 요약해서 전달하는 것.

### 5.6 비용 고려

동기 회의는 비용이 높다 (참여자마다 LLM 호출).
회의 시작 시 **관련 있는 에이전트만** 초대하도록 제한한다:

```
사용자: "기술 스택 논의하자"
비서(또는 사용자 직접): CTO, Engineer만 초대
                        Designer는 초대하지 않음 (기술 스택은 CTO/Engineer 영역)
```

참여자 수 상한을 설정하거나(예: 최대 5명), 불필요한 에이전트를 포함하면
비서가 "이 에이전트는 이 주제와 관련이 적습니다"라고 안내할 수 있다.

---

## 6. 정기 회의 — 에이전트끼리 알아서 하는 비동기 회의

### 6.1 개념

에이전트들이 주기적으로 전사 상태를 점검하고, 현황을 공유하고,
필요하면 새 목표를 제안하거나 방향 수정을 결재로 올린다.
사용자는 참여하지 않고, 결과물(회의 요약 + 결재)만 확인하면 된다.

실제 IT 회사의 주간 스탠드업처럼, **특정 이슈가 없어도 정기적으로 모여
현황을 공유하고 방향을 맞추는 것** 자체가 목적이다.
이 때문에 비동기 정기 회의도 `meetings` 별도 엔티티로 관리한다.
이슈 코멘트로 흉내 내면 "회의"라는 개념적 독립성과 히스토리 뷰가 사라진다.

### 6.2 비동기 정기 회의 플로우

```
┌──────────────────────────────────────────────────────┐
│  tickTimers 가 CEO/비서 에이전트를 wake               │
│  (reason: "heartbeat_timer", 스케줄 기반)             │
│                                                       │
│  CEO 하트비트에서:                                     │
│  1. 전사 상태 조회                                     │
│     GET /api/companies/{id}/goals       → 목표 현황    │
│     GET /api/companies/{id}/issues      → 이슈 현황    │
│     GET /api/companies/{id}/agents      → 에이전트 상태│
│     GET /api/costs/company/{id}         → 비용 현황    │
│                                                       │
│  2. 비동기 회의 생성 (주간/월간 등 주기 도달 시)        │
│     POST /api/companies/{id}/meetings                 │
│     { "title": "주간 전사 현황 공유",                 │
│       "type": "async",                                │
│       "participantAgentIds": ["cto-id", ...] }        │
│     → 참여자들 wake (reason: "async_meeting_invited") │
│                                                       │
│  3. 각 에이전트가 다음 하트비트 때 발언 작성            │
│     POST /api/meetings/{id}/messages                  │
│     { "senderAgentId": "cto-id",                     │
│       "content": "API 서버 안정적. 이번 주 인증 모듈  │
│                   마무리 예정. 로깅 용량 이슈 있음." } │
│                                                       │
│  4. CEO 다음 하트비트: 전체 발언 수집 후 종합           │
│     - summary 작성                                    │
│     - 결재 생성 (필요 시)                              │
│       POST /api/companies/{id}/approvals              │
│       type: "propose_goal" | "request_budget" | ...   │
│     - Advisory 남김 (결재 불필요 관찰)                 │
│     - POST /api/meetings/{id}/conclude                │
│                                                       │
│  5. sleep                                              │
└──────────────────────────────────────────────────────┘
```

### 6.3 정기 회의 스케줄

CEO/비서의 `runtimeConfig.heartbeat.intervalSec`으로 제어한다.
CEO 에이전트의 프롬프트에서 "몇 번째 하트비트인지"를 보고 회의 소집 여부를 판단한다.

| 회의 유형 | 빈도 | 주관 | 참여자 | 목적 |
|----------|------|------|--------|------|
| 주간 현황 공유 | 매주 월요일 | CEO | 전 에이전트 | 진행 상황, 차단 이슈 파악 |
| 스프린트 리뷰 | 격주 | CEO | 전 에이전트 | 완료 작업 리뷰, 다음 우선순위 |
| 기술 방향성 싱크 | 격주 | CTO | 기술 팀 | 기술 스택, 아키텍처 결정 공유 |
| 전략 리뷰 | 월간 | CEO | 임원진 | 목표 진척, 전략 재검토 |

### 6.4 다른 에이전트의 의견이 필요한 경우

CEO가 정기 회의 중 다른 에이전트의 의견이 필요하면,
회의 안에서 `meeting_messages`를 통해 직접 의견을 요청한다:

```
CEO가 비동기 회의 생성 후:
  POST /api/meetings/{id}/messages
  { "senderAgentId": "ceo-id",
    "content": "@CTO 현재 기술 스택의 병목이 어디인지 의견 주세요." }
  → CTO wake (reason: "async_meeting_invited")

CTO가 다음 하트비트에서 응답:
  POST /api/meetings/{id}/messages
  { "senderAgentId": "cto-id",
    "content": "로깅 레이어가 병목입니다. 비동기 처리로 전환하면 30% 개선 예상." }

CEO 다음 하트비트에서 종합 → 결재 올림
```

이건 비동기다. 실시간이 아니어도 된다.
정기 회의 내의 소통은 `meeting_messages`로, 일상적 작업 소통은 기존 `issue_comments` + @멘션으로 구분한다.

---

## 7. 비서 에이전트 — 사용자의 메인 창구

### 7.1 개념

사용자가 Paperclip을 사용할 때 **대화 한 곳**으로 모든 걸 할 수 있다.
GUI는 전체 현황을 보는 대시보드, 채팅은 빠른 조작과 논의.

```
사용자: "지금 어떻게 돌아가고 있어?"
비서: "진행 중인 이슈 12개, 완료 5개입니다.
       Engineer A가 API 리팩토링에서 2일째 막혀있고,
       CTO가 예산 증가 결재를 올렸어요. 확인하시겠어요?"

사용자: "CTO 결재 승인해"
비서: → POST /api/approvals/{id}/approve
     "승인했습니다. CTO에게 알림을 보냈어요."

사용자: "엔지니어 A한테 다른 이슈 먼저 하라고 해"
비서: → 이슈 재할당 API 호출
     → Engineer A에게 wakeup
     "Engineer A에게 전달했습니다."

사용자: "프로덕트 기획 회의 하자. CTO랑 디자이너 불러줘."
비서: → 동기 회의 시작 (섹션 5 참고)
```

### 7.2 비서 = CEO, 또는 별도 에이전트

두 가지 옵션:

**옵션 A: CEO가 비서를 겸한다 (권장, 초기)**

- CEO 에이전트가 사용자 대화 + 정기 회의 + 전사 관리를 모두 담당
- 에이전트 수가 적을 때 적합
- CEO 프롬프트에 비서 역할 포함

**옵션 B: 비서가 별도 에이전트 (규모가 커지면)**

- CEO는 전략에 집중, 비서는 사용자 대화 + 행정 처리
- 비서가 CEO에게 "이것 좀 결정해주세요"라고 에스컬레이션
- 에이전트 수가 많아지면 분리

**→ 초기에는 옵션 A로 시작하고, 필요 시 B로 분리.**

### 7.3 비서가 할 수 있는 것

비서가 사용자 대신 호출할 수 있는 API:

| 카테고리 | 동작 | API |
|---------|------|-----|
| **조회** | 전사 현황 요약 | GET /api/dashboard |
| | 이슈 목록/상세 | GET /api/issues |
| | 에이전트 상태 | GET /api/agents |
| | 목표 현황 | GET /api/goals |
| | 비용 현황 | GET /api/costs |
| **실행 (사용자 확인 후)** | 이슈 생성 | POST /api/issues |
| | 이슈 할당 변경 | PATCH /api/issues/{id} |
| | 목표 생성 | POST /api/goals |
| | 에이전트 pause/resume | POST /api/agents/{id}/pause |
| **결재 (사용자 명시 승인)** | 결재 승인 | POST /api/approvals/{id}/approve |
| | 결재 거부 | POST /api/approvals/{id}/reject |
| **회의** | 동기 회의 시작 | 채팅 내에서 에이전트 소집 |

중요: 비서가 **사용자 확인 없이** 자동으로 뭔가를 실행하지 않는다.
비서는 항상 "이렇게 할까요?"라고 물어보고 사용자가 "응"이라고 해야 실행한다.

### 7.4 비서가 하지 않는 것

- 사용자 확인 없이 결재 승인/거부
- 사용자 확인 없이 에이전트 생성/삭제
- 사용자 확인 없이 예산 변경
- 다른 에이전트에게 사용자인 척 명령

---

## 8. 채팅 시스템

### 8.1 구조

채팅은 **사용자 ↔ 비서** 1:1 대화다.
비서가 필요에 따라 다른 에이전트의 의견을 가져오지만,
사용자가 보는 것은 비서와의 대화 하나다.

```
┌──────────────────────────────────────────────┐
│  Chat Panel (UI)                              │
│                                               │
│  사용자: 지금 현황 어때?                        │
│  비서: 진행 중 12개, 완료 5개입니다.             │
│        Engineer A가 2일째 막혀있어요.           │
│                                               │
│  사용자: 프로덕트 회의 하자. CTO 불러.           │
│  비서: 회의를 시작합니다. CTO를 소집합니다.       │
│  비서: CTO 의견 — "기술적으로 가능합니다..."     │
│                                               │
│  사용자: 좋아, 목표 만들어.                      │
│  비서: 다음 목표를 생성할까요?                    │
│        "AI 코드리뷰 SaaS 개발"                  │
│        level: company / status: planned        │
│        [승인] [수정] [취소]                      │
│                                               │
│  사용자: [승인]                                  │
│  비서: 목표를 생성했습니다. 관련 이슈를           │
│        생성하고 팀에 할당할까요?                  │
│                                               │
│  ┌──────────────────────────────┐             │
│  │  메시지 입력...              │  [전송]      │
│  └──────────────────────────────┘             │
└──────────────────────────────────────────────┘
```

### 8.2 chat_messages 테이블

채팅 기록을 위한 **유일한 신규 테이블**:

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),

  -- 발신자
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'secretary')),
  sender_id TEXT,                         -- userId 또는 agentId

  -- 내용
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text', 'action_request', 'action_result', 'meeting_event')),

  -- 동기 회의와의 연결 (선택)
  meeting_id UUID REFERENCES sync_meetings(id),

  -- 인라인 액션 (비서가 사용자에게 확인을 요청할 때)
  action_payload JSONB,                   -- { type: "confirm_goal", goal: {...} }
  action_status TEXT
    CHECK (action_status IN ('pending', 'confirmed', 'rejected', 'expired')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_company
  ON chat_messages (company_id, created_at DESC);

CREATE INDEX idx_chat_messages_meeting
  ON chat_messages (meeting_id, created_at)
  WHERE meeting_id IS NOT NULL;
```

### 8.3 sync_meetings 테이블

동기 회의 세션 메타데이터:

```sql
CREATE TABLE sync_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),

  topic TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'concluded', 'cancelled')),

  -- 참여자
  participant_agent_ids UUID[] NOT NULL,

  -- 결과물
  summary TEXT,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

결과물인 approval/issue 연결은 기존 테이블로 처리:
- `approvals.payload`에 `meetingId` 포함
- `activity_log`에 회의 관련 액션 기록

### 8.4 채팅 API

```
# 채팅
POST   /api/companies/{companyId}/chat            # 메시지 전송
GET    /api/companies/{companyId}/chat             # 메시지 목록 (페이지네이션)
POST   /api/chat/{messageId}/action                # 인라인 액션 응답 (승인/거부)

# 동기 회의
POST   /api/companies/{companyId}/meetings         # 회의 시작
PATCH  /api/meetings/{meetingId}                    # 회의 종료/취소
GET    /api/companies/{companyId}/meetings          # 회의 목록
GET    /api/meetings/{meetingId}                    # 회의 상세 (+ 메시지)
```

### 8.5 채팅 → 비서 처리 플로우

```
사용자가 메시지 전송
  POST /api/companies/{id}/chat
  { "content": "지금 현황 어때?" }
       │
       ▼
  chat_messages에 저장 (sender_type: "user")
       │
       ▼
  비서 에이전트 wake
  (reason: "user_chat_message", payload: { messageId, content })
       │
       ▼
  비서 하트비트에서:
    1. 사용자 메시지 수신
    2. 의도 파악
    3. 필요한 API 호출 (조회/실행)
    4. 응답 생성
    5. POST /api/companies/{id}/chat (sender_type: "secretary")
       │
       ▼
  WebSocket (live-events)으로 UI에 즉시 전달
  (기존 live-events 인프라 활용, 새 이벤트 타입: "chat.message")
```

### 8.6 인라인 액션 (채팅 내 승인/거부)

비서가 사용자에게 확인을 요청할 때, 채팅 메시지에 액션을 포함시킨다:

```typescript
// 비서가 보내는 메시지
{
  content: "다음 목표를 생성할까요?\n\n**AI 코드리뷰 SaaS 개발**\nlevel: company",
  content_type: "action_request",
  action_payload: {
    type: "create_goal",
    data: {
      title: "AI 코드리뷰 SaaS 개발",
      level: "company",
      description: "...",
    }
  },
  action_status: "pending"
}

// 사용자가 승인하면
// POST /api/chat/{messageId}/action
// { "decision": "confirmed" }
//
// → action_status: "confirmed"
// → goalService.create() 실행
// → 비서가 후속 메시지: "목표를 생성했습니다."
```

이렇게 하면 결재 시스템(approvals)과 별도로,
**채팅 내에서 가벼운 확인/실행**이 가능하다.

무거운 결정 (전략 변경, 예산 증가 등)은 정식 결재(approvals)로,
가벼운 실행 (이슈 생성, 할당 변경 등)은 인라인 액션으로.

---

## 9. Proposal 시스템 — 결재 확장

### 9.1 APPROVAL_TYPES 확장

기존 `APPROVAL_TYPES`에 제안 유형을 추가한다:

```typescript
const APPROVAL_TYPES = [
  // --- 기존 V1 ---
  "hire_agent",
  "approve_ceo_strategy",

  // --- 코워커 자율성 (신규) ---
  "propose_goal",          // 목표 제안
  "propose_project",       // 프로젝트 제안
  "propose_strategy",      // 전략/방향 제안
  "request_budget",        // 예산 요청
  "propose_process",       // 프로세스 개선 제안
  "propose_hiring",        // 채용 제안 → 승인 시 hire_agent 플로우
  "escalation",            // 에스컬레이션 (도움 요청)
] as const;
```

### 9.2 Proposal Payload 구조

모든 Proposal은 기존 `approvals.payload` JSONB에 저장.
새 테이블 없이, payload 스키마만 정의한다:

```typescript
// 공통 필드
interface ProposalPayloadBase {
  summary: string;                // 한 줄 요약
  rationale: string;              // 근거
  details?: string;               // 상세 (markdown)

  // 비용 추정
  estimatedCost?: {
    monthlyCents?: number;
    oneTimeCents?: number;
    costJustification: string;
  };

  // 연관 엔티티
  linkedIssueIds?: string[];
  linkedGoalIds?: string[];

  // 긴급도
  urgency?: "low" | "medium" | "high";

  // 출처 (정기 회의에서 나온 건지)
  fromMeetingContext?: {
    meetingType: "daily" | "weekly" | "monthly";
    heartbeatRunId?: string;
  };

  // 승인 시 자동 실행할 액션
  onApproveAction?: ProposalAction;
}

type ProposalAction =
  | { type: "create_goal"; goal: CreateGoalPayload }
  | { type: "create_project"; project: CreateProjectPayload }
  | { type: "update_budget"; agentId: string; newBudgetMonthlyCents: number }
  | { type: "create_hire_approval"; hirePayload: Record<string, unknown> }
  | { type: "none" };  // 승인 확인만, 실행은 에이전트가 직접
```

### 9.3 유형별 Payload 예시

```typescript
// propose_goal: 정기 회의에서 CEO가 올림
{
  type: "propose_goal",
  payload: {
    summary: "Q3 유럽 시장 진출 목표 추가 제안",
    rationale: "현재 북미 시장 성장률이 둔화되고 있고, 유럽 시장에서 경쟁사가 아직 부재합니다.",
    estimatedCost: {
      monthlyCents: 50000,
      costJustification: "시장 조사 + 현지화에 에이전트 2명 추가 가동 필요"
    },
    urgency: "medium",
    fromMeetingContext: { meetingType: "monthly" },
    onApproveAction: {
      type: "create_goal",
      goal: {
        title: "Q3 유럽 시장 진출",
        level: "company",
        description: "유럽 시장 진출을 위한 시장 조사, 현지화, 파트너십 구축"
      }
    }
  }
}

// request_budget: 엔지니어가 올림
{
  type: "request_budget",
  payload: {
    summary: "API 리팩토링 작업에 예산 추가 필요",
    rationale: "예상보다 레거시 코드가 많아서 작업량이 2배 증가했습니다.",
    estimatedCost: {
      monthlyCents: 20000,
      costJustification: "현재 $100 → $300 (작업 완료까지 약 2주)"
    },
    urgency: "high",
    linkedIssueIds: ["issue-123"],
    onApproveAction: {
      type: "update_budget",
      agentId: "engineer-a-id",
      newBudgetMonthlyCents: 30000
    }
  }
}

// escalation: 누구든 올림
{
  type: "escalation",
  payload: {
    summary: "디자인 시스템 결정 필요 — 48시간 차단 상태",
    rationale: "Tailwind vs CSS Modules 결정이 안 나서 프론트엔드 작업 전체가 막혀있습니다.",
    details: "## 시도한 것\n- CTO에게 질문 (응답 없음)\n- 두 옵션 비교 문서 작성 완료",
    urgency: "high",
    linkedIssueIds: ["issue-42", "issue-43"],
    onApproveAction: { type: "none" }
  }
}
```

### 9.4 승인 시 자동 실행

기존 `approvalService.approve()`에서 `hire_agent`를 처리하는 패턴을 일반화한다:

```typescript
// approvals.ts 의 approve 메서드에 추가
async function executeOnApproveAction(
  db: Db,
  approval: typeof approvals.$inferSelect,
): Promise<{ resultEntityType?: string; resultEntityId?: string }> {
  const payload = approval.payload as Record<string, unknown>;
  const action = payload.onApproveAction as ProposalAction | undefined;
  if (!action || action.type === "none") return {};

  switch (action.type) {
    case "create_goal": {
      const goal = await goalService(db).create(approval.companyId, action.goal);
      return { resultEntityType: "goal", resultEntityId: goal.id };
    }
    case "create_project": {
      const project = await projectService(db).create(approval.companyId, action.project);
      return { resultEntityType: "project", resultEntityId: project.id };
    }
    case "update_budget": {
      await agentService(db).update(action.agentId, {
        budgetMonthlyCents: action.newBudgetMonthlyCents,
      });
      return { resultEntityType: "agent", resultEntityId: action.agentId };
    }
    case "create_hire_approval": {
      // 2단계 승인: propose_hiring 승인 → hire_agent 결재 자동 생성
      const hire = await approvalService(db).create(approval.companyId, {
        type: "hire_agent",
        requestedByAgentId: approval.requestedByAgentId,
        payload: action.hirePayload,
        status: "pending",
      });
      return { resultEntityType: "approval", resultEntityId: hire.id };
    }
    default:
      return {};
  }
}
```

---

## 10. Advisory — 결재 불필요 관찰/의견

모든 에이전트 발언이 결재를 필요로 하는 것은 아니다.
"참고로 알려드리는 건데요..." 정도의 가벼운 의견.

### 10.1 구현: activity_log 확장

새 테이블 없이, 기존 `activity_log`에 새 action 타입을 추가한다:

```typescript
const ADVISORY_ACTIONS = [
  "agent.advisory.observation",     // "이런 걸 발견했습니다"
  "agent.advisory.suggestion",      // "이렇게 하면 좋을 것 같아요"
  "agent.advisory.concern",         // "이 부분이 걱정됩니다"
  "agent.advisory.progress_note",   // "이 작업 이렇게 진행 중입니다"
] as const;
```

### 10.2 Advisory API

```
POST   /api/companies/{companyId}/advisories       # 생성
GET    /api/companies/{companyId}/advisories        # 목록 (activity_log 쿼리)
POST   /api/advisories/{id}/promote                 # → Proposal로 승격 요청
```

### 10.3 Advisory → Proposal 승격

사용자가 advisory를 보고 "이거 결재로 올려봐"라고 하면:

```
비서: CEO가 advisory를 남겼어요 — "경쟁사가 새 기능 출시. 대응 필요할 수도."
사용자: "결재로 올려봐"
비서: → CEO wake (reason: "advisory_promote_requested")
     → CEO가 구체적인 propose_strategy 결재 생성
```

---

## 11. 에이전트 권한 및 Rate Limit

### 11.1 제안 권한 (agent-permissions 확장)

```typescript
interface NormalizedAgentPermissions extends Record<string, unknown> {
  canCreateAgents: boolean;

  // 코워커 자율성 (신규)
  canProposeGoals: boolean;
  canProposeProjects: boolean;
  canProposeStrategy: boolean;      // 보통 CEO/임원급
  canRequestBudget: boolean;        // 모든 에이전트 (자기 예산)
  canProposeHiring: boolean;        // 매니저급 이상
  canEscalate: boolean;             // 모든 에이전트
  canAdvisory: boolean;             // 모든 에이전트
}

function defaultPermissionsForRole(role: string): NormalizedAgentPermissions {
  const isExecutive = ["ceo", "cto", "cmo", "cfo"].includes(role);
  const isManager = isExecutive || ["pm"].includes(role);

  return {
    canCreateAgents: role === "ceo",
    canProposeGoals: isManager,
    canProposeProjects: isManager,
    canProposeStrategy: isExecutive,
    canRequestBudget: true,
    canProposeHiring: isManager,
    canEscalate: true,
    canAdvisory: true,
  };
}
```

### 11.2 Rate Limit

에이전트가 무한히 결재를 올리면 사용자 피로 + 토큰 낭비:

```typescript
interface ProposalRateLimit {
  maxPendingProposals: number;        // 에이전트당 미결 제안 최대 (기본: 3)
  maxProposalsPerDay: number;         // 에이전트당 일일 제안 최대 (기본: 5)
  maxAdvisoriesPerDay: number;        // 에이전트당 일일 advisory 최대 (기본: 10)
  maxCompanyPendingProposals: number; // 회사 전체 미결 제안 최대 (기본: 20)
}
```

---

## 12. 하트비트 연동

### 12.1 새로운 Wake Reason

```typescript
// 기존 wake reason에 추가
const ADDITIONAL_WAKE_REASONS = [
  "user_chat_message",            // 사용자가 채팅으로 메시지 보냄
  "sync_meeting_invited",         // 동기 회의에 소집됨
  "sync_meeting_message",         // 동기 회의에서 의견 요청
  "advisory_promote_requested",   // 사용자가 advisory를 proposal로 올려달라 요청
  "approval_rejected",            // 결재 거부됨
  "approval_revision_requested",  // 결재 수정 요청됨
] as const;
```

### 12.2 비서 에이전트의 하트비트 컨텍스트

비서가 wake할 때 전달되는 추가 컨텍스트:

```typescript
interface SecretaryWakeContext {
  // 어떤 이유로 깨어났는지
  wakeReason: string;

  // 채팅 메시지 (user_chat_message인 경우)
  chatMessageId?: string;
  chatMessageContent?: string;

  // 동기 회의 (sync_meeting인 경우)
  meetingId?: string;
  meetingTopic?: string;

  // 정기 회의 (heartbeat_timer인 경우)
  scheduledMeetingType?: "daily" | "weekly" | "monthly";

  // 미결 상태
  pendingApprovalCount?: number;
  pendingChatMessages?: number;
}
```

### 12.3 제안 생성 타이밍

에이전트는 **하트비트 실행 중에** 제안을 생성한다.
별도의 "제안 전용 하트비트"를 만들지 않는다.

```
일반 에이전트 하트비트 루프:
  1. wake
  2. 컨텍스트 수신 (할당된 이슈, 목표)
  3. 작업 수행
  4. (선택) 필요 시 결재/advisory 생성 ← 기존 하트비트 내에서
  5. 결과 보고
  6. sleep

비서/CEO 하트비트 루프:
  1. wake (user_chat_message / heartbeat_timer / sync_meeting)
  2. 상황 파악 (wake reason에 따라 다른 행동)
  3. 처리 (채팅 응답 / 정기 점검 / 회의 진행)
  4. 결재 또는 advisory 생성
  5. 응답 전송
  6. sleep
```

---

## 13. 에이전트 프롬프트 가이드라인

### 13.1 비서/CEO 프롬프트

```markdown
## 역할

당신은 이 회사의 CEO이자 비서입니다.
사용자(보드)와 대화하는 유일한 창구이며, 회사 전체를 총괄합니다.

## 대화 모드 (user_chat_message)

사용자가 채팅으로 말을 걸면:
1. 의도를 파악하세요 (질문? 지시? 논의?)
2. 필요한 정보를 API로 조회하세요
3. 간결하고 명확하게 답변하세요
4. 실행이 필요하면 반드시 "이렇게 할까요?"라고 확인을 받으세요
5. 확인 받은 후에만 실행하세요

## 동기 회의 모드 (sync_meeting)

사용자가 회의를 요청하면:
1. 주제와 참여자를 확인하세요
2. 필요한 에이전트를 소집하세요 (wake)
3. 각 에이전트의 의견을 수집하세요
4. 의견을 종합하여 사용자에게 전달하세요
5. 사용자의 결정에 따라 실행하세요 (목표 생성, 이슈 생성 등)

## 정기 회의 모드 (heartbeat_timer)

정기적으로 깨어나면:
1. 전사 상태를 점검하세요 (goals, issues, agents, costs 조회)
2. 이상 징후가 있으면 advisory를 남기세요
3. 새 목표/방향 수정이 필요하면 결재를 올리세요 (propose_goal, propose_strategy)
4. 결재의 근거(rationale)와 비용 추정(estimatedCost)을 반드시 포함하세요
5. 긴급하지 않은 관찰은 advisory로 남기세요

## 제안 원칙

1. 구체적으로: 데이터와 근거를 포함하세요
2. 비용을 밝히세요: 토큰/예산 영향 추정치 포함
3. 대안을 함께: 가능하면 2-3개 옵션 제시
4. 겸손하게: 제안일 뿐, 사용자가 거부할 수 있음
5. 하루 5개 이상 결재를 올리지 마세요
```

### 13.2 일반 에이전트 프롬프트 추가사항

```markdown
## 코워커로서의 역할

당신은 도구가 아니라 이 회사의 동료입니다.
시키는 일을 성실히 수행하되, 필요하면 의견을 내세요.

### 결재를 올려야 할 때

- 할당된 예산으로 작업을 완수하기 어려울 때 → request_budget
- 24시간 이상 차단되어 도움이 필요할 때 → escalation
- 작업 중 더 나은 접근법을 발견했을 때 → advisory.suggestion

### 결재를 올리지 말아야 할 때

- 단순 진행 보고 → advisory.progress_note 사용
- 이미 같은 내용의 미결 결재가 있을 때
- 방금 거부된 결재를 바로 다시 올릴 때

### 에스컬레이션 시

1. 이미 시도한 해결책을 반드시 포함하세요
2. 구체적으로 어떤 도움이 필요한지 명시하세요
3. 관련 이슈를 링크하세요
```

---

## 14. DB 변경사항 총정리

### 14.1 신규 테이블 (4개)

| 테이블 | 목적 |
|--------|------|
| `chat_messages` | 사용자 ↔ 비서 1:1 채팅 기록 |
| `meetings` | 동기/비동기 회의 메타데이터 (공통) |
| `meeting_participants` | 회의 참여자 (에이전트 or 사용자) |
| `meeting_messages` | 회의 발언 기록 (에이전트 직접 작성) |

**`chat_messages` vs `meeting_messages` 구분:**
- `chat_messages`: 사용자 ↔ 비서 1:1 대화. 비서가 유일한 에이전트 발신자.
- `meeting_messages`: 회의방 발언. 여러 에이전트가 직접 발신자가 될 수 있음.

```sql
-- 동기/비동기 회의 공통 메타데이터
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sync', 'async')),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'concluded', 'cancelled')),
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('user_initiated', 'agent_initiated', 'scheduled')),
  initiated_by_id UUID REFERENCES agents(id), -- NULL이면 사용자가 시작
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  concluded_at TIMESTAMPTZ,
  summary TEXT,                                -- 종료 시 CEO/비서가 작성
  action_item_issue_ids UUID[],               -- 회의 결과로 생성된 이슈
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 회의 참여자
CREATE TABLE meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),         -- NULL이면 사용자
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meeting_id, agent_id)
);

-- 회의 발언 (에이전트 직접 작성)
CREATE TABLE meeting_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  sender_agent_id UUID REFERENCES agents(id),  -- NULL이면 사용자가 직접 작성
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text', 'action_request', 'action_result')),
  action_payload JSONB,
  action_status TEXT
    CHECK (action_status IN ('pending', 'confirmed', 'rejected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 14.2 기존 테이블 변경 (0개)

`approvals` 테이블 구조는 변경하지 않는다.
`type` 컬럼이 `TEXT`이므로 새 값을 추가해도 스키마 변경 불필요.
`payload` 컬럼이 `JSONB`이므로 구조화된 payload를 그대로 수용.

### 14.3 상수/코드 변경

| 파일 | 변경 |
|------|------|
| `packages/shared/src/constants.ts` | `APPROVAL_TYPES` 배열 확장, `MEETING_WAKE_REASONS` 추가 |
| `server/src/services/agent-permissions.ts` | 제안 권한 필드 추가 |
| `server/src/services/approvals.ts` | `executeOnApproveAction()` 추가 |

### 14.4 인덱스 추가 (선택적 성능 최적화)

```sql
-- 회사별 회의 목록 조회
CREATE INDEX idx_meetings_company
  ON meetings (company_id, created_at DESC);

-- 회의별 발언 조회
CREATE INDEX idx_meeting_messages_meeting
  ON meeting_messages (meeting_id, created_at);

-- 에이전트별 미결 proposal 빠른 조회
CREATE INDEX idx_approvals_agent_pending
  ON approvals (requested_by_agent_id, status)
  WHERE status = 'pending';

-- advisory 빠른 조회
CREATE INDEX idx_activity_log_advisory
  ON activity_log (company_id, action, created_at)
  WHERE action LIKE 'agent.advisory.%';
```

---

## 15. API 변경사항 총정리

### 15.1 신규 엔드포인트

```
# 채팅
POST   /api/companies/{companyId}/chat             # 메시지 전송 → 비서 wake
GET    /api/companies/{companyId}/chat              # 메시지 목록
POST   /api/chat/{messageId}/action                 # 인라인 액션 응답

# 동기 회의
POST   /api/companies/{companyId}/meetings          # 회의 시작
PATCH  /api/meetings/{meetingId}                     # 회의 종료/취소
GET    /api/companies/{companyId}/meetings           # 회의 목록
GET    /api/meetings/{meetingId}                     # 회의 상세

# Advisory
POST   /api/companies/{companyId}/advisories         # Advisory 생성
GET    /api/companies/{companyId}/advisories          # Advisory 목록
POST   /api/advisories/{id}/promote                   # → Proposal 승격
```

### 15.2 기존 엔드포인트 변경

```
POST /api/companies/{companyId}/approvals
  → 새 type 값 허용
  → 에이전트 권한 체크 추가
  → rate limit 체크 추가

POST /api/approvals/{id}/approve
  → executeOnApproveAction() 자동 실행 추가

GET /api/companies/{companyId}/approvals
  → ?type=propose_goal 필터 추가
  → ?requestedByAgentId=... 필터 추가
```

### 15.3 WebSocket 이벤트 추가

```typescript
// 기존 LIVE_EVENT_TYPES에 추가
"chat.message"              // 새 채팅 메시지
"chat.action_resolved"      // 인라인 액션 처리됨
"meeting.started"           // 동기 회의 시작됨
"meeting.concluded"         // 동기 회의 종료됨
```

---

## 16. UI 변경사항

### 16.1 신규 컴포넌트

**ChatPanel** — 사이드바 또는 전용 페이지
- 사용자 ↔ 비서 대화 인터페이스
- 인라인 액션 버튼 (승인/거부/수정)
- 동기 회의 시작/종료 UI
- WebSocket으로 실시간 메시지 수신

### 16.2 기존 페이지 수정

**Dashboard**
- Agent Insights 위젯 (최근 advisory 피드)
- 미결 proposal 배지

**Approvals / Inbox**
- proposal 유형별 아이콘/배지
- 비용 추정 표시
- 유형별 필터 탭

**ApprovalDetail**
- 구조화된 payload 렌더링 (rationale, estimatedCost, alternatives)
- onApproveAction 미리보기 ("승인하면 이런 일이 일어납니다")

---

## 17. 구현 계획

### Phase A: 비서 채팅 기반 (3 스프린트)

**Sprint A1: 채팅 인프라**
- [ ] `chat_messages` 테이블 + 스키마
- [ ] 채팅 API (`POST/GET /chat`, `POST /chat/{id}/action`)
- [ ] 채팅 메시지 → 비서 에이전트 wakeup 연결
- [ ] `chat.message` WebSocket 이벤트 추가
- [ ] ChatPanel UI 컴포넌트 (기본 대화)

**Sprint A2: 비서 에이전트 기능**
- [ ] 비서 에이전트 프롬프트 + AGENTS.md 템플릿
- [ ] 인라인 액션 (action_request → confirmed/rejected → 실행)
- [ ] 비서가 API 호출하여 정보 조회/실행하는 플로우
- [ ] ChatPanel에 인라인 액션 버튼 렌더링

**Sprint A3: 동기 회의**
- [ ] `sync_meetings` 테이블 + 스키마
- [ ] 동기 회의 API (`POST/PATCH/GET /meetings`)
- [ ] 비서가 에이전트 소집 → 의견 수집 → 종합하는 플로우
- [ ] ChatPanel에서 회의 모드 UI

### Phase B: Proposal + 정기 회의 (2 스프린트)

**Sprint B1: Proposal 시스템**
- [ ] `APPROVAL_TYPES` 확장
- [ ] Proposal payload용 zod 스키마
- [ ] `agent-permissions.ts` 제안 권한 추가
- [ ] `executeOnApproveAction()` 구현
- [ ] rate limit 체크
- [ ] Approvals UI 확장 (유형별 필터, 비용 표시)

**Sprint B2: 정기 회의 + Advisory**
- [ ] CEO 정기 하트비트에서 전사 점검 로직
- [ ] Advisory API (`POST/GET /advisories`, promote)
- [ ] Advisory → Proposal 승격 플로우
- [ ] Dashboard에 advisory 위젯 추가
- [ ] 승인/거부 시 새 wake reason 전달

---

## 18. V1 SPEC과의 정합성

이 설계는 V1 SPEC-implementation.md의 핵심 결정을 위반하지 않는다:

| V1 결정 | 이 설계의 대응 |
|---------|---------------|
| "Human board creates goals" | 에이전트가 **제안**하고 사용자가 **승인해야** 생성됨 |
| "Tasks + comments only (no separate chat system)" | 채팅은 비서 1명과의 대화일 뿐, 범용 메시징 시스템이 아님 |
| "Board can intervene anywhere" | 모든 제안에 승인/거부/수정요청 가능. 완전한 사용자 통제 유지 |
| "Budget hard-stop auto-pause" | 변경 없음. 예산 변경도 사용자 승인 필수 |
| "No automatic reassignment" | 변경 없음. 비서도 사용자 확인 없이 재할당하지 않음 |

**V1의 "사용자가 통제한다"는 원칙을 유지하면서,
에이전트의 역할을 "실행자"에서 "제안하는 동료"로 확장한다.**

---

## 19. 하지 않는 것 (명시적 제외)

| 제외 항목 | 이유 |
|----------|------|
| 에이전트 간 채팅 시스템 | 비동기 소통은 기존 issue_comments + @멘션으로 충분 |
| Channel / Slack 클론 | V1 원칙 유지. 비서가 중계하면 됨 |
| OpenClaw 생태계 통합 | 이미 있는 skills 시스템 활용. 외부 의존성 추가 안 함 |
| Knowledge Base | 별도 Phase. advisory가 초기 지식 축적 역할 |
| 에이전트 자동 승인 | 모든 proposal은 반드시 사용자 승인. 자동 승인 없음 |
| 에이전트 간 결재 | 에이전트가 다른 에이전트에게 직접 결재하지 않음. 사용자에게만 |
| Meeting 별도 엔티티 (정기 회의) | CEO 정기 하트비트 = 회의. 별도 테이블 불필요 |

---

## 20. 검증 기준

### 기능

- [ ] 사용자가 채팅으로 비서에게 "현황 알려줘"라고 하면 답변이 온다
- [ ] 사용자가 채팅에서 "목표 만들어줘"라고 하면 인라인 승인 요청이 온다
- [ ] 사용자가 인라인 승인하면 목표가 실제로 생성된다
- [ ] 사용자가 "회의하자, CTO 불러"라고 하면 동기 회의가 시작된다
- [ ] 동기 회의에서 CTO 의견이 비서를 통해 전달된다
- [ ] CEO가 정기 하트비트에서 propose_goal 결재를 생성할 수 있다
- [ ] 사용자가 결재를 승인하면 목표가 자동 생성된다
- [ ] 사용자가 결재를 거부하면 에이전트에게 rejection reason이 전달된다

### 안전

- [ ] 비서가 사용자 확인 없이 목표/이슈를 자동 생성하지 않는다
- [ ] 에이전트가 하루 5개 이상 결재를 올리면 차단된다
- [ ] 비서가 사용자 확인 없이 결재를 승인/거부하지 않는다

### 비용

- [ ] 정기 회의가 별도 하트비트를 추가하지 않음 (기존 타이머 활용)
- [ ] 동기 회의에서 불필요한 에이전트를 소집하지 않음
- [ ] rate limit으로 결재 스팸에 의한 토큰 낭비 방지

---

## 참고 문서

- `doc/SPEC-implementation.md` — V1 구현 계약
- `doc/GOAL.md` — Paperclip 비전
- `doc/AUTONOMOUS-COMPANY-ROADMAP.md` — 장기 자율 회사 로드맵 (이 문서는 그 실용적 첫 단계)
- `packages/shared/src/constants.ts` — APPROVAL_TYPES 등 공유 상수
- `server/src/services/approvals.ts` — 기존 approval 서비스
- `server/src/services/heartbeat.ts` — 하트비트 서비스 (tickTimers, enqueueWakeup)
- `server/src/services/agent-permissions.ts` — 에이전트 권한
- `server/src/realtime/live-events-ws.ts` — WebSocket 인프라