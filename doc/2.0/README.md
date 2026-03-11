# Paperclip 2.0 — 병렬 작업 Overview

> 이 디렉토리는 세 개의 Claude Code 에이전트가 병렬로 작업할 수 있도록
> 작업 범위를 분리한 계획서 모음이다.

---

## 작업 파일 목록

| 파일 | 담당 에이전트 | 핵심 범위 |
|------|-------------|----------|
| `AGENT-3-SHARED-CONTRACTS.md` | **Agent 3** | `packages/shared/` 타입·상수·검증기, 에이전트 권한, Rate Limit |
| `AGENT-1-DB-BACKEND.md` | **Agent 1** | DB 스키마·마이그레이션, 서버 API, WebSocket, 하트비트 연동 |
| `AGENT-2-FRONTEND-UI.md` | **Agent 2** | UI 컴포넌트, 페이지, API 클라이언트, 어댑터/모델 선택 UI |

---

## 실행 순서

```
[Agent 3] packages/shared 먼저 완료
        │
        ├──────────────────────┐
        ▼                      ▼
[Agent 1] DB/Backend     [Agent 2] Frontend
(Agent 3 타입 import)    (Agent 3 타입 import)
        │                      │
        └──────────┬───────────┘
                   ▼
             pnpm -r typecheck
             pnpm build
             pnpm test:run
```

Agent 1과 Agent 2는 서로 다른 디렉토리를 건드리므로 **Git 충돌이 발생하지 않는다.**
Agent 3이 완료되기 전에도 컴포넌트 골격과 스키마 작성을 먼저 진행할 수 있다.

---

## 각 에이전트의 담당 디렉토리

```
Agent 3 (Shared):
  packages/shared/src/constants.ts       ← APPROVAL_TYPES 등 상수 확장
  packages/shared/src/types.ts           ← Meeting, ChatMessage 등 공유 타입
  packages/shared/src/validators/        ← Zod 검증기 (proposal, meeting, chat)
  packages/shared/src/role-model-defaults.ts  ← 역할별 기본 모델 매핑 (신규)
  packages/shared/src/api-paths.ts       ← API 경로 상수 (신규)
  packages/shared/src/index.ts           ← re-export 추가
  server/src/services/agent-permissions.ts  ← 제안 권한 필드 추가

Agent 1 (DB/Backend):
  packages/db/src/schema/meetings.ts     ← meetings, meeting_participants, meeting_messages (신규)
  packages/db/src/schema/chat.ts         ← chat_messages (신규)
  packages/db/src/schema/index.ts        ← 새 테이블 export 추가
  packages/db/drizzle/migrations/        ← 생성된 마이그레이션 파일
  server/src/services/meetings.ts        ← 회의 서비스 (신규)
  server/src/services/chat.ts            ← 채팅 서비스 (신규)
  server/src/services/advisory.ts        ← Advisory 서비스 (신규)
  server/src/services/approvals.ts       ← executeOnApproveAction 추가 (기존 확장)
  server/src/routes/meetings.ts          ← 회의 라우트 (신규)
  server/src/routes/chat.ts              ← 채팅 라우트 (신규)
  server/src/routes/advisories.ts        ← Advisory 라우트 (신규)
  server/src/lib/live-events.ts          ← WebSocket 이벤트 타입 추가 (기존 확장)

Agent 2 (Frontend):
  ui/src/api/meetings.ts                 ← 회의 API 클라이언트 (신규)
  ui/src/api/chat.ts                     ← 채팅 API 클라이언트 (신규)
  ui/src/api/advisories.ts              ← Advisory API 클라이언트 (신규)
  ui/src/api/adapters.ts                 ← 모델 목록 API 추가 (신규/기존 확장)
  ui/src/hooks/useLiveEvents.ts          ← 회의/채팅 WebSocket 훅 (신규/기존 확장)
  ui/src/components/chat/               ← ChatMessage, ChatPanel (신규)
  ui/src/components/meeting/            ← MeetingMessage, MeetingRoom (신규)
  ui/src/components/approvals/          ← ProposalCard (신규)
  ui/src/components/dashboard/          ← AdvisoryFeed (신규)
  ui/src/components/agents/             ← AgentAdapterSelector, OpenCodeModelSelector (신규)
  ui/src/pages/ChatPage.tsx             ← 비서 채팅 페이지 (신규)
  ui/src/pages/MeetingsPage.tsx         ← 회의 목록+회의방 페이지 (신규)
  ui/src/pages/ApprovalsPage.tsx        ← Proposal 필터·ProposalCard 통합 (기존 확장)
  ui/src/pages/DashboardPage.tsx        ← Advisory 위젯, 미결 배지 (기존 확장)
  ui/src/pages/AgentFormPage.tsx        ← 어댑터/모델 선택 통합 (기존 확장)
```

---

## 겹치지 않는 경계 — 충돌 방지 규칙

| 규칙 | 내용 |
|------|------|
| **Agent 1은 `ui/`를 건드리지 않는다** | UI는 Agent 2 전담 |
| **Agent 2는 `packages/db/`, `server/`를 건드리지 않는다** | 백엔드는 Agent 1 전담 |
| **Agent 3은 `packages/shared/`와 `server/src/services/agent-permissions.ts`만 수정한다** | 스키마·라우트 수정은 Agent 1 |
| **기존 파일 수정 시 기존 코드를 제거하지 않는다** | 추가(additive)만 허용 |
| **마이그레이션 파일은 Agent 1만 생성한다** | `pnpm db:generate`는 Agent 1이 실행 |

---

## 완료 확인 명령

모든 에이전트 작업 완료 후 아래를 순서대로 실행한다:

```sh
# 1. 타입 검사 (세 에이전트 작업 모두 포함)
pnpm -r typecheck

# 2. 전체 빌드
pnpm build

# 3. 테스트
pnpm test:run
```

세 명령이 모두 통과하면 이번 작업이 완료된 것이다.

---

## 배경 문서

이 작업의 전체 설계 배경은 아래 문서에서 확인한다:

- `doc/COWORKER-AUTONOMY.md` — 비서·채팅·Proposal·Advisory 상세 설계 (정본)
- `doc/AUTONOMOUS-COMPANY-ROADMAP.md` — Phase 1~5 장기 로드맵
- `doc/ROLE_BASED_MODEL_ASSIGNMENT.md` — 어댑터/모델 선택 시스템 (정본)
- `doc/SPEC-implementation.md` — V1 컨트랙트 (이 작업의 기반)
- `doc/AGENTS.md` — 기여 규칙 (반드시 읽을 것)