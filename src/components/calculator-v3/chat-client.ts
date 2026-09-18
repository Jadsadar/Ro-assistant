/**
 * The seam between the Chat panel and whatever answers it.
 *
 * The panel never composes an answer itself. This module talks to the PSU AI
 * Gateway (https://ai.psu.blue), an OpenAI-compatible endpoint, and returns the
 * assistant's reply verbatim.
 *
 * Deliberately not here yet, so this step stays reviewable on its own:
 *   - no system prompt, so the model is not yet told the guardrail from STEP 14
 *     of FIX_PLAN_TH.txt (every number must come from the calculator or the
 *     advisor, never from the model)
 *   - no tool calls, so `ChatBuildContext` is carried through the request type
 *     but not yet sent
 *
 * Until the system prompt lands, treat replies as untrusted for anything
 * numeric: the model has no access to the engine and will guess if asked.
 *
 * The panel does not change when those land — only this file does.
 */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
}

/** What the assistant is allowed to see about the current build. */
export interface ChatBuildContext {
  className: string;
  skillId: string;
  monsterName: string;
  equippedCount: number;
  /** Present only once the engine has produced a result. */
  damage?: { min: number; max: number; dps: number };
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  context: ChatBuildContext;
  /** Aborts the request when the user stops the reply. */
  signal?: AbortSignal;
}

export interface ChatResponse {
  text: string;
  /** True when the reply came from a real assistant rather than a stub. */
  answered: boolean;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_PSU_BASE_URL ?? "https://ai.psu.blue/v1";
const MODEL = process.env.NEXT_PUBLIC_PSU_MODEL ?? "openai/gpt-4o-mini";
const API_KEY = process.env.NEXT_PUBLIC_PSU_API_KEY ?? "";

/**
 * Several gateway models (the qwen family especially) are reasoning models that
 * spend hundreds of tokens thinking before emitting any content. Too small a
 * budget returns `finish_reason: "length"` with `content: null`, so this is set
 * well above what the visible answer needs.
 */
const MAX_TOKENS = 2048;
const TIMEOUT_MS = 60_000;

interface CompletionResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
}

export function createMessage(role: ChatRole, text: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAt: Date.now(),
  };
}

export async function sendChatMessage({
  history,
  signal,
}: ChatRequest): Promise<ChatResponse> {
  if (!API_KEY) {
    return {
      answered: false,
      text: [
        "ยังไม่ได้ตั้งค่า API key จึงยังตอบไม่ได้",
        "",
        "ใส่ค่านี้ในไฟล์ .env ที่รากโปรเจค แล้วรีสตาร์ท dev server:",
        "NEXT_PUBLIC_PSU_API_KEY=<key จาก https://ai.psu.blue/api-key>",
      ].join("\n"),
    };
  }

  // `history` already ends with the message just submitted, so sending it as-is
  // avoids repeating that message to the model.
  const messages = history.map((entry) => ({
    role: entry.role,
    content: entry.text,
  }));

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: MAX_TOKENS,
      stream: false,
    }),
    // The timeout still applies once the user can stop the reply themselves,
    // so a request that is neither answered nor stopped does not hang forever.
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
      : AbortSignal.timeout(TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => null)) as
    | CompletionResponse
    | null;

  if (!response.ok) {
    const detail = payload?.error?.message ?? response.statusText;
    throw new Error(`เรียกผู้ช่วยไม่สำเร็จ (${response.status}): ${detail}`);
  }

  const choice = payload?.choices?.[0];
  const text = choice?.message?.content?.trim();

  if (!text) {
    // A reasoning model that ran out of budget reports this rather than an error.
    const reason =
      choice?.finish_reason === "length"
        ? "โมเดลใช้ token หมดก่อนตอบ ลองถามให้สั้นลง หรือเปลี่ยนโมเดลใน .env"
        : "ผู้ช่วยไม่ได้ส่งข้อความกลับมา";
    throw new Error(reason);
  }

  return { answered: true, text };
}
