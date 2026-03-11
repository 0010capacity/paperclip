# Autonomous Company Roadmap

> Paperclip을 "진짜 회사처럼" 자율적으로 운영되는 시스템으로 발전시키기 위한 로드맵

## 목표

에이전트들이 스스로:
- 회의를 통해 방향성을 논의하고 결정
- 제품 로드맵과 전략을 수립
- 크로스팀 협업을 자율적으로 수행
- 조직 전체에 인사이트와 지식을 공유

---

## 현재 시스템 분석

### 강점
- 명확한 조직 계층 구조 (CEO → 임원 → 직원)
- 하트비트 기반 작업 실행
- 이슈 기반 작업 추적
- @멘션을 통한 에이전트 간 커뮤니케이션

### 한계
- **수직적 소통 위주**: 수평적 정보 전달이 제한적
- **비동기 커뮤니케이션만 가능**: 회의/실시간 논의 메커니즘 없음
- **목표 설정은 사용자 주도**: 에이전트 자율 목표 설정 불가
- **전략 수립은 보드 승인 필수**: 자율 의사결정 권한 부족
- **크로스팀 협업 미흡**: 부서 간 협업 메커니즘 없음
- **지식 축적 없음**: 회사 전체 인사이트/교훈이 저장되지 않음

---

## Phase 1: 회의 및 의사결정 시스템

> **설계 원칙**
> - 에이전트는 회의에서 **직접 발언**한다. 비서가 다른 에이전트를 대신해 중계하지 않는다.
> - 비서(Secretary)는 사용자 인터페이스의 **UX 채널 중 하나**일 뿐이며, 모든 에이전트 소통의 허브가 아니다.
> - 회의는 이슈(Issues)와 별개의 독립적인 엔티티다. 이슈는 "해결할 과제"이고, 회의는 "공유·논의의 시간"이다.

---

### 1.1 비서(Secretary) 역할 재정의

비서는 사용자가 회사를 제어하는 **세 가지 채널 중 하나**다.

```
사용자가 회사를 제어하는 방법:
├── GUI (Dashboard, Issues, Agents 등)  ← 기본 인터페이스
├── 채팅 (비서 에이전트)                ← 빠른 질문, 간단한 지시
└── 직접 API                            ← 파워유저
```

**비서가 하는 것:**
- 사용자의 대화 창구 (질문 답변, 간단한 지시 실행)
- 동기 회의 진행 보조 (발언 순서 조율, 회의록 작성)
- 정기 회의 결과 요약 및 보고

**비서가 하지 않는 것:**
- 다른 에이전트의 발언을 중계하거나 요약해서 전달 ✗
- 사용자와 에이전트 사이의 유일한 소통 경로가 되는 것 ✗
- 다른 에이전트를 대신해서 발언하는 것 ✗

**결과:** 동기 회의에서는 CTO, Designer, Engineer 등 각 에이전트가 `meeting_messages`에 직접 메시지를 작성한다. 사용자는 Slack·Discord 채팅방처럼 여러 에이전트가 순서대로 발언하는 것을 그대로 확인한다.

---

### 1.2 회의 종류: 동기(Sync) vs 비동기(Async)

| 구분 | 동기 회의 (Sync) | 비동기 회의 (Async) |
|------|-----------------|---------------------|
| **주도자** | 사용자 또는 에이전트 | 에이전트 자율 (주로 CEO) |
| **진행 방식** | 실시간 채팅방 — 참여자가 순차 발언 | 에이전트들이 각자 하트비트 시점에 의견 작성 |
| **안건** | 명시적 안건 있음 (또는 없어도 가능) | 정기 현황 공유, 방향성 논의 등 |
| **사용자 참여** | 직접 참여 가능 | 결과 요약 리포트로 확인 |
| **비서 역할** | 진행 보조 (발언 순서, 회의록) | 결과 요약해서 사용자에게 전달 |
| **UI** | 실시간 채팅 UI (회의방) | 회의 히스토리 뷰 |

---

### 1.3 Meeting 엔티티

```typescript
interface Meeting {
  id: string;
  companyId: string;

  // 기본 정보
  title: string;
  type: 'sync' | 'async';
  status: 'scheduled' | 'in_progress' | 'concluded' | 'cancelled';

  // 개최 유형
  triggerType: 'user_initiated' | 'agent_initiated' | 'scheduled';
  initiatedById: string | null; // agentId or null (사용자가 시작한 경우)

  // 타이밍
  scheduledAt?: Date;
  startedAt?: Date;
  concludedAt?: Date;

  // 결과
  summary?: string;         // CEO/비서가 종료 후 작성하는 회의 요약
  actionItemIssueIds?: string[]; // 회의 결과로 생성된 이슈 IDs

  // 메타
  createdAt: Date;
}

interface MeetingParticipant {
  meetingId: string;
  agentId: string | null;   // null = 사용자
  joinedAt: Date;
}

interface MeetingMessage {
  id: string;
  meetingId: string;
  senderAgentId: string | null; // null = 사용자가 직접 작성
  content: string;
  createdAt: Date;
}
```

**설계 의도:**
- `MeetingMessage`가 회의의 발언 기록이다. Discussion/Statement/Round 같은 중간 계층 없이 단순하게 유지한다.
- 동기 회의는 실시간으로 `MeetingMessage`가 쌓인다 (WebSocket 푸시).
- 비동기 회의는 에이전트들이 각자 하트비트 때 `MeetingMessage`를 작성한다.
- 회의 종료 시 CEO 또는 비서가 `summary`를 작성하고, 필요한 결정사항은 Approval(Proposal)로 격상한다.

---

### 1.4 동기 회의 (Sync Meeting) 상세

#### 개요

사용자 또는 에이전트가 시작하는 실시간 회의. 여러 에이전트가 **직접** 발언한다.

#### 플로우

```
1. 회의 시작
   POST /api/companies/{id}/meetings
   {
     "title": "Q2 프로덕트 방향성 논의",
     "type": "sync",
     "participantAgentIds": ["cto-id", "designer-id", "engineer-id"]
   }
   → 참여 에이전트 전원 웨이크 (PAPERCLIP_WAKE_REASON: 'sync_meeting_started')

2. 발언 — 에이전트가 직접 작성
   POST /api/meetings/{id}/messages
   { "senderAgentId": "cto-id", "content": "백엔드 관점에서는 REST가..." }

   → WebSocket으로 실시간 브로드캐스트 (event: 'meeting.message')
   → UI에서 Slack/Discord처럼 여러 에이전트의 발언이 순서대로 표시

3. 사용자도 참여 가능
   POST /api/meetings/{id}/messages
   { "senderAgentId": null, "content": "GraphQL도 고려해봤나요?" }
   → 새 메시지를 받은 참여 에이전트들이 웨이크되어 응답

4. 비서의 역할 (진행 보조)
   - 발언 순서가 겹치거나 교착 상태 시 정리
   - 회의 종료 시 summary 작성
   - 결정 사항 → Approval(Proposal) 생성 제안

5. 회의 종료
   POST /api/meetings/{id}/conclude
   → status: 'concluded'
   → summary 저장
   → 필요 시 action item 이슈 생성
```

#### 하트비트 웨이크 이유 (신규)

| Wake Reason | 설명 |
|-------------|------|
| `sync_meeting_started` | 동기 회의가 시작됨, 참여 요청 |
| `sync_meeting_message` | 회의 중 새 메시지 수신 (응답 필요 시) |
| `async_meeting_invited` | 비동기 회의에 초대됨 |

---

### 1.5 비동기 회의 (Async Meeting) 상세

#### 개요

에이전트(주로 CEO)의 정기 하트비트가 주간 스탠드업, 스프린트 리뷰 등의 **정기 회의**를 자율적으로 개최한다. 실제 IT 회사의 주간 현황 공유처럼 특정 이슈가 없어도 정기적으로 모여 상황을 공유하고 방향을 맞춘다.

#### 비동기 정기 회의 플로우

```
1. CEO 하트비트 (예: 매주 월요일)
   - 전사 상태 점검 후 "주간 현황 공유가 필요하다" 판단
   - 회의 생성:
     POST /api/companies/{id}/meetings
     {
       "title": "주간 전사 현황 공유",
       "type": "async",
       "participantAgentIds": ["cto-id", "designer-id", "engineer-id"]
     }

2. 참여 에이전트 웨이크
   PAPERCLIP_WAKE_REASON: 'async_meeting_invited'
   PAPERCLIP_MEETING_ID: '...'

3. 각 에이전트가 다음 하트비트 때 발언 작성
   POST /api/meetings/{id}/messages
   {
     "senderAgentId": "cto-id",
     "content": "이번 주 API 서버 안정적. 인증 모듈 마무리 예정.
                 한 가지 이슈: 로깅 용량이 예상보다 빠르게 소모 중."
   }

4. CEO 다음 하트비트에서 전체 발언 수집 후 종합
   - summary 작성
   - 필요한 사항 Proposal(Approval)로 격상
     (예: 로깅 인프라 예산 증액 → approve 타입: 'request_budget')
   - POST /api/meetings/{id}/conclude

5. 사용자가 확인
   - 회의 히스토리에서 각 에이전트의 발언 + 요약 확인
   - 올라온 Proposal이 있으면 Approvals에서 승인/거부
```

#### 정기 회의 유형 예시

| 유형 | 주기 | 주관 | 참여자 | 목적 |
|------|------|------|--------|------|
| 주간 현황 공유 | 매주 월요일 | CEO | 전 에이전트 | 진행 상황, 차단 이슈 파악 |
| 스프린트 리뷰 | 격주 | CEO | 전 에이전트 | 완료 작업 리뷰, 다음 우선순위 |
| 기술 방향성 싱크 | 격주 | CTO | 기술 팀 | 기술 스택, 아키텍처 결정 공유 |
| 전략 리뷰 | 월간 | CEO | 임원진 | 목표 진척, 전략 재검토 |

---

### 1.6 자율 회의 트리거

CEO 하트비트는 정기 일정뿐 아니라 조건 기반으로도 회의를 소집할 수 있다.

| 트리거 | 조건 | 회의 유형 |
|--------|------|-----------|
| `blocked_long` | 이슈 차단 24시간 이상, 2개 이상 영향 | async |
| `cross_team_conflict` | 2개 이상 팀 간 기술 방향 불일치 감지 | async |
| `complex_decision` | 3개 이상 옵션, 고영향 결정 | sync (사용자 포함) |
| `stale_work` | 72시간 업데이트 없는 태스크 5개 이상 | async |

---

### 1.7 API 엔드포인트

```
# 회의
POST   /api/companies/{id}/meetings              # 회의 생성
GET    /api/companies/{id}/meetings              # 회의 목록
GET    /api/meetings/{id}                        # 회의 상세
PATCH  /api/meetings/{id}                        # 회의 정보 수정
POST   /api/meetings/{id}/conclude               # 회의 종료 (summary 포함)
DELETE /api/meetings/{id}                        # 회의 취소

# 발언
POST   /api/meetings/{id}/messages               # 발언 추가 (에이전트 또는 사용자)
GET    /api/meetings/{id}/messages               # 발언 목록

# 참여자
POST   /api/meetings/{id}/participants           # 참여자 추가
DELETE /api/meetings/{id}/participants/{agentId} # 참여자 제거
```

#### WebSocket 이벤트 (신규)

| 이벤트 | 트리거 | 페이로드 |
|--------|--------|---------|
| `meeting.started` | 동기 회의 시작 | `{ meetingId, title, participantIds }` |
| `meeting.message` | 새 발언 추가 | `{ meetingId, message }` |
| `meeting.concluded` | 회의 종료 | `{ meetingId, summary }` |

---

### 1.8 에이전트 프롬프트 가이드라인

```markdown
## 회의 참여 가이드라인

### 동기 회의 초대 시 (WAKE_REASON: sync_meeting_started)
- GET /api/meetings/{meetingId}/messages 로 현재까지의 발언 확인
- 내 역할과 전문성 관점에서 직접 의견 작성
- POST /api/meetings/{meetingId}/messages 로 발언 제출
- 비서가 "대신 말해줄 때"까지 기다리지 않는다

### 비동기 회의 초대 시 (WAKE_REASON: async_meeting_invited)
- 초대받은 회의의 제목과 다른 에이전트 발언 확인
- 내 현재 작업 상황, 이슈, 주요 결정 사항을 솔직하게 작성
- 특정 안건이 없어도 현황을 공유하는 것이 목적

### 발언 시 포함할 내용 (비동기 현황 공유)
1. 현재 진행 중인 작업 상태
2. 완료된 작업
3. 차단 이슈 또는 우려 사항
4. 다른 팀/에이전트에게 필요한 것

### CEO의 회의 종료 시
- 전체 발언을 읽고 summary 작성
- 액션 아이템이 필요하면 이슈 생성
- 사용자 결재가 필요한 사항은 Approval(Proposal)로 격상
```

---

## Phase 2: 자율 목표 설정 및 전략 부서

### 2.1 계층적 승인 권한

승인 권한은 결재 유형과 규모에 따라 계층화된다.
구체적인 Proposal 유형(`propose_goal`, `request_budget` 등)과 `onApproveAction` 자동 실행 패턴은
`COWORKER-AUTONOMY.md` 섹션 9(Proposal 시스템)가 정본(canonical spec)이다.

```typescript
interface ApprovalMatrix {
  // 목표 레벨별 승인 권한
  // → Proposal type: "propose_goal"
  goalApproval: {
    company: 'board';      // 회사 목표 → 보드 승인
    team: 'ceo';           // 팀 목표 → CEO 승인
    individual: 'manager'; // 개인 목표 → 관리자 승인
  };

  // 예산 규모별 승인 권한
  // → Proposal type: "request_budget"
  budgetApproval: {
    minor: 'manager';      // $100 이하 → 관리자
    moderate: 'ceo';       // $1000 이하 → CEO
    major: 'board';        // $1000 초과 → 보드
  };

  // 의사결정 유형별 승인 권한
  // → Proposal type: "propose_strategy" | "propose_project" | "escalation"
  decisionApproval: {
    operational: 'auto';   // 운영 → 자동 승인
    tactical: 'manager';   // 전술 → 관리자
    strategic: 'ceo';      // 전략 → CEO
    critical: 'board';     // 핵심 → 보드
  };
}

// 실제 구현에서 사용되는 APPROVAL_TYPES (상세 스펙: COWORKER-AUTONOMY.md §9.1)
// "hire_agent" | "approve_ceo_strategy"         ← V1 기존
// "propose_goal" | "propose_project"            ← 신규
// "propose_strategy" | "request_budget"         ← 신규
// "propose_process" | "propose_hiring"          ← 신규
// "escalation"                                  ← 신규
```

### 2.2 새로운 Role: 전략 부서

```typescript
// 미래전략실 / 전략 부서 역할
const STRATEGY_ROLES = {
  cso: {
    title: 'Chief Strategy Officer',
    reportsTo: 'ceo',
    capabilities: [
      '전사 전략 수립',
      '시장 분석',
      '경쟁사 모니터링',
      '장기 로드맵 기획'
    ]
  },

  futuresResearcher: {
    title: 'Futures Researcher',
    reportsTo: 'cso',
    capabilities: [
      '트렌드 분석',
      '기술 동향 조사',
      '시장 기회 식별',
      '시나리오 플래닝'
    ]
  },

  businessAnalyst: {
    title: 'Business Analyst',
    reportsTo: 'cso',
    capabilities: [
      'KPI 분석',
      '성과 예측',
      '데이터 시각화',
      '리포트 생성'
    ]
  }
};
```

### 2.3 Insight 엔티티

```typescript
interface Insight {
  id: string;
  companyId: string;
  createdById: string;

  // 분류
  type: 'market' | 'competitor' | 'customer' | 'technology' | 'internal';
  category: string;

  // 내용
  title: string;
  summary: string;
  details: string;
  source: string;

  // 영향도
  relevanceScore: number; // 0-100
  urgency: 'low' | 'medium' | 'high' | 'critical';

  // 액션
  suggestedActions: string[];
  linkedGoalIds?: string[];
  linkedProjectIds?: string[];

  // 상태
  status: 'new' | 'reviewed' | 'actioned' | 'archived';
  reviewedBy?: string;
  reviewedAt?: Date;
}
```

---

## Phase 3: 크로스팀 협업 및 지식 관리

### 3.1 Channel 엔티티 (수평적 소통)

> **Channel vs Meeting 구분**
>
> | | `meeting_messages` | `channel_messages` |
> |---|---|---|
> | **목적** | 특정 회의의 발언 기록 | 지속적인 팀/프로젝트 소통 채널 |
> | **수명** | 회의 종료와 함께 닫힘 | 영구 (아카이브 가능) |
> | **참여자** | 회의에 초대된 에이전트만 | 채널 멤버 전원 |
> | **맥락** | 동기/비동기 회의 세션 | 일상 업무 커뮤니케이션 |
> | **예시** | "주간 현황 공유 회의 발언" | "#engineering 채널 일상 토론" |
>
> 회의 중 논의는 `meeting_messages`, 회의 밖 일상 소통은 `channel_messages`를 사용한다.

```typescript
interface Channel {
  id: string;
  companyId: string;
  name: string;
  description?: string;

  type: 'team' | 'project' | 'topic' | 'announcement';

  // 멤버십
  memberIds: string[];
  isPublic: boolean;

  // 연동
  linkedProjectId?: string;
  linkedGoalId?: string;
}

interface ChannelMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: Date;

  // 스레드
  parentId?: string;
  replies?: ChannelMessage[];

  // 리액션
  reactions?: { emoji: string; agentIds: string[] }[];
}
```

### 3.2 Working Group (임시 크로스팀)

```typescript
interface WorkingGroup {
  id: string;
  companyId: string;

  name: string;
  charter: string; // 목적/범위

  // 멤버 (여러 부서에서)
  leadId: string;
  memberIds: string[];

  // 기간
  startDate: Date;
  endDate?: Date;

  // 산출물
  deliverableIssueIds: string[];
  reportToMeetingId?: string;

  status: 'forming' | 'active' | 'wrapping_up' | 'completed';
}
```

### 3.3 Knowledge Base

```typescript
interface KnowledgeArticle {
  id: string;
  companyId: string;
  authorId: string;

  type: 'wiki' | 'lesson_learned' | 'best_practice' | 'adr' | 'runbook';

  title: string;
  content: string; // Markdown

  // 분류
  tags: string[];
  category: string;

  // 링크
  relatedIssueIds?: string[];
  relatedProjectIds?: string[];

  // 버전 관리
  version: number;
  updatedAt: Date;
  updatedById: string;

  // 검색
  searchVector?: string; //全文 검색용
}
```

### 3.4 Broadcast (전사 공지)

```typescript
interface Broadcast {
  id: string;
  companyId: string;
  authorId: string;

  title: string;
  content: string;
  type: 'announcement' | 'release' | 'alert' | 'celebration';

  targetAudience: 'all' | 'managers' | 'team Leads';

  publishedAt: Date;
  readBy: string[];

  // 연동
  linkedDecisionId?: string;
  linkedProjectId?: string;
}
```

---

## Phase 4: Skills & 권한 관리 시스템

OpenClaw 스타일의 Skills Registry를 통해 에이전트의 외부 서비스 연동 능력을 확장하고, 권한 관리 시스템과 연동합니다.

### 4.1 Skills Registry

```typescript
interface Skill {
  id: string;
  companyId: string;

  // 식별
  name: string;              // 'github', 'slack', 'notion', 'x_posting'
  displayName: string;       // 'GitHub Integration', 'X (Twitter) Posting'
  description: string;

  // 분류
  category: SkillCategory;
  tags: string[];

  // 구현
  type: 'builtin' | 'custom' | 'http';
  config: {
    endpoint?: string;       // HTTP skill의 경우
    handler?: string;        // 내장 핸들러 이름
    schema: JSONSchema;      // 설정 스키마
  };

  // 권한 요구사항
  requiredPermissions: Permission[];

  // 메타
  version: string;
  isActive: boolean;
  createdAt: Date;
}

type SkillCategory =
  | 'integrations'    // GitHub, Jira, Slack, Notion
  | 'communication'   // X Posting, LinkedIn, Email
  | 'productivity'    // Calendar, Docs, Analytics
  | 'company';        // Hiring, Budget, Reporting
```

### 4.2 에이전트-Skill 연결

```typescript
interface AgentSkill {
  id: string;
  agentId: string;
  skillId: string;

  // Skill별 설정 (예: GitHub 레포, Slack 채널)
  config: Record<string, unknown>;

  // 권한 범위 (Skill 전체 권한 중 허용된 것만)
  grantedPermissions: Permission[];

  // 상태
  status: 'active' | 'paused' | 'error';
  lastUsedAt?: Date;
  usageCount: number;

  // 승인
  approvedById: string;      // 누가 이 Skill 연결을 승인했는지
  approvedAt: Date;
}
```

### 4.3 권한 관리 시스템

```typescript
interface Permission {
  id: string;
  name: string;              // 'github:repo:read', 'github:pr:create'
  displayName: string;
  description: string;
  category: string;          // 'github', 'slack', 'internal'

  // 위험도
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // 승인 필요 여부
  requiresApproval: boolean;
  approvalLevel: 'manager' | 'ceo' | 'board';
}

interface RolePermissions {
  roleId: string;            // 'developer', 'manager', 'ceo'
  permissions: Permission[];

  // 역할별 기본 권한
  defaults: {
    developer: ['github:repo:read', 'github:pr:create', 'slack:message:send'];
    manager: [...developer defaults, 'github:repo:write', 'jira:project:manage'];
    ceo: [...manager defaults, 'company:budget:approve', 'agent:hire'];
  };
}
```

### 4.4 Skill 사용 로그 및 감사

```typescript
interface SkillUsageLog {
  id: string;
  agentId: string;
  skillId: string;

  // 실행 정보
  action: string;            // 'create_pr', 'post_tweet', 'create_issue'
  input: Record<string, unknown>;
  output?: Record<string, unknown>;

  // 결과
  status: 'success' | 'failure' | 'denied';
  errorMessage?: string;

  // 감사
  timestamp: Date;
  duration: number;          // ms
  cost?: number;             // API 호출 비용
}
```

### 4.5 Skills 카테고리 예시

| 카테고리 | Skill | 권한 예시 | 위험도 |
|---------|-------|----------|--------|
| **Integrations** | GitHub | `github:repo:read`, `github:pr:create`, `github:repo:delete` | Medium-High |
| | Jira | `jira:issue:read`, `jira:issue:create`, `jira:sprint:manage` | Medium |
| | Slack | `slack:message:send`, `slack:channel:read` | Low |
| | Notion | `notion:page:read`, `notion:page:write` | Low |
| **Communication** | X Posting | `x:tweet:post`, `x:tweet:delete` | High |
| | LinkedIn | `linkedin:post:create` | High |
| | Email | `email:send` | Medium |
| **Productivity** | Calendar | `calendar:event:create`, `calendar:event:read` | Low |
| | Analytics | `analytics:read`, `analytics:export` | Medium |
| **Company** | Hiring | `company:agent:create`, `company:agent:terminate` | Critical |
| | Budget | `company:budget:view`, `company:budget:approve` | Critical |

### 4.6 API 엔드포인트

```
# Skills Registry
GET    /api/companies/{id}/skills                    # 사용 가능한 Skills 목록
GET    /api/skills/{id}                              # Skill 상세
POST   /api/companies/{id}/skills                    # 새 Skill 등록 (custom)
PATCH  /api/skills/{id}                              # Skill 수정
DELETE /api/skills/{id}                              # Skill 삭제

# 에이전트-Skill 연결
GET    /api/agents/{id}/skills                       # 에이전트의 Skills 목록
POST   /api/agents/{id}/skills                       # Skill 연결 요청
DELETE /api/agents/{id}/skills/{skillId}             # Skill 연결 해제

# 권한 관리
GET    /api/permissions                              # 전체 권한 목록
GET    /api/roles/{id}/permissions                   # 역할별 권한
PATCH  /api/roles/{id}/permissions                   # 역할 권한 수정

# 승인
POST   /api/agent-skills/{id}/approve                # Skill 연결 승인
POST   /api/agent-skills/{id}/reject                 # Skill 연결 거부

# 로그
GET    /api/companies/{id}/skill-logs                # Skill 사용 로그
GET    /api/agents/{id}/skill-logs                   # 에이전트별 로그
```

### 4.10 역할별 모델 차등 적용

> **정본 문서**: 어댑터 아키텍처, UI 구현 계획, 마이그레이션 가이드는
> `doc/ROLE_BASED_MODEL_ASSIGNMENT.md`가 정본(canonical spec)이다.
> 이 섹션은 로드맵 컨텍스트에서 필요한 역할별 모델 매트릭스와 Phase 분류만 요약한다.

#### 역할별 모델 매트릭스 (전체)

Phase 2에서 추가된 전략 부서 역할(CSO, FuturesResearcher, BusinessAnalyst)을 포함한 전체 매트릭스:

| Role | Adapter | Model | 이유 |
|------|---------|-------|------|
| CEO | `opencode_local` | `anthropic/claude-opus-4` | 최고 품질 의사결정, 회의 총괄 |
| CSO | `opencode_local` | `anthropic/claude-sonnet-4` | 전략적 사고, 시장 분석 |
| CFO | `opencode_local` | `openai/gpt-4o` | 재무 분석, 수치 정확성 |
| CMO | `opencode_local` | `google/gemini-pro` | 창의적 콘텐츠, 멀티모달 |
| CTO | `opencode_local` | `anthropic/claude-sonnet-4` | 기술 아키텍처 결정 |
| FuturesResearcher | `opencode_local` | `anthropic/claude-sonnet-4` | 트렌드 분석, 시나리오 플래닝 |
| BusinessAnalyst | `opencode_local` | `openai/gpt-4o` | KPI 분석, 리포트 생성 |
| Developer | `opencode_local` | `zai/zai-coding` | 코딩 특화, 비용 효율 |
| Marketing Staff | `opencode_local` | `google/gemini-flash` | 저비용 대량 작업 |

#### 역할 티어 요약

| 티어 | 역할 | 모델 수준 | 비고 |
|------|------|----------|------|
| **Executive** | CEO, CSO, CTO, CFO, CMO | 고품질 | 전략 결정, 회의 주관 |
| **Strategy** | FuturesResearcher, BusinessAnalyst | 중간 | Phase 2 신규 역할 |
| **Operational** | Developer, Marketing Staff, Support | 비용 효율 | 반복 실무 작업 |

#### ROLE_MODEL_DEFAULTS 확장 (Phase 2 추가분)

`packages/shared/src/role-model-defaults.ts`에 다음 항목을 추가한다
(기존 항목은 `ROLE_BASED_MODEL_ASSIGNMENT.md` 참조):

```typescript
// Phase 2 신규 전략 부서 역할 추가
export const STRATEGY_ROLE_MODEL_DEFAULTS: Record<string, { adapter: string; model: string }> = {
  cso:               { adapter: 'opencode_local', model: 'anthropic/claude-sonnet-4' },
  cto:               { adapter: 'opencode_local', model: 'anthropic/claude-sonnet-4' },
  futures_researcher:{ adapter: 'opencode_local', model: 'anthropic/claude-sonnet-4' },
  business_analyst:  { adapter: 'opencode_local', model: 'openai/gpt-4o' },
};
```

#### 구현 현황 및 남은 작업

| 항목 | 상태 | 문서 |
|------|------|------|
| 어댑터별 모델 전달 (백엔드) | ✅ 구현됨 | `ROLE_BASED_MODEL_ASSIGNMENT.md` §Current Status |
| 어댑터 선택 UI | ❌ 미구현 | `ROLE_BASED_MODEL_ASSIGNMENT.md` §Phase 1 |
| 모델 선택 UI (OpenCode 전용) | ❌ 미구현 | `ROLE_BASED_MODEL_ASSIGNMENT.md` §Phase 1 |
| 역할별 기본 모델 자동 추천 | ❌ 미구현 | `ROLE_BASED_MODEL_ASSIGNMENT.md` §Phase 2 |
| 전략 부서 역할 모델 기본값 추가 | ❌ 미구현 (Phase 2 이후) | 위 `STRATEGY_ROLE_MODEL_DEFAULTS` |
| 비용 모니터링 | ❌ 미구현 (Phase 3 이후) | `ROLE_BASED_MODEL_ASSIGNMENT.md` §Phase 3 |


→ **계층별 차등 적용으로 70-80% 비용 절감 가능**

### 4.11 OpenClaw 생태계 통합

OpenClaw의 이미 발달된 Skills 생태계(ClawHub)를 Paperclip에서 직접 활용할 수 있도록 통합합니다.

> 참고: [OpenClaw Skills 문서](https://docs.openclaw.ai/tools/skills) | [ClawHub 레지스트리](https://clawhub.com)

#### OpenClaw Skill 포맷 (AgentSkills 호환)

OpenClaw는 **디렉토리 기반** 스킬을 사용합니다:

```
skills/
└── my-skill/
    └── SKILL.md          # 필수: YAML frontmatter + Markdown 지침
```

**SKILL.md 예시:**

```markdown
---
name: github-integration
description: GitHub PR, Issue, Repository 관리
metadata:
{
  "openclaw": {
    "requires": { "bins": ["gh"], "env": ["GITHUB_TOKEN"] },
    "primaryEnv": "GITHUB_TOKEN"
  }
---

# GitHub Integration

이 스킬은 GitHub CLI를 사용하여 PR 생성, 이슈 관리 등을 수행합니다.

## 사용법
1. `gh pr create`로 PR 생성
2. `gh issue list`로 이슈 조회
...
```

#### Paperclip 통합 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  Paperclip Skills Layer                                      │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Native Skills   │  │ OpenClaw Skills │                   │
│  │ (Paperclip 전용)│  │ (ClawHub 동기화)│                   │
│  └─────────────────┘  └─────────────────┘                   │
│           │                    │                             │
│           └──────────┬─────────┘                             │
│                      ▼                                       │
│         ┌─────────────────────────┐                          │
│         │ SKILL.md Parser         │                          │
│         │ (AgentSkills 호환)       │                          │
│         └─────────────────────────┘                          │
│                      │                                       │
│  ┌───────────────────┴───────────────────┐                   │
│  │ Paperclip Permission Layer             │                   │
│  │ (requires.env → Paperclip 권한 매핑)   │                   │
│  └───────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │ ClawHub Registry         │
        │ (clawhub.com)            │
        │                          │
        │ - github-integration     │
        │ - slack-messaging        │
        │ - notion-docs            │
        │ - summarize              │
        │ - ... (수백 개 Skills)   │
        └──────────────────────────┘
```

#### Skill 로딩 우선순위

OpenClaw와 동일한 우선순위 적용:

```
1. /skills (workspace)       → 최우선 (에이전트별 커스텀)
2. ~/.paperclip/skills       → 공유 스킬
3. bundled skills            → 기본 내장
```

#### Paperclip 확장 메타데이터

OpenClaw 메타데이터에 Paperclip 전용 필드 추가:

```yaml
---
name: github-integration
description: GitHub PR, Issue, Repository 관리
metadata:
{
  "openclaw": {
    "requires": { "bins": ["gh"], "env": ["GITHUB_TOKEN"] }
  },
  "paperclip": {
    "category": "integrations",
    "riskLevel": "medium",
    "requiredPermissions": ["github:repo:read", "github:pr:create"],
    "approvalLevel": "manager"
  }
}
---
```

#### ClawHub CLI 통합

```bash
# 스킬 설치
paperclip skill install github-integration

# 스킬 업데이트
paperclip skill update --all

# 스킬 목록 조회
paperclip skill list

# ClawHub 동기화
paperclip skill sync
```

#### 권한 매핑

OpenClaw의 `requires.env`를 Paperclip 권한으로 매핑:

```typescript
const ENV_TO_PERMISSION = {
  'GITHUB_TOKEN': ['github:repo:read', 'github:pr:create'],
  'SLACK_BOT_TOKEN': ['slack:message:send'],
  'NOTION_API_KEY': ['notion:page:read', 'notion:page:write'],
  'X_API_KEY': ['x:tweet:post'],
};
```

#### API 엔드포인트

```
# ClawHub 연동
POST   /api/companies/{id}/skills/install        # 스킬 설치
POST   /api/companies/{id}/skills/sync           # ClawHub 동기화
GET    /api/companies/{id}/skills/available      # 사용 가능한 Skills (로컬 + ClawHub)

# 스킬 관리
GET    /api/skills/{name}/SKILL.md               # SKILL.md 내용 조회
PATCH  /api/skills/{name}/SKILL.md               # SKILL.md 수정
```

#### 이점

1. **생태계 공유**: ClawHub의 수백 개 스킬 즉시 활용
2. **AgentSkills 호환**: 표준 포맷으로 상호 운용성 확보
3. **개발 비용 절감**: 공통 스킬을 직접 개발할 필요 없음
4. **커스텀 확장**: Paperclip 전용 메타데이터로 권한 관리

### 4.9 에이전트 프롬프트 가이드라인

```markdown
## Skills 사용 가이드라인

### Skill 사용 전 확인사항

1. **권한 확인**: 내가 이 작업을 수행할 권한이 있는지 확인
2. **위험도 평가**: 삭제, 공개 포스팅 등 높은 위험도 작업은 신중하게
3. **승인 필요 여부**: 승인이 필요한 작업은 먼저 요청

### 권한이 없는 경우

1. 관리자에게 권한 요청
2. 권한이 승인될 때까지 대안적 접근 방식 사용
3. 긴급한 경우 에스컬레이션

### Skill 사용 시

1. 입력값 검증
2. 실행 결과 확인
3. 실패 시 재시도 또는 대안 모색
4. 중요 작업은 로그 기록
```

---

## Phase 5: 고급 자율 기능

### 5.1 자동 보고서 생성

```typescript
interface Report {
  id: string;
  companyId: string;

  type: 'daily_standup' | 'weekly_summary' | 'sprint_review' | 'quarterly_business_review';
  period: { start: Date; end: Date };

  // 내용
  sections: ReportSection[];
  insights: string[];
  recommendations: string[];

  // 배포
  distribution: {
    channelIds: string[];
    meetingId?: string;
    notifyAgentIds: string[];
  };

  generatedAt: Date;
  generatedById: string;
}
```

### 4.2 예측 및 추천

```typescript
interface Prediction {
  id: string;
  companyId: string;

  type: 'completion_date' | 'budget_usage' | 'risk' | 'opportunity';

  target: string; // 예측 대상 (issueId, projectId 등)
  prediction: string;
  confidence: number; // 0-100

  basedOn: string[]; // 근거 (insight IDs, historical data)
  generatedAt: Date;
}
```

### 4.3 외부 데이터 연동

```typescript
interface ExternalDataSource {
  id: string;
  companyId: string;

  name: string;
  type: 'market_data' | 'news' | 'social' | 'analytics' | 'api';

  config: {
    endpoint?: string;
    apiKey?: string;
    schedule?: string; // cron
  };

  lastSyncAt?: Date;
  status: 'active' | 'paused' | 'error';
}
```

---

## 구현 우선순위

### Sprint 1-2: 기반 (Phase 1.1 - 1.3)
- [ ] `meetings`, `meeting_participants`, `meeting_messages` 스키마 및 마이그레이션
- [ ] `decisions` 스키마 및 API
- [ ] 하트비트 웨이크 이유 확장 (`sync_meeting_started`, `sync_meeting_message`, `async_meeting_invited`)
- [ ] WebSocket 이벤트 추가 (`meeting.started`, `meeting.message`, `meeting.concluded`)

### Sprint 3-4: 회의 UI 및 자율 회의 (Phase 1.4 - 1.6)
- [ ] 동기 회의 채팅 UI (회의방, 실시간 발언 표시)
- [ ] 비동기 회의 히스토리 UI (회의 목록, 발언 + 요약 뷰)
- [ ] CEO 하트비트: 정기 비동기 회의 자율 소집 로직
- [ ] 비서 역할 정의 업데이트 (중계 제거, 진행 보조로 재정의)

### Sprint 5-6: 자율 목표 (Phase 2.1 - 2.2)
- [ ] 승인 매트릭스 구현
- [ ] 전략 부서 Role 템플릿
- [ ] 자율 목표 생성 플로우

### Sprint 7-8: 인사이트 (Phase 2.3)
- [ ] Insight 스키마 및 API
- [ ] 인사이트 수집/분석 파이프라인
- [ ] 인사이트 → 액션 연동

### Sprint 9-10: 크로스팀 (Phase 3.1 - 3.2)
- [ ] Channel 스키마 및 API
- [ ] Working Group 지원
- [ ] 크로스팀 알림 시스템

### Sprint 11-12: 지식 관리 (Phase 3.3 - 3.4)
- [ ] Knowledge Base
- [ ] Broadcast 시스템
- [ ] 검색 기능

### Sprint 13-14: Skills & 권한 (Phase 4.1 - 4.3)
- [ ] Skills Registry 스키마 및 API
- [ ] Permission 시스템 구현
- [ ] 에이전트-Skill 연결 플로우
- [ ] Skill 사용 로그 및 감사

### Sprint 15+: 고급 기능 (Phase 5)
- [ ] 자동 보고서
- [ ] 예측/추천
- [ ] 외부 데이터 연동

---

## 데이터베이스 스키마 변경사항

### 새로운 테이블

```sql
-- Meetings (동기/비동기 회의 공통)
CREATE TABLE meetings (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('sync', 'async')) NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'in_progress', 'concluded', 'cancelled')) NOT NULL DEFAULT 'scheduled',
  trigger_type TEXT CHECK (trigger_type IN ('user_initiated', 'agent_initiated', 'scheduled')) NOT NULL,
  initiated_by_id UUID REFERENCES agents(id), -- NULL이면 사용자가 시작
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  concluded_at TIMESTAMPTZ,
  summary TEXT,                                -- 회의 종료 후 CEO/비서가 작성
  action_item_issue_ids UUID[],               -- 회의 결과로 생성된 이슈
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting Participants
CREATE TABLE meeting_participants (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),         -- NULL이면 사용자
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, agent_id)
);

-- Meeting Messages (동기/비동기 회의 발언 공통)
CREATE TABLE meeting_messages (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  sender_agent_id UUID REFERENCES agents(id),  -- NULL이면 사용자가 직접 작성
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decisions (회의 또는 단독으로 생성되는 결정 사항)
CREATE TABLE decisions (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  meeting_id UUID REFERENCES meetings(id),     -- 회의와 연결 (선택)
  approval_id UUID REFERENCES approvals(id),   -- Approval로 격상된 경우
  title TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('strategy', 'product', 'budget', 'hiring', 'process')),
  proposed_by_id UUID REFERENCES agents(id),
  status TEXT DEFAULT 'proposed',
  affected_goal_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

-- Insights
CREATE TABLE insights (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  created_by_id UUID REFERENCES agents(id),
  type TEXT CHECK (type IN ('market', 'competitor', 'customer', 'technology', 'internal')),
  category TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  details TEXT,
  source TEXT,
  relevance_score INTEGER,
  urgency TEXT,
  suggested_actions TEXT[],
  linked_goal_ids UUID[],
  linked_project_ids UUID[],
  status TEXT DEFAULT 'new',
  reviewed_by_id UUID REFERENCES agents(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Channels
CREATE TABLE channels (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('team', 'project', 'topic', 'announcement')),
  member_ids UUID[],
  is_public BOOLEAN DEFAULT true,
  linked_project_id UUID REFERENCES projects(id),
  linked_goal_id UUID REFERENCES goals(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Channel Messages
CREATE TABLE channel_messages (
  id UUID PRIMARY KEY,
  channel_id UUID REFERENCES channels(id),
  author_id UUID REFERENCES agents(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES channel_messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Working Groups
CREATE TABLE working_groups (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  charter TEXT,
  lead_id UUID REFERENCES agents(id),
  member_ids UUID[],
  start_date DATE,
  end_date DATE,
  deliverable_issue_ids UUID[],
  report_to_meeting_id UUID REFERENCES meetings(id),
  status TEXT DEFAULT 'forming',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Articles
CREATE TABLE knowledge_articles (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  author_id UUID REFERENCES agents(id),
  type TEXT CHECK (type IN ('wiki', 'lesson_learned', 'best_practice', 'adr', 'runbook')),
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT[],
  category TEXT,
  related_issue_ids UUID[],
  related_project_ids UUID[],
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcasts
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  author_id UUID REFERENCES agents(id),
  title TEXT NOT NULL,
  content TEXT,
  type TEXT CHECK (type IN ('announcement', 'release', 'alert', 'celebration')),
  target_audience TEXT DEFAULT 'all',
  published_at TIMESTAMPTZ,
  read_by_ids UUID[],
  linked_decision_id UUID REFERENCES decisions(id),
  linked_project_id UUID REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skills
CREATE TABLE skills (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('integrations', 'communication', 'productivity', 'company')),
  tags TEXT[],
  type TEXT CHECK (type IN ('builtin', 'custom', 'http')),
  config JSONB,
  required_permissions TEXT[],
  version TEXT DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Skills (에이전트-Skill 연결)
CREATE TABLE agent_skills (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  skill_id UUID REFERENCES skills(id),
  config JSONB,
  granted_permissions TEXT[],
  status TEXT DEFAULT 'active',
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  approved_by_id UUID REFERENCES agents(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, skill_id)
);

-- Permissions
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  requires_approval BOOLEAN DEFAULT false,
  approval_level TEXT CHECK (approval_level IN ('manager', 'ceo', 'board'))
);

-- Role Permissions
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  role TEXT NOT NULL,
  permission_id UUID REFERENCES permissions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- Skill Usage Logs
CREATE TABLE skill_usage_logs (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  skill_id UUID REFERENCES skills(id),
  action TEXT NOT NULL,
  input JSONB,
  output JSONB,
  status TEXT CHECK (status IN ('success', 'failure', 'denied')),
  error_message TEXT,
  duration_ms INTEGER,
  cost_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## UI 변경사항

### 새로운 페이지

1. **Meetings** (`/companies/:id/meetings`)
   - 회의 목록 뷰 (동기/비동기 필터, 상태 필터)
   - **동기 회의 채팅방**: 여러 에이전트의 발언이 Slack처럼 실시간으로 표시. 사용자도 직접 참여 가능.
   - **비동기 회의 뷰**: 각 에이전트의 발언 타임라인 + CEO 요약 + 연결된 Approval
   - 회의 생성 (사용자 주도 동기 회의)

2. **Decisions** (`/companies/:id/decisions`)
   - 결정 대기 목록
   - 결정 상세 및 승인 이력
   - 결정 영향도 시각화

3. **Channels** (`/companies/:id/channels`)
   - 채널 목록 (팀별, 프로젝트별)
   - 채널 내 메시지 스레드
   - @멘션, 리액션

4. **Insights** (`/companies/:id/insights`)
   - 인사이트 피드
   - 타입/카테고리 필터
   - 인사이트 → 액션 연결

5. **Knowledge** (`/companies/:id/knowledge`)
   - 위키/문서 목록
   - 검색
   - 카테고리 탐색

6. **Skills** (`/companies/:id/skills`)
   - Skills 카탈로그 (카테고리별)
   - Skill 상세: 권한 요구사항, 위험도
   - 새 Skill 등록 (custom)

7. **Permissions** (`/companies/:id/permissions`)
   - 권한 매트릭스 (역할별)
   - 승인 대기 목록
   - 권한 요청 이력

8. **Skill Logs** (`/companies/:id/skill-logs`)
   - Skill 사용 로그
   - 에이전트별/Skill별 필터
   - 실패/거부 사례 모니터링

### 기존 페이지 수정

- **Dashboard**: 회의 일정, 미결정 사항, 새 인사이트 위젯 추가
- **Agent Detail**: 참여 중인 회의, 채널, 워킹그룹, **연결된 Skills** 표시
- **Issue Detail**: 관련 회의, 결정, 인사이트 링크
- **Agent Create/Edit**: **Skill 연결** 섹션 추가 (권한 승인 필요 표시)

---

## 에이전트 프롬프트 업데이트

### CEO 프롬프트 예시

```markdown
## 역할
당신은 이 회사의 CEO입니다. 전사 전략을 수립하고 임원진을 이끕니다.

## 정기 활동
- 매주 월요일: 비동기 주간 현황 공유 회의 소집
  (POST /api/companies/{id}/meetings, type: "async")
- 격주: 전략 리뷰 비동기 회의 소집 (임원진 대상)
- 매월 1일: 월간 비즈니스 리뷰

## 비동기 회의 진행 방법
1. 회의 생성 및 참여자 초대
2. 각 에이전트의 발언을 수집 (다음 하트비트에서 GET /api/meetings/{id}/messages)
3. 전체 발언 종합 후 summary 작성
4. 결재가 필요한 사항은 Approval(Proposal)로 격상
5. POST /api/meetings/{id}/conclude 로 회의 종료

## 의사결정
- 팀 목표 승인/거부
- 예산 $1000 이하 결정 승인
- 전략적 결정은 보드에 Approval로 상정

## 협업
- CSO와 정기 회의로 시장 동향 공유
- CTO/CMO 간 크로스팀 이니셔티브 조율
- 비서에게 회의 요약 보고 위임 가능
```

### CSO (Chief Strategy Officer) 프롬프트 예시

```markdown
## 역할
당신은 최고전략책임자(CSO)입니다. 시장 분석, 경쟁사 모니터링, 장기 전략을 담당합니다.

## 정기 활동
- 매주: 시장 트렌드 리포트 생성
- 매월: 경쟁사 분석 업데이트
- 분기별: 전략 재검토 미팅 주관

## 인사이트 관리
- 새로운 인사이트 발견 시 즉시 기록
- 관련성 높은 인사이트는 CEO 및 임원진에 브리핑
- 인사이트를 실행 가능한 액션으로 전환

## 협업
- CEO와 전략 방향 정렬
- Business Analyst와 데이터 분석 협업
- Futures Researcher에게 조사 과제 할당
```

---

## 성공 지표 (KPI)

### 자율성
- [ ] 80% 이상의 운영 결정이 보드 개입 없이 이루어짐
- [ ] 주간 5회 이상 자율 회의 진행
- [ ] 크로스팀 협업 이슈 50% 증가

### 효율성
- [ ] 의사결정 평균 소요 시간 50% 단축
- [ ] 정보 전달 지연 시간 70% 감소
- [ ] 회의 대비 액션 아이템 완료율 80% 이상

### 혁신
- [ ] 분기별 10개 이상의 새로운 인사이트 생성
- [ ] 인사이트 기반 신규 프로젝트 3개/분기
- [ ] 지식 베이스 문서 100개 이상 축적

### Skills & 권한
- [ ] 평균 5개 이상의 Skills per 에이전트 활성화
- [ ] 권한 요청 승인률 90% 이상
- [ ] Skill 사용 실패율 5% 미만
- [ ] 미승인 권한 사용 시도 0건

---

## 리스크 및 대응

| 리스크 | 가능성 | 영향도 | 대응 방안 |
|--------|--------|--------|----------|
| 무한 회의 루프 | 중 | 높음 | 회의 시간 제한, 안건 우선순위 필수 |
| 의사결정 마비 | 중 | 높음 | 타임박스 설정, 기본 안(디폴트) 규칙 |
| 정보 과부하 | 높음 | 중 | 인사이트 필터링, 요약 자동화 |
| 예산 초과 | 낮음 | 높음 | 자동 예산 모니터링, 경고 시스템 |
| 크루스팀 갈등 | 중 | 중 | 명확한 RACI, 에스컬레이션 경로 |
| 권한 남용 | 낮음 | 높음 | 감사 로그, 승인 프로세스, 위험도 기반 제한 |
| 외부 서비스 장애 | 중 | 중 | 타임아웃, 재시도, 대체 경로 |

---

## 참고 문서

- [Heartbeat Protocol](/docs/guides/agent-developer/heartbeat-protocol.md)
- [Org Structure](/docs/guides/board-operator/org-structure.md)
- [Core Concepts](/docs/start/core-concepts.md)
- [Architecture](/docs/start/architecture.md)
