import { chatResponseSchema, type ChatMessage, type PendingAction } from '@/features/chat/schemas';
import type { ChatThreadRow } from '@/lib/database.types';
import { invokeFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

const FUNCTION_NAME = 'ai-chat';

export async function fetchThreads(): Promise<ChatThreadRow[]> {
  const { data, error } = await supabase
    .from('chat_threads')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

export async function fetchMessages(threadId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export function sendChatTurn(params: {
  threadId?: string;
  message?: string;
  confirm?: Pick<PendingAction, 'name' | 'args'>;
}) {
  return invokeFunction(FUNCTION_NAME, { ...params }, chatResponseSchema);
}

export async function deleteThread(threadId: string): Promise<void> {
  const { error } = await supabase.from('chat_threads').delete().eq('id', threadId);
  if (error) throw error;
}
