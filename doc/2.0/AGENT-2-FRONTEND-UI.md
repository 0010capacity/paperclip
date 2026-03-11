# Agent 2 작업 계획서 — Frontend / UI

> **이 계획서는 병렬 작업 중 Agent 2가 담당하는 범위를 정의한다.**
> Agent 3(Shared Contracts)의 타입·상수를 import해서 사용한다.
> Agent 1(DB/Backend)이 만든 API 엔드포인트를 호출한다.
> **API가 아직 완성되지 않았어도 타입 기반으로 UI 구현을 먼저 진행할 수 있다.**

---

## 역할 요약

| 항목 | 내용 |
|------|------|
| **담당 범위** | `ui/src/` 전체 |
| **핵심 산출물** | ChatPanel, 회의방 UI, Approvals 확장, Dashboard 위젯, 어댑터/모델 선택 UI |
| **선행 조건** | Agent 3의 `packages/shared` 타입 빌드 완료 후 import 가능. UI 컴포넌트 골격은 먼저 진행 가능 |
| **건드리지 않는 것** | `server/`, `packages/db/`, `packages/shared/` (읽기만 가능), 기존 V1 페이지의 핵심 동작 |

---

## 읽어야 할 문서

작업 시작 전 반드시 읽을 것:

1. `doc/AGENTS.md` — 전체 기여 규칙
2. `doc/SPEC-implementation.md` — V1 데이터 모델과 컨트랙트
3. `doc/COWORKER-AUTONOMY.md` — 섹션 8(채팅 시스템), 16(UI 변경사항)
4. `doc/AUTONOMOUS-COMPANY-ROADMAP.md` — Phase 1(회의 UI), §UI 변경사항
5. `doc/ROLE_BASED_MODEL_ASSIGNMENT.md` — 어댑터/모델 선택 UI 계획

---

## 현재 상태 파악

작업 전 아래 파일들의 현재 내용을 반드시 읽어 파악한다:

```
ui/src/pages/                        ← 기존 페이지 목록
ui/src/components/                   ← 기존 컴포넌트 목록
ui/src/api/                          ← 기존 API 클라이언트
ui/src/hooks/                        ← 기존 훅 목록
ui/src/lib/                          ← 유틸리티 (WebSocket 클라이언트 등)
ui/src/pages/ApprovalsPage.tsx       ← 기존 Approvals 페이지 (확장 대상)
ui/src/pages/DashboardPage.tsx       ← 기존 Dashboard 페이지 (확장 대상)
ui/src/pages/AgentFormPage.tsx       ← 기존 에이전트 생성/수정 폼 (확장 대상)
```

기존 컴포넌트의 import 경로, 스타일링 방식(Tailwind 등), 상태관리 패턴을 먼저 파악하고
동일한 패턴을 따른다.

---

## 작업 목록

---

### Task 1 — Meeting API 클라이언트

**파일:** `ui/src/api/meetings.ts` (신규)

Agent 1이 만든 회의 관련 엔드포인트를 호출하는 클라이언트 함수들.
`MEETING_API` 경로 상수는 Agent 3이 `packages/shared`에 정의한다.

```typescript
import type {
  Meeting,
  MeetingMessage,
  MeetingParticipant,
  CreateMeetingInput,
  ConcludeMeetingInput,
  CreateMeetingMessageInput,
} from "@paperclip/shared";
import { MEETING_API } from "@paperclip/shared";
import { apiFetch } from "./client"; // 기존 fetch 래퍼 사용

export async function listMeetings(companyId: string): Promise<Meeting[]> {
  return apiFetch(MEETING_API.list(companyId));
}

export async function getMeeting(meetingId: string): Promise<Meeting> {
  return apiFetch(MEETING_API.get(meetingId));
}

export async function createMeeting(
  companyId: string,
  input: CreateMeetingInput
): Promise<Meeting> {
  return apiFetch(MEETING_API.create(companyId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function concludeMeeting(
  meetingId: string,
  input: ConcludeMeetingInput
): Promise<Meeting> {
  return apiFetch(MEETING_API.conclude(meetingId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelMeeting(meetingId: string): Promise<Meeting> {
  return apiFetch(MEETING_API.cancel(meetingId), { method: "DELETE" });
}

export async function listMeetingMessages(
  meetingId: string
): Promise<MeetingMessage[]> {
  return apiFetch(MEETING_API.messages(meetingId));
}

export async function sendMeetingMessage(
  meetingId: string,
  input: CreateMeetingMessageInput
): Promise<MeetingMessage> {
  return apiFetch(MEETING_API.messages(meetingId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

---

### Task 2 — Chat API 클라이언트

**파일:** `ui/src/api/chat.ts` (신규)

```typescript
import type {
  ChatMessage,
  SendChatMessageInput,
  ResolveChatActionInput,
} from "@paperclip/shared";
import { CHAT_API } from "@paperclip/shared";
import { apiFetch } from "./client";

export async function listChatMessages(
  companyId: string,
  limit = 50
): Promise<ChatMessage[]> {
  return apiFetch(`${CHAT_API.list(companyId)}?limit=${limit}`);
}

export async function sendChatMessage(
  companyId: string,
  input: SendChatMessageInput
): Promise<ChatMessage> {
  return apiFetch(CHAT_API.send(companyId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function resolveChatAction(
  messageId: string,
  input: ResolveChatActionInput
): Promise<ChatMessage> {
  return apiFetch(CHAT_API.action(messageId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

---

### Task 3 — Advisory API 클라이언트

**파일:** `ui/src/api/advisories.ts` (신규)

```typescript
import { ADVISORY_API } from "@paperclip/shared";
import { apiFetch } from "./client";

export async function listAdvisories(companyId: string) {
  return apiFetch(ADVISORY_API.list(companyId));
}

export async function promoteAdvisory(advisoryId: string) {
  return apiFetch(ADVISORY_API.promote(advisoryId), { method: "POST" });
}
```

---

### Task 4 — WebSocket 훅: 회의/채팅 이벤트 구독

**파일:** `ui/src/hooks/useLiveEvents.ts` (기존 파일 확장 또는 신규)

기존 WebSocket 클라이언트(`live-events`) 사용 방식을 파악한 후,
회의/채팅 이벤트를 구독하는 훅을 추가한다.

```typescript
// 회의 실시간 메시지 구독 훅
export function useMeetingMessages(meetingId: string) {
  const [messages, setMessages] = useState<MeetingMessage[]>([]);

  // 초기 메시지 로드
  useEffect(() => {
    listMeetingMessages(meetingId).then(setMessages);
  }, [meetingId]);

  // WebSocket으로 새 메시지 수신
  useLiveEvent("meeting.message", (payload) => {
    if (payload.message.meetingId === meetingId) {
      setMessages((prev) => [...prev, payload.message]);
    }
  });

  // 회의 종료 이벤트
  useLiveEvent("meeting.concluded", (payload) => {
    if (payload.meetingId === meetingId) {
      // 부모 컴포넌트에 알리거나 상태 업데이트
    }
  });

  return messages;
}

// 채팅 실시간 메시지 구독 훅
export function useChatMessages(companyId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    listChatMessages(companyId).then(setMessages);
  }, [companyId]);

  useLiveEvent("chat.message", (payload) => {
    if (payload.message.companyId === companyId) {
      setMessages((prev) => [...prev, payload.message]);
    }
  });

  useLiveEvent("chat.action_resolved", (payload) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === payload.messageId
          ? { ...m, actionStatus: payload.decision }
          : m
      )
    );
  });

  return messages;
}
```

`useLiveEvent`는 기존 WebSocket 훅의 이벤트 구독 방식을 따른다.
기존 구현이 없으면 `useEffect` + `addEventListener` 패턴으로 직접 구현한다.

---

### Task 5 — ChatMessage 컴포넌트

**파일:** `ui/src/components/chat/ChatMessage.tsx` (신규)

사용자와 비서 메시지를 렌더링하는 단일 메시지 컴포넌트.

```tsx
import type { ChatMessage } from "@paperclip/shared";

interface Props {
  message: ChatMessage;
  onActionConfirm?: (messageId: string) => void;
  onActionReject?: (messageId: string) => void;
}

export function ChatMessageItem({ message, onActionConfirm, onActionReject }: Props) {
  const isUser = message.senderType === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* 아바타 */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">
        {isUser ? "👤" : "🤖"}
      </div>

      {/* 메시지 버블 */}
      <div className={`max-w-[70%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
            isUser
              ? "bg-blue-500 text-white rounded-tr-sm"
              : "bg-gray-100 text-gray-900 rounded-tl-sm"
          }`}
        >
          {message.content}
        </div>

        {/* 인라인 액션 버튼 (action_request 메시지인 경우) */}
        {message.contentType === "action_request" &&
          message.actionStatus === "pending" && (
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => onActionConfirm?.(message.id)}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 transition"
              >
                승인
              </button>
              <button
                onClick={() => onActionReject?.(message.id)}
                className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition"
              >
                거부
              </button>
            </div>
          )}

        {/* 처리된 액션 상태 표시 */}
        {message.contentType === "action_request" &&
          message.actionStatus === "confirmed" && (
            <span className="text-xs text-green-600">✓ 승인됨</span>
          )}
        {message.contentType === "action_request" &&
          message.actionStatus === "rejected" && (
            <span className="text-xs text-red-500">✗ 거부됨</span>
          )}

        <span className="text-xs text-gray-400">
          {new Date(message.createdAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
```

---

### Task 6 — ChatPanel 컴포넌트

**파일:** `ui/src/components/chat/ChatPanel.tsx` (신규)

사용자 ↔ 비서 1:1 채팅 패널. 사이드바 또는 전용 페이지에서 사용.

```tsx
import { useState, useRef, useEffect } from "react";
import { ChatMessageItem } from "./ChatMessage";
import { useChatMessages } from "../../hooks/useLiveEvents";
import { sendChatMessage, resolveChatAction } from "../../api/chat";

interface Props {
  companyId: string;
}

export function ChatPanel({ companyId }: Props) {
  const messages = useChatMessages(companyId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 메시지 도착 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    setInput("");
    try {
      await sendChatMessage(companyId, { content });
    } catch (err) {
      console.error("메시지 전송 실패:", err);
      setInput(content); // 실패 시 입력 복원
    } finally {
      setSending(false);
    }
  };

  const handleActionConfirm = async (messageId: string) => {
    await resolveChatAction(messageId, { decision: "confirmed" });
  };

  const handleActionReject = async (messageId: string) => {
    await resolveChatAction(messageId, { decision: "rejected" });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <span className="text-lg">🤖</span>
        <div>
          <p className="font-medium text-sm">비서</p>
          <p className="text-xs text-gray-500">회사 AI 비서</p>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            비서에게 말을 걸어보세요.
            <br />
            현황 확인, 지시, 회의 요청 등 무엇이든 물어보세요.
          </p>
        )}
        {messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            message={msg}
            onActionConfirm={handleActionConfirm}
            onActionReject={handleActionReject}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="px-4 py-3 border-t">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 max-h-32"
            rows={1}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="shrink-0 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {sending ? "..." : "전송"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 7 — MeetingMessage 컴포넌트

**파일:** `ui/src/components/meeting/MeetingMessage.tsx` (신규)

회의방에서 여러 에이전트의 발언을 렌더링하는 컴포넌트.
에이전트 이름/역할을 표시해서 누가 발언했는지 명확히 한다.

```tsx
import type { MeetingMessage } from "@paperclip/shared";

interface Agent {
  id: string;
  name: string;
  role: string;
}

interface Props {
  message: MeetingMessage;
  agent?: Agent;       // senderAgentId에 해당하는 에이전트 정보
  isCurrentUser?: boolean;  // 사용자 본인이 보낸 메시지
  onActionConfirm?: (messageId: string) => void;
  onActionReject?: (messageId: string) => void;
}

export function MeetingMessageItem({
  message,
  agent,
  isCurrentUser,
  onActionConfirm,
  onActionReject,
}: Props) {
  const isUser = message.senderAgentId === null;
  const senderName = isUser ? "나" : (agent?.name ?? "알 수 없음");
  const senderRole = isUser ? "" : (agent?.role ?? "");

  return (
    <div className="flex gap-3 group">
      {/* 아바타 */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700 mt-0.5">
        {isUser ? "👤" : senderName.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        {/* 발신자 이름 + 시간 */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-900">{senderName}</span>
          {senderRole && (
            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {senderRole}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {new Date(message.createdAt).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* 메시지 내용 */}
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.content}</p>

        {/* 인라인 액션 (비서의 action_request) */}
        {message.contentType === "action_request" &&
          message.actionStatus === "pending" && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => onActionConfirm?.(message.id)}
                className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
              >
                ✓ 승인
              </button>
              <button
                onClick={() => onActionReject?.(message.id)}
                className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition font-medium"
              >
                ✗ 거부
              </button>
            </div>
          )}

        {message.contentType === "action_request" &&
          message.actionStatus === "confirmed" && (
            <p className="mt-1 text-xs text-green-600 font-medium">✓ 승인됨</p>
          )}
        {message.contentType === "action_request" &&
          message.actionStatus === "rejected" && (
            <p className="mt-1 text-xs text-red-500 font-medium">✗ 거부됨</p>
          )}
      </div>
    </div>
  );
}
```

---

### Task 8 — MeetingRoom 컴포넌트 (동기 회의 채팅방)

**파일:** `ui/src/components/meeting/MeetingRoom.tsx` (신규)

동기 회의 전용 실시간 채팅방. Slack/Discord 채널처럼 여러 에이전트가 순서대로 발언한다.

```tsx
import { useState, useRef, useEffect } from "react";
import { MeetingMessageItem } from "./MeetingMessage";
import { useMeetingMessages } from "../../hooks/useLiveEvents";
import { sendMeetingMessage, concludeMeeting } from "../../api/meetings";
import type { Meeting } from "@paperclip/shared";

interface Agent {
  id: string;
  name: string;
  role: string;
}

interface Props {
  meeting: Meeting;
  agents: Agent[];           // 회사의 전체 에이전트 목록 (발언자 이름 표시용)
  onConcluded?: () => void;
}

export function MeetingRoom({ meeting, agents, onConcluded }: Props) {
  const messages = useMeetingMessages(meeting.id);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [showConcludeModal, setShowConcludeModal] = useState(false);
  const [summary, setSummary] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    setInput("");
    try {
      await sendMeetingMessage(meeting.id, { content, contentType: "text" });
    } catch (err) {
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const handleConclude = async () => {
    if (!summary.trim()) return;
    setConcluding(true);
    try {
      await concludeMeeting(meeting.id, { summary });
      setShowConcludeModal(false);
      onConcluded?.();
    } finally {
      setConcluding(false);
    }
  };

  const isActive =
    meeting.status === "in_progress" || meeting.status === "scheduled";

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 회의방 헤더 */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <h2 className="font-semibold text-gray-900">{meeting.title}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {meeting.type === "sync" ? "실시간" : "비동기"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {agents.length}명 참여 중
          </p>
        </div>

        {isActive && (
          <button
            onClick={() => setShowConcludeModal(true)}
            className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition"
          >
            회의 종료
          </button>
        )}

        {meeting.status === "concluded" && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            종료됨
          </span>
        )}
      </div>

      {/* 발언 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            아직 발언이 없습니다.
            <br />
            첫 번째로 의견을 남겨보세요.
          </p>
        )}
        {messages.map((msg) => (
          <MeetingMessageItem
            key={msg.id}
            message={msg}
            agent={msg.senderAgentId ? agentMap[msg.senderAgentId] : undefined}
            isCurrentUser={msg.senderAgentId === null}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 요약이 있으면 표시 */}
      {meeting.status === "concluded" && meeting.summary && (
        <div className="mx-4 mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-semibold text-blue-700 mb-1">📋 회의록</p>
          <p className="text-sm text-blue-900 whitespace-pre-wrap">{meeting.summary}</p>
        </div>
      )}

      {/* 입력창 (진행 중인 경우만) */}
      {isActive && (
        <div className="px-4 py-3 border-t">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="발언을 입력하세요..."
              className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 max-h-32"
              rows={1}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="shrink-0 px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 disabled:opacity-40 transition"
            >
              {sending ? "..." : "발언"}
            </button>
          </div>
        </div>
      )}

      {/* 회의 종료 모달 */}
      {showConcludeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-gray-900 mb-1">회의 종료</h3>
            <p className="text-sm text-gray-500 mb-4">
              회의록(요약)을 작성하면 회의가 종료됩니다.
            </p>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="주요 결정사항, 액션 아이템 등을 요약해주세요..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
              rows={5}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowConcludeModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                취소
              </button>
              <button
                onClick={handleConclude}
                disabled={!summary.trim() || concluding}
                className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40 transition font-medium"
              >
                {concluding ? "종료 중..." : "종료하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Task 9 — MeetingsPage

**파일:** `ui/src/pages/MeetingsPage.tsx` (신규)

회의 목록 + 동기/비동기 회의 상세 뷰 페이지.

```tsx
import { useState, useEffect } from "react";
import { listMeetings, createMeeting } from "../api/meetings";
import { MeetingRoom } from "../components/meeting/MeetingRoom";
import type { Meeting, CreateMeetingInput } from "@paperclip/shared";
import { useCompany } from "../hooks/useCompany";    // 기존 훅
import { useAgents } from "../hooks/useAgents";      // 기존 훅

export function MeetingsPage() {
  const { company } = useCompany();
  const { agents } = useAgents(company?.id);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "sync" | "async" | "active">("all");

  useEffect(() => {
    if (company?.id) {
      listMeetings(company.id).then(setMeetings);
    }
  }, [company?.id]);

  const filtered = meetings.filter((m) => {
    if (filter === "sync") return m.type === "sync";
    if (filter === "async") return m.type === "async";
    if (filter === "active")
      return m.status === "in_progress" || m.status === "scheduled";
    return true;
  });

  if (!company) return null;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* 사이드바: 회의 목록 */}
      <div className="w-72 shrink-0 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-semibold text-gray-900">회의</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-xs px-2 py-1 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
            >
              + 새 회의
            </button>
          </div>

          {/* 필터 탭 */}
          <div className="flex gap-1">
            {(["all", "active", "sync", "async"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-xs py-1 rounded-md transition ${
                  filter === f
                    ? "bg-indigo-100 text-indigo-700 font-medium"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {f === "all" ? "전체" : f === "active" ? "진행 중" : f === "sync" ? "동기" : "비동기"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm p-4">회의가 없습니다.</p>
          )}
          {filtered.map((meeting) => (
            <button
              key={meeting.id}
              onClick={() => setSelected(meeting)}
              className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition ${
                selected?.id === meeting.id ? "bg-indigo-50" : ""
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    meeting.status === "in_progress"
                      ? "bg-green-400"
                      : meeting.status === "concluded"
                      ? "bg-gray-300"
                      : "bg-yellow-400"
                  }`}
                />
                <span className="text-sm font-medium text-gray-900 truncate">
                  {meeting.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                  {meeting.type === "sync" ? "실시간" : "비동기"}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(meeting.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 메인: 선택된 회의 상세 */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <MeetingRoom
            meeting={selected}
            agents={agents ?? []}
            onConcluded={() => {
              // 목록 새로고침
              listMeetings(company.id).then(setMeetings);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="text-4xl mb-3">💬</p>
              <p className="text-sm">회의를 선택하거나 새 회의를 시작하세요.</p>
            </div>
          </div>
        )}
      </div>

      {/* 새 회의 생성 모달 */}
      {showCreateModal && (
        <CreateMeetingModal
          companyId={company.id}
          agents={agents ?? []}
          onCreated={(meeting) => {
            setMeetings((prev) => [meeting, ...prev]);
            setSelected(meeting);
            setShowCreateModal(false);
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

function CreateMeetingModal({
  companyId,
  agents,
  onCreated,
  onClose,
}: {
  companyId: string;
  agents: { id: string; name: string; role: string }[];
  onCreated: (meeting: Meeting) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"sync" | "async">("sync");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!title.trim()) { setError("제목을 입력하세요."); return; }
    if (selectedAgentIds.length === 0) { setError("참여 에이전트를 선택하세요."); return; }

    setCreating(true);
    setError("");
    try {
      const meeting = await createMeeting(companyId, {
        title,
        type,
        participantAgentIds: selectedAgentIds,
      });
      onCreated(meeting);
    } catch (e) {
      setError("회의 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-gray-900 mb-4">새 회의 시작</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="회의 제목을 입력하세요"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">회의 유형</label>
            <div className="flex gap-2">
              {(["sync", "async"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition ${
                    type === t
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t === "sync" ? "실시간 (동기)" : "정기 (비동기)"}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {type === "sync"
                ? "에이전트들이 즉시 소집되어 실시간으로 발언합니다."
                : "에이전트들이 다음 하트비트 때 순차적으로 의견을 작성합니다."}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">참여 에이전트</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {agents.map((agent) => (
                <label
                  key={agent.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedAgentIds.includes(agent.id)}
                    onChange={() => toggleAgent(agent.id)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-900">{agent.name}</span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {agent.role}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            취소
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40 transition font-medium"
          >
            {creating ? "생성 중..." : "시작하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 10 — ChatPage (비서 채팅 전용 페이지)

**파일:** `ui/src/pages/ChatPage.tsx` (신규)

`ChatPanel`을 전용 페이지로 감싸는 래퍼.

```tsx
import { ChatPanel } from "../components/chat/ChatPanel";
import { useCompany } from "../hooks/useCompany";

export function ChatPage() {
  const { company } = useCompany();

  if (!company) return null;

  return (
    <div className="h-[calc(100vh-64px)]">
      <ChatPanel companyId={company.id} />
    </div>
  );
}
```

---

### Task 11 — Approvals 페이지 확장

**파일:** `ui/src/pages/ApprovalsPage.tsx` (기존 파일 수정)

기존 Approvals 페이지에 다음을 추가한다:

#### 11-a. Proposal 유형별 필터 탭

기존 필터에 Proposal 유형별 탭을 추가한다.

```tsx
// 기존 필터 탭 옆에 추가
const PROPOSAL_TYPE_FILTERS = [
  { value: "all", label: "전체" },
  { value: "propose_goal", label: "목표 제안" },
  { value: "request_budget", label: "예산 요청" },
  { value: "propose_strategy", label: "전략 제안" },
  { value: "propose_hiring", label: "채용 제안" },
  { value: "escalation", label: "에스컬레이션" },
] as const;
```

#### 11-b. ProposalCard 컴포넌트

**파일:** `ui/src/components/approvals/ProposalCard.tsx` (신규)

구조화된 Proposal payload를 렌더링한다.

```tsx
interface ProposalPayload {
  summary?: string;
  rationale?: string;
  estimatedCost?: {
    monthlyCents?: number;
    oneTimeCents?: number;
    costJustification?: string;
  };
  urgency?: "low" | "medium" | "high";
  fromMeetingContext?: { meetingType: string };
  onApproveAction?: { type: string };
}

interface Props {
  type: string;
  payload: ProposalPayload;
}

export function ProposalCard({ type, payload }: Props) {
  const urgencyColor = {
    low: "text-gray-500 bg-gray-100",
    medium: "text-yellow-700 bg-yellow-100",
    high: "text-red-700 bg-red-100",
  };

  return (
    <div className="space-y-3">
      {/* 유형 배지 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">
          {type}
        </span>
        {payload.urgency && (
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              urgencyColor[payload.urgency]
            }`}
          >
            {payload.urgency === "high"
              ? "🔴 긴급"
              : payload.urgency === "medium"
              ? "🟡 보통"
              : "🟢 낮음"}
          </span>
        )}
        {payload.fromMeetingContext && (
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
            📋 {payload.fromMeetingContext.meetingType} 회의에서
          </span>
        )}
      </div>

      {/* 요약 */}
      {payload.summary && (
        <p className="text-sm font-medium text-gray-900">{payload.summary}</p>
      )}

      {/* 근거 */}
      {payload.rationale && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">근거</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{payload.rationale}</p>
        </div>
      )}

      {/* 비용 추정 */}
      {payload.estimatedCost && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 mb-1">💰 비용 추정</p>
          {payload.estimatedCost.monthlyCents && (
            <p className="text-sm text-amber-900">
              월 ${(payload.estimatedCost.monthlyCents / 100).toFixed(2)}
            </p>
          )}
          {payload.estimatedCost.oneTimeCents && (
            <p className="text-sm text-amber-900">
              일회성 ${(payload.estimatedCost.oneTimeCents / 100).toFixed(2)}
            </p>
          )}
          {payload.estimatedCost.costJustification && (
            <p className="text-xs text-amber-700 mt-1">
              {payload.estimatedCost.costJustification}
            </p>
          )}
        </div>
      )}

      {/* 승인 시 자동 실행 미리보기 */}
      {payload.onApproveAction && payload.onApproveAction.type !== "none" && (
        <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            ✨ 승인 시 자동 실행:{" "}
            <span className="font-medium">{payload.onApproveAction.type}</span>
          </p>
        </div>
      )}
    </div>
  );
}
```

기존 Approval 상세 뷰에서 `payload`를 `ProposalCard`로 렌더링하도록 교체한다.

---

### Task 12 — Dashboard 위젯 추가

**파일:** `ui/src/pages/DashboardPage.tsx` (기존 파일 수정)

기존 Dashboard에 두 개의 위젯을 추가한다.

#### 12-a. AdvisoryFeed 위젯

**파일:** `ui/src/components/dashboard/AdvisoryFeed.tsx` (신규)

```tsx
import { useEffect, useState } from "react";
import { listAdvisories, promoteAdvisory } from "../../api/advisories";

interface AdvisoryEntry {
  id: string;
  action: string;
  details: string;
  actorId: string;
  createdAt: string;
}

interface Props {
  companyId: string;
}

export function AdvisoryFeed({ companyId }: Props) {
  const [advisories, setAdvisories] = useState<AdvisoryEntry[]>([]);

  useEffect(() => {
    listAdvisories(companyId).then(setAdvisories);
  }, [companyId]);

  const actionLabel: Record<string, string> = {
    "agent.advisory.observation": "💡 발견",
    "agent.advisory.suggestion": "💬 제안",
    "agent.advisory.concern": "⚠️ 우려",
    "agent.advisory.progress_note": "📌 진행 보고",
  };

  const handlePromote = async (advisoryId: string) => {
    await promoteAdvisory(advisoryId);
    // 비서에게 promote 요청됐음을 사용자에게 알림
    alert("에이전트에게 Proposal 생성을 요청했습니다.");
  };

  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span>🔔</span> 에이전트 인사이트
      </h3>

      {advisories.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          에이전트의 의견이 없습니다.
        </p>
      )}

      <div className="space-y-2">
        {advisories.slice(0, 5).map((a) => {
          let details: { summary?: string } = {};
          try { details = JSON.parse(a.details); } catch {}

          return (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 py-2 border-b last:border-0"
            >
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500">
                  {actionLabel[a.action] ?? a.action}
                </span>
                <p className="text-sm text-gray-800 mt-0.5 truncate">
                  {details.summary ?? a.details}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(a.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
              <button
                onClick={() => handlePromote(a.id)}
                className="shrink-0 text-xs text-indigo-600 hover:underline"
              >
                결재로 올리기
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

#### 12-b. 미결 Proposal 배지

기존 Dashboard의 Approvals 링크/카드에 미결 Proposal 수를 배지로 표시한다.
기존 approval 목록 조회 API를 활용하고, `type`이 신규 Proposal 유형인 것만 카운트한다.

```tsx
// DashboardPage.tsx 또는 기존 Approvals 링크 컴포넌트 내에 추가
const PROPOSAL_TYPES = [
  "propose_goal", "propose_project", "propose_strategy",
  "request_budget", "propose_process", "propose_hiring", "escalation",
];

// 미결 Proposal 수 계산
const pendingProposalCount = approvals.filter(
  (a) => a.status === "pending" && PROPOSAL_TYPES.includes(a.type)
).length;

// 배지 렌더링
{pendingProposalCount > 0 && (
  <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full font-medium">
    {pendingProposalCount}
  </span>
)}
```

---

### Task 13 — 어댑터 선택 컴포넌트

**파일:** `ui/src/components/agents/AgentAdapterSelector.tsx` (신규)

에이전트 생성/수정 폼에서 어댑터 타입을 선택하는 컴포넌트.

```tsx
interface Props {
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  onChange: (type: string, config: Record<string, unknown>) => void;
}

const ADAPTER_OPTIONS = [
  { value: "claude_local", label: "Claude Code (Local)", description: "로컬 Claude Code 실행" },
  { value: "opencode_local", label: "OpenCode (멀티 프로바이더)", description: "Anthropic, OpenAI, Google, Zai 등 선택 가능" },
  { value: "codex_local", label: "Codex (OpenAI)", description: "OpenAI Codex 로컬 실행" },
  { value: "process", label: "Process (셸)", description: "셸 스크립트 실행" },
  { value: "http", label: "HTTP", description: "외부 HTTP 엔드포인트 호출" },
] as const;

export function AgentAdapterSelector({ adapterType, adapterConfig, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">어댑터 타입</label>
      <div className="space-y-2">
        {ADAPTER_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
              adapterType === opt.value
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="adapterType"
              value={opt.value}
              checked={adapterType === opt.value}
              onChange={() => onChange(opt.value, {})}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">{opt.label}</p>
              <p className="text-xs text-gray-500">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
```

---

### Task 14 — 모델 선택 컴포넌트 (OpenCode 전용)

**파일:** `ui/src/components/agents/OpenCodeModelSelector.tsx` (신규)

`opencode_local` 어댑터 선택 시 표시되는 프로바이더/모델 선택 UI.

```typescript
// ui/src/api/adapters.ts (신규 또는 기존 파일에 추가)
export async function getOpenCodeModels(): Promise<{ id: string; name?: string }[]> {
  const res = await fetch("/api/adapters/opencode_local/models");
  if (!res.ok) return [];
  return res.json();
}
```

```tsx
// ui/src/components/agents/OpenCodeModelSelector.tsx
import { useState, useEffect } from "react";
import { getOpenCodeModels } from "../../api/adapters";
import { getDefaultModelForRole } from "@paperclip/shared";

interface Props {
  model: string;
  role?: string;           // 역할 기반 자동 추천에 사용
  onChange: (model: string) => void;
}

export function OpenCodeModelSelector({ model, role, onChange }: Props) {
  const [models, setModels] = useState<{ id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState("");

  useEffect(() => {
    getOpenCodeModels()
      .then(setModels)
      .finally(() => setLoading(false));
  }, []);

  // 역할 변경 시 기본 모델 자동 추천
  useEffect(() => {
    if (role && !model) {
      const defaults = getDefaultModelForRole(role);
      if (defaults?.adapter === "opencode_local") {
        onChange(defaults.model);
      }
    }
  }, [role]);

  // provider/model 형식으로 그룹핑
  const providers = models.reduce<Record<string, string[]>>((acc, m) => {
    const [provider, ...rest] = m.id.split("/");
    if (provider && rest.length > 0) {
      acc[provider] = acc[provider] ?? [];
      acc[provider].push(m.id);
    }
    return acc;
  }, {});

  const providerList = Object.keys(providers);
  const currentProvider = model.split("/")[0] ?? selectedProvider;
  const modelList = providers[currentProvider] ?? [];

  if (loading) {
    return (
      <p className="text-sm text-gray-400 animate-pulse">모델 목록 로딩 중...</p>
    );
  }

  if (providerList.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        사용 가능한 모델을 불러올 수 없습니다.
        <br />
        <span className="text-xs">opencode가 설치되어 있고 API 키가 설정됐는지 확인하세요.</span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* 추천 배지 */}
      {role && getDefaultModelForRole(role)?.adapter === "opencode_local" && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-xs text-blue-700">
            💡 <strong>{role}</strong> 역할 추천 모델:{" "}
            <code className="font-mono">{getDefaultModelForRole(role)?.model}</code>
          </span>
          <button
            onClick={() => onChange(getDefaultModelForRole(role)!.model)}
            className="ml-auto text-xs text-blue-600 hover:underline shrink-0"
          >
            적용
          </button>
        </div>
      )}

      {/* 프로바이더 선택 */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">프로바이더</label>
        <select
          value={currentProvider}
          onChange={(e) => {
            setSelectedProvider(e.target.value);
            // 해당 프로바이더의 첫 번째 모델로 자동 선택
            const first = providers[e.target.value]?.[0];
            if (first) onChange(first);
          }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">프로바이더 선택</option>
          {providerList.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* 모델 선택 */}
      {currentProvider && (
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">모델</label>
          <select
            value={model}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">모델 선택</option>
            {modelList.map((m) => (
              <option key={m} value={m}>
                {m.split("/").slice(1).join("/")}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 선택된 모델 표시 */}
      {model && (
        <p className="text-xs text-gray-500">
          선택된 모델: <code className="font-mono text-indigo-600">{model}</code>
        </p>
      )}
    </div>
  );
}
```

---

### Task 15 — 에이전트 생성/수정 폼 확장

**파일:** `ui/src/pages/AgentFormPage.tsx` (기존 파일 수정)

기존 에이전트 생성/수정 폼에 아래를 추가한다.

1. `AgentAdapterSelector` 컴포넌트 통합
2. `opencode_local` 선택 시 `OpenCodeModelSelector` 노출
3. 역할 변경 시 기본 모델 자동 추천 연동

```tsx
// 기존 폼 내 어댑터 설정 섹션에 추가/교체
import { AgentAdapterSelector } from "../components/agents/AgentAdapterSelector";
import { OpenCodeModelSelector } from "../components/agents/OpenCodeModelSelector";

// 역할 선택 변경 핸들러
const handleRoleChange = (role: string) => {
  setRole(role);
  // 역할에 맞는 기본 어댑터/모델 자동 설정
  const defaults = getDefaultModelForRole(role);
  if (defaults) {
    setAdapterType(defaults.adapter);
    setAdapterConfig((prev) => ({ ...prev, model: defaults.model }));
  }
};

// 폼 렌더링 내부
<section>
  <h3 className="text-sm font-semibold text-gray-700 mb-3">어댑터 설정</h3>
  <AgentAdapterSelector
    adapterType={adapterType}
    adapterConfig={adapterConfig}
    onChange={(type, config) => {
      setAdapterType(type);
      setAdapterConfig(config);
    }}
  />

  {adapterType === "opencode_local" && (
    <div className="mt-4">
      <OpenCodeModelSelector
        model={(adapterConfig.model as string) ?? ""}
        role={role}
        onChange={(model) =>
          setAdapterConfig((prev) => ({ ...prev, model }))
        }
      />
    </div>
  )}
</section>
```

---

### Task 16 — 라우트 등록

**파일:** `ui/src/App.tsx` 또는 라우터 설정 파일 (기존 파일 수정)

새로 만든 페이지를 라우터에 등록한다.
기존 라우트 등록 패턴을 그대로 따른다.

```tsx
// 기존 라우트 아래에 추가
<Route path="/companies/:companyId/chat" element={<ChatPage />} />
<Route path="/companies/:companyId/meetings" element={<MeetingsPage />} />
```

---

### Task 17 — 내비게이션 메뉴 항목 추가

**파일:** 기존 사이드바/내비게이션 컴포넌트 (기존 파일 수정)

현재 내비게이션에서 `Chat`과 `Meetings` 항목을 추가한다.
기존 네비게이션 항목의 아이콘/레이블 형식을 그대로 따른다.

```tsx
// 기존 nav items 배열에 추가
{ href: `/companies/${companyId}/chat`,     icon: "💬", label: "비서 채팅" },
{ href: `/companies/${companyId}/meetings`, icon: "🏢", label: "회의" },
```

---

## 완료 기준

모든 Task 완료 후 아래를 확인한다:

```sh
# 타입 검사
pnpm -r typecheck

# 빌드
pnpm build
```

### 체크리스트

- [ ] `ui/src/api/meetings.ts` — 회의 API 클라이언트 구현됨
- [ ] `ui/src/api/chat.ts` — 채팅 API 클라이언트 구현됨
- [ ] `ui/src/api/advisories.ts` — Advisory API 클라이언트 구현됨
- [ ] `useMeetingMessages`, `useChatMessages` 훅 구현됨 (WebSocket 실시간 수신)
- [ ] `ChatMessage` 컴포넌트 구현됨 (인라인 액션 버튼 포함)
- [ ] `ChatPanel` 컴포넌트 구현됨 (메시지 송수신, 자동 스크롤)
- [ ] `MeetingMessage` 컴포넌트 구현됨 (에이전트 이름·역할 표시)
- [ ] `MeetingRoom` 컴포넌트 구현됨 (실시간 발언 목록, 종료 모달)
- [ ] `MeetingsPage` 구현됨 (목록 사이드바 + 회의방 + 생성 모달)
- [ ] `ChatPage` 구현됨
- [ ] 기존 `ApprovalsPage`에 Proposal 유형별 필터 탭 추가됨
- [ ] `ProposalCard` 컴포넌트 구현됨 (유형 배지, 비용 추정, 자동 실행 미리보기)
- [ ] `AdvisoryFeed` 위젯 구현됨 (Dashboard에 통합됨)
- [ ] Dashboard에 미결 Proposal 배지 추가됨
- [ ] `AgentAdapterSelector` 컴포넌트 구현됨
- [ ] `OpenCodeModelSelector` 컴포넌트 구현됨 (프로바이더 그룹핑, 역할 추천)
- [ ] 에이전트 생성/수정 폼에 어댑터/모델 선택 통합됨
- [ ] `/chat`, `/meetings` 라우트 등록됨
- [ ] 내비게이션에 채팅·회의 메뉴 추가됨
- [ ] 기존 페이지 핵심 동작 깨지지 않음
- [ ] `pnpm -r typecheck` 통과
- [ ] `pnpm build` 통과

---

## 주의사항

1. **기존 페이지 보존**: 기존 V1 페이지(Dashboard, Issues, Agents 등)의 핵심 동작을 변경하거나 깨지 않는다.
2. **스타일 일관성**: 기존 컴포넌트의 Tailwind 클래스 패턴, 색상 팔레트, 버튼 스타일을 그대로 따른다.
3. **에러 처리**: API 호출 실패를 사용자에게 명확히 표시한다. 에러를 조용히 무시하지 않는다.
4. **API 미완성 시**: Agent 1의 API가 아직 준비되지 않았다면, 타입과 컴포넌트 골격을 먼저 구현하고 API 연동은 나중에 붙인다. 목 데이터를 사용해도 된다.
5. **Agent 3 의존**: `@paperclip/shared`의 신규 타입·상수가 빌드되어 있어야 import 가능하다. Agent 3 완료 후 연동한다.
6. **기존 훅 활용**: `useCompany`, `useAgents` 등 기존 훅의 실제 시그니처를 파악한 후 사용한다. 없으면 직접 구현한다.
7. **`apiFetch` 래퍼**: 기존 API 클라이언트의 fetch 래퍼 함수를 파악하고 동일하게 사용한다. 없으면 `fetch`를 직접 호출한다.

---

## 참고 문서

- `doc/COWORKER-AUTONOMY.md` §8 — 채팅 시스템 UX 상세
- `doc/COWORKER-AUTONOMY.md` §16 — UI 변경사항 목록
- `doc/AUTONOMOUS-COMPANY-ROADMAP.md` §Phase 1 — 회의 UI 설계
- `doc/AUTONOMOUS-COMPANY-ROADMAP.md` §UI 변경사항 — 신규 페이지 목록
- `doc/ROLE_BASED_MODEL_ASSIGNMENT.md` §Phase 1 — 어댑터/모델 선택 UI 계획