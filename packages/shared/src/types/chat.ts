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
  meetingId: string | null; // 동기 회의와 연결된 경우
  actionPayload: Record<string, unknown> | null;
  actionStatus: ChatActionStatus | null;
  createdAt: string;
}
