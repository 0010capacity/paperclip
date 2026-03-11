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
  contentType: z
    .enum(["text", "action_request", "action_result"])
    .default("text"),
  actionPayload: z.record(z.unknown()).optional(),
});

export type CreateMeetingMessageInput = z.infer<
  typeof CreateMeetingMessageSchema
>;
