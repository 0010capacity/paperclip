import { api } from "./client";

// Types - these will be moved to @paperclipai/shared by Agent 3
export interface ChatMessage {
  id: string;
  companyId: string;
  senderType: "user" | "assistant";
  content: string;
  contentType: "text" | "action_request";
  actionStatus?: "pending" | "confirmed" | "rejected";
  createdAt: string;
}

export interface SendChatMessageInput {
  content: string;
}

export interface ResolveChatActionInput {
  decision: "confirmed" | "rejected";
}

export const chatApi = {
  list: (companyId: string, limit = 50) =>
    api.get<ChatMessage[]>(`/companies/${companyId}/chat?limit=${limit}`),

  send: (companyId: string, data: SendChatMessageInput) =>
    api.post<ChatMessage>(`/companies/${companyId}/chat`, data),

  resolveAction: (messageId: string, data: ResolveChatActionInput) =>
    api.post<ChatMessage>(`/chat/${messageId}/resolve`, data),
};
