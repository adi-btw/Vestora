import { optionalEnv, requireEnv } from '../env.ts';
import { fetchJson } from '../fetch-json.ts';
import { HttpError } from '../http.ts';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const PROVIDER = 'gemini';

/** Flash models are the ones on the free tier; Pro moved behind billing. */
const DEFAULT_MODEL = 'gemini-3.6-flash';

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export type GeminiContent = {
  role: 'user' | 'model';
  parts: GeminiPart[];
};

export type FunctionDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type GenerateOptions = {
  contents: GeminiContent[];
  systemInstruction?: string;
  tools?: FunctionDeclaration[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Forces JSON output matching this schema (OpenAPI subset). */
  responseSchema?: Record<string, unknown>;
};

type GeminiResponse = {
  candidates?: {
    content?: { parts?: GeminiPart[]; role?: string };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

export type GeminiResult = {
  text: string;
  functionCalls: { name: string; args: Record<string, unknown> }[];
  finishReason: string | null;
};

/**
 * Free-tier limits are per-day, so an exhausted quota is a different situation
 * from ordinary throttling: the app should stop retrying and tell the user when it
 * resets rather than spinning.
 */
function mapGeminiError(status: number, body: string): HttpError | null {
  if (status !== 429) return null;

  const isDailyQuota = /quota|per day|daily/i.test(body);
  return isDailyQuota
    ? new HttpError(
        429,
        'quota_exhausted',
        'The free daily AI quota is used up. It resets at midnight Pacific.',
      )
    : null;
}

export function isConfigured(): boolean {
  return Boolean(optionalEnv('GEMINI_API_KEY'));
}

export function modelName(): string {
  return optionalEnv('GEMINI_MODEL') ?? DEFAULT_MODEL;
}

export async function generate(options: GenerateOptions): Promise<GeminiResult> {
  const model = modelName();
  const url = `${BASE_URL}/models/${model}:generateContent?key=${requireEnv('GEMINI_API_KEY')}`;

  const body: Record<string, unknown> = {
    contents: options.contents,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxOutputTokens ?? 1_024,
      ...(options.responseSchema
        ? { responseMimeType: 'application/json', responseSchema: options.responseSchema }
        : {}),
    },
  };

  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }
  if (options.tools?.length) {
    body.tools = [{ functionDeclarations: options.tools }];
  }

  const raw = await fetchJson<GeminiResponse>(url, {
    provider: PROVIDER,
    method: 'POST',
    body,
    retries: 1,
    timeoutMs: 30_000,
    mapError: mapGeminiError,
  });

  if (raw.promptFeedback?.blockReason) {
    throw new HttpError(
      422,
      'content_blocked',
      `The model declined to answer (${raw.promptFeedback.blockReason}).`,
    );
  }

  const candidate = raw.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  const text = parts
    .filter((part): part is { text: string } => 'text' in part)
    .map((part) => part.text)
    .join('')
    .trim();

  const functionCalls = parts
    .filter(
      (part): part is { functionCall: { name: string; args: Record<string, unknown> } } =>
        'functionCall' in part,
    )
    .map((part) => ({
      name: part.functionCall.name,
      args: part.functionCall.args ?? {},
    }));

  return { text, functionCalls, finishReason: candidate?.finishReason ?? null };
}

/**
 * Structured generation with a schema. Gemini honours `responseSchema` but still
 * occasionally wraps JSON in a code fence, so the text is cleaned before parsing.
 */
export async function generateJson<T>(
  options: GenerateOptions & { responseSchema: Record<string, unknown> },
): Promise<T> {
  const result = await generate(options);
  const cleaned = result.text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  if (!cleaned) {
    throw new HttpError(502, 'empty_model_response', 'The model returned nothing to parse.');
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error('Model returned unparseable JSON', cleaned.slice(0, 400));
    throw new HttpError(502, 'invalid_model_json', 'The model returned malformed JSON.');
  }
}
