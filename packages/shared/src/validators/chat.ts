import { z } from "zod";

export const SendChatMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

export type SendChatMessageInput = z.infer<typeof SendChatMessageSchema>;

export const ResolveChatActionSchema = z.object({
  decision: z.enum(["confirmed", "rejected"]),
});

export type ResolveChatActionInput = z.infer<typeof ResolveChatActionSchema>;
