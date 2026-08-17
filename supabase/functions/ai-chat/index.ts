// AI advisor endpoint.
//
// One request = one user turn. The model may call read-only market tools as many
// times as it needs (bounded below) before answering; write tools stop the loop
// and come back to the client as a confirmation prompt instead of executing.

import { requireUser, type AuthenticatedContext } from '../_shared/clients.ts';
import {
  describeWriteAction,
  isWriteTool,
  runTool,
  TOOL_DECLARATIONS,
  type ToolContext,
} from '../_shared/chat-tools.ts';
import { z } from '../_shared/deps.ts';
import { HttpError, jsonResponse, parseJsonBody, serveJson } from '../_shared/http.ts';
import * as gemini from '../_shared/providers/gemini.ts';
import { enforceRateLimit, RATE_LIMITS } from '../_shared/rate-limit.ts';

const SYSTEM_INSTRUCTION = `You are the research assistant inside Stock Watch, a portfolio tracking app.

How you work:
- Never state a price, ratio, or headline from memory. Call a tool and use what it returns.
- If a question needs data you cannot fetch, say so plainly.
- Personalised questions ("my stocks", "what should I watch") start with get_watchlist.
- Prefer two or three well-chosen tool calls over many.

How you write:
- Plain prose, no markdown headings. Short paragraphs; a bullet list only for three or more comparable items.
- Lead with the answer, then the evidence, with concrete numbers.
- Aim for under 150 words unless asked for depth.

Boundaries:
- You are not a licensed advisor. Explain trade-offs and risks; never say buy, sell, or hold, never predict prices, never suggest position sizes.
- Paper trading in this app uses simulated money - say so if the user seems to think otherwise.`;

const MAX_TOOL_ROUNDS = 4;
const HISTORY_LIMIT = 20;

const requestSchema = z.object({
  threadId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(2_000).optional(),
  /** Set when the user approves a write action the model proposed earlier. */
  confirm: z
    .object({
      name: z.string().min(1),
      args: z.record(z.string(), z.unknown()).default({}),
    })
    .optional(),
});

type StoredToolCall = {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  /** Present only while the call is awaiting user approval. */
  pending?: boolean;
};

type MessageRow = {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_calls: StoredToolCall[] | null;
  created_at: string;
};

async function ensureThread(
  { db, userId }: AuthenticatedContext,
  threadId: string | undefined,
  firstMessage: string | undefined,
): Promise<string> {
  if (threadId) {
    const { data, error } = await db
      .from('chat_threads')
      .select('id')
      .eq('id', threadId)
      .maybeSingle();

    if (error) throw new HttpError(500, 'thread_read_failed', error.message);
    if (!data) throw new HttpError(404, 'thread_not_found', 'That conversation no longer exists.');
    return threadId;
  }

  // Title from the opening question - cheap, and better than "New chat".
  const title = (firstMessage ?? 'New chat').slice(0, 60);
  const { data, error } = await db
    .from('chat_threads')
    .insert({ user_id: userId, title })
    .select('id')
    .single();

  if (error) throw new HttpError(500, 'thread_create_failed', error.message);
  return data.id as string;
}

async function loadHistory(
  db: AuthenticatedContext['db'],
  threadId: string,
): Promise<MessageRow[]> {
  const { data, error } = await db
    .from('chat_messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) throw new HttpError(500, 'history_read_failed', error.message);
  return ((data ?? []) as MessageRow[]).reverse();
}

async function saveMessage(
  { db, userId }: AuthenticatedContext,
  threadId: string,
  message: { role: MessageRow['role']; content: string; toolCalls?: StoredToolCall[] | null },
): Promise<MessageRow> {
  const { data, error } = await db
    .from('chat_messages')
    .insert({
      thread_id: threadId,
      user_id: userId,
      role: message.role,
      content: message.content,
      tool_calls: message.toolCalls ?? null,
    })
    .select('id, role, content, tool_calls, created_at')
    .single();

  if (error) throw new HttpError(500, 'message_write_failed', error.message);
  return data as MessageRow;
}

/** Prior turns as Gemini contents. Tool traces stay out: their results are stale. */
function toContents(history: MessageRow[]): gemini.GeminiContent[] {
  return history
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .filter((row) => row.content.trim().length > 0)
    .map((row) => ({
      role: row.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: row.content }],
    }));
}

Deno.serve(
  serveJson(async (request) => {
    const context = await requireUser(request);
    const { db, admin, userId } = context;

    await enforceRateLimit(admin, userId, RATE_LIMITS.aiChat);
    await enforceRateLimit(admin, userId, RATE_LIMITS.aiChatDaily);

    if (!gemini.isConfigured()) {
      throw new HttpError(
        503,
        'ai_unavailable',
        'The AI advisor is not configured on this deployment.',
      );
    }

    const parsed = requestSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      throw new HttpError(
        400,
        'invalid_request',
        parsed.error.issues[0]?.message ?? 'Bad request.',
      );
    }

    const { message, confirm } = parsed.data;
    if (!message && !confirm) {
      throw new HttpError(400, 'invalid_request', 'Send a message or a confirmed action.');
    }

    const threadId = await ensureThread(context, parsed.data.threadId, message);
    const toolContext: ToolContext = { db, admin, userId };
    const savedMessages: MessageRow[] = [];
    let confirmOutcome: string | null = null;

    // A confirmed write runs before the model gets another turn, so its answer can
    // reflect the change it just made.
    if (confirm) {
      if (!isWriteTool(confirm.name)) {
        throw new HttpError(400, 'not_confirmable', `${confirm.name} does not need confirmation.`);
      }

      try {
        await runTool(confirm.name, confirm.args, toolContext);
        confirmOutcome = describeWriteAction(confirm.name, confirm.args).replace(/\?$/, ' - done.');
        savedMessages.push(
          await saveMessage(context, threadId, {
            role: 'tool',
            content: confirmOutcome,
            toolCalls: [{ name: confirm.name, args: confirm.args, ok: true }],
          }),
        );
      } catch (error) {
        confirmOutcome = error instanceof HttpError ? error.message : 'The action failed.';
        savedMessages.push(
          await saveMessage(context, threadId, {
            role: 'tool',
            content: confirmOutcome,
            toolCalls: [{ name: confirm.name, args: confirm.args, ok: false }],
          }),
        );
      }
    }

    if (message) {
      savedMessages.push(await saveMessage(context, threadId, { role: 'user', content: message }));
    }

    const history = await loadHistory(db, threadId);
    const contents = toContents(history);

    // Tool receipts are not conversation turns, so a bare confirmation leaves the
    // transcript ending on the model. State the outcome as a user turn instead.
    if (!message && confirmOutcome) {
      contents.push({
        role: 'user',
        parts: [{ text: `${confirmOutcome} Acknowledge in one short sentence.` }],
      });
    }

    // Nothing for the model to answer.
    if (contents.length === 0) {
      return jsonResponse({ threadId, messages: savedMessages, pendingAction: null });
    }

    const executed: StoredToolCall[] = [];
    let pendingAction: { name: string; args: Record<string, unknown>; prompt: string } | null =
      null;
    let answer = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const result = await gemini.generate({
        contents,
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: TOOL_DECLARATIONS,
        temperature: 0.35,
        maxOutputTokens: 900,
      });

      if (result.functionCalls.length === 0) {
        answer = result.text;
        break;
      }

      const write = result.functionCalls.find((call) => isWriteTool(call.name));
      if (write) {
        pendingAction = {
          name: write.name,
          args: write.args,
          prompt: describeWriteAction(write.name, write.args),
        };
        answer = result.text || pendingAction.prompt;
        break;
      }

      // Echo the model's calls back before the results, which is the shape Gemini
      // expects for multi-turn function calling.
      contents.push({
        role: 'model',
        parts: result.functionCalls.map((call) => ({
          functionCall: { name: call.name, args: call.args },
        })),
      });

      const responses: gemini.GeminiPart[] = [];
      for (const call of result.functionCalls) {
        try {
          const output = await runTool(call.name, call.args, toolContext);
          executed.push({ name: call.name, args: call.args, ok: true });
          responses.push({
            functionResponse: { name: call.name, response: { result: output } },
          });
        } catch (error) {
          const detail = error instanceof HttpError ? error.message : 'Tool failed.';
          executed.push({ name: call.name, args: call.args, ok: false });
          // The model handles a failed tool better than a 500 does.
          responses.push({ functionResponse: { name: call.name, response: { error: detail } } });
        }
      }

      contents.push({ role: 'user', parts: responses });
    }

    if (!answer) {
      answer = 'I could not finish that lookup. Try asking about one or two tickers at a time.';
    }

    savedMessages.push(
      await saveMessage(context, threadId, {
        role: 'assistant',
        content: answer,
        toolCalls: pendingAction
          ? [
              ...executed,
              { name: pendingAction.name, args: pendingAction.args, ok: false, pending: true },
            ]
          : executed.length > 0
            ? executed
            : null,
      }),
    );

    return jsonResponse({ threadId, messages: savedMessages, pendingAction });
  }),
);
