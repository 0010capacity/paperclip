import { api } from "./client";

// Types - these will be moved to @paperclipai/shared by Agent 3
export interface Meeting {
  id: string;
  companyId: string;
  title: string;
  type: "sync" | "async";
  status: "scheduled" | "in_progress" | "concluded" | "cancelled";
  summary?: string;
  createdAt: string;
  concludedAt?: string;
}

export interface MeetingParticipant {
  id: string;
  meetingId: string;
  agentId: string;
  joinedAt: string;
}

export interface MeetingMessage {
  id: string;
  meetingId: string;
  senderAgentId: string | null; // null = user
  content: string;
  contentType: "text" | "action_request";
  actionStatus?: "pending" | "confirmed" | "rejected";
  createdAt: string;
}

export interface CreateMeetingInput {
  title: string;
  type: "sync" | "async";
  participantAgentIds: string[];
}

export interface ConcludeMeetingInput {
  summary: string;
}

export interface CreateMeetingMessageInput {
  content: string;
  contentType?: "text" | "action_request";
}

export const meetingsApi = {
  list: (companyId: string) =>
    api.get<Meeting[]>(`/companies/${companyId}/meetings`),

  get: (meetingId: string) =>
    api.get<Meeting>(`/meetings/${meetingId}`),

  create: (companyId: string, data: CreateMeetingInput) =>
    api.post<Meeting>(`/companies/${companyId}/meetings`, data),

  conclude: (meetingId: string, data: ConcludeMeetingInput) =>
    api.post<Meeting>(`/meetings/${meetingId}/conclude`, data),

  cancel: (meetingId: string) =>
    api.delete<Meeting>(`/meetings/${meetingId}`),

  messages: {
    list: (meetingId: string) =>
      api.get<MeetingMessage[]>(`/meetings/${meetingId}/messages`),

    send: (meetingId: string, data: CreateMeetingMessageInput) =>
      api.post<MeetingMessage>(`/meetings/${meetingId}/messages`, data),
  },
};
