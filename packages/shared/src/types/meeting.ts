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
