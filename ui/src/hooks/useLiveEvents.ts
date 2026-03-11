import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { meetingsApi, chatApi, type MeetingMessage, type ChatMessage } from "../api";
import { queryKeys } from "../lib/queryKeys";
import { useCompany } from "../context/CompanyContext";

// ===== Chat Hooks =====

export function useChatMessages(limit = 50) {
  const { selectedCompanyId } = useCompany();

  return useQuery({
    queryKey: queryKeys.chat.messages(selectedCompanyId!),
    queryFn: () => chatApi.list(selectedCompanyId!, limit),
    enabled: !!selectedCompanyId,
  });
}

export function useSendChatMessage() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => chatApi.send(selectedCompanyId!, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(selectedCompanyId!) });
    },
  });
}

export function useResolveChatAction() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, decision }: { messageId: string; decision: "confirmed" | "rejected" }) =>
      chatApi.resolveAction(messageId, { decision }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(selectedCompanyId!) });
    },
  });
}

// ===== Meeting Hooks =====

export function useMeetings() {
  const { selectedCompanyId } = useCompany();

  return useQuery({
    queryKey: queryKeys.meetings.list(selectedCompanyId!),
    queryFn: () => meetingsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
}

export function useMeeting(meetingId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.meetings.detail(meetingId!),
    queryFn: () => meetingsApi.get(meetingId!),
    enabled: !!meetingId,
  });
}

export function useMeetingMessages(meetingId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.meetings.messages(meetingId!),
    queryFn: () => meetingsApi.messages.list(meetingId!),
    enabled: !!meetingId,
  });
}

export function useCreateMeeting() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof meetingsApi.create>[1]) =>
      meetingsApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.list(selectedCompanyId!) });
    },
  });
}

export function useConcludeMeeting() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, summary }: { meetingId: string; summary: string }) =>
      meetingsApi.conclude(meetingId, { summary }),
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.detail(meetingId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.messages(meetingId) });
    },
  });
}

export function useCancelMeeting() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (meetingId: string) => meetingsApi.cancel(meetingId),
    onSuccess: (_, meetingId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.detail(meetingId) });
    },
  });
}

export function useSendMeetingMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, content, contentType }: {
      meetingId: string;
      content: string;
      contentType?: "text" | "action_request";
    }) => meetingsApi.messages.send(meetingId, { content, contentType }),
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.messages(meetingId) });
    },
  });
}
