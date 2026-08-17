import { z } from 'zod';

export const CHAT_ROLES = ['user', 'assistant', 'tool', 'system'] as const;

export const toolCallSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()).default({}),
  ok: z.boolean(),
  pending: z.boolean().optional(),
});
export type ToolCall = z.infer<typeof toolCallSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(CHAT_ROLES),
  content: z.string(),
  tool_calls: z.array(toolCallSchema).nullable(),
  created_at: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const pendingActionSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()).default({}),
  prompt: z.string(),
});
export type PendingAction = z.infer<typeof pendingActionSchema>;

export const chatResponseSchema = z.object({
  threadId: z.string(),
  messages: z.array(chatMessageSchema),
  pendingAction: pendingActionSchema.nullable(),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;
