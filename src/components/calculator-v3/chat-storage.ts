/**
 * The chat conversations, stored in `localStorage` and exposed as an external
 * store for `useSyncExternalStore`.
 *
 * The panel lives in an iframe inside the legacy calculator, so anything that
 * reloads that page — a refresh, or navigating away and back — unmounts it.
 * Without this the conversations were lost every time.
 *
 * `localStorage` cannot be read while rendering: this app is statically
 * exported, so the prerendered HTML would disagree with the first client
 * render. `getServerChatSnapshot` therefore reports a single empty
 * conversation and React swaps in the stored ones after hydration.
 *
 * Every access is wrapped. `localStorage` throws rather than returning null in
 * a private window or when site data is blocked, and stored JSON can be stale
 * from an older shape, so a failure here degrades to an empty conversation
 * instead of breaking the panel.
 */

import type { ChatMessage } from "./chat-client";

/**
 * Namespaced and versioned. A BYOK key would live under its own key, never
 * mixed into the transcripts.
 */
const STORAGE_KEY = "ro-assistant:calculator-v3-chat:v2";

/** Single-transcript layout this store replaced; read once, then migrated. */
const LEGACY_STORAGE_KEY = "ro-assistant:calculator-v3-chat:v1";

/**
 * Enough for a long session while staying far below the ~5MB origin quota.
 * The oldest messages are dropped first so the recent conversation survives.
 */
const MAX_STORED_MESSAGES = 200;

/** Beyond this the least recently used conversation is dropped. */
const MAX_CONVERSATIONS = 20;

const DEFAULT_TITLE = "บทสนทนาใหม่";

/** Long enough to tell conversations apart, short enough for a tab. */
const MAX_TITLE_LENGTH = 28;

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatStoreState {
  conversations: Conversation[];
  activeId: string;
}

/**
 * Stable identity for the prerendered pass, so the server and the first client
 * render agree on an empty panel.
 */
const SERVER_STATE: ChatStoreState = {
  conversations: [
    {
      id: "server-placeholder",
      title: DEFAULT_TITLE,
      messages: [],
      createdAt: 0,
      updatedAt: 0,
    },
  ],
  activeId: "server-placeholder",
};

const listeners = new Set<() => void>();

/**
 * `getSnapshot` must return a stable reference for an unchanged store, so the
 * parsed state is held here rather than re-parsed on every render.
 */
let cache: ChatStoreState | null = null;

function newId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    (entry.role === "user" || entry.role === "assistant") &&
    typeof entry.text === "string" &&
    typeof entry.createdAt === "number"
  );
}

function createConversationRecord(messages: ChatMessage[] = []): Conversation {
  const now = Date.now();
  return {
    id: newId(),
    title: deriveTitle(messages),
    messages,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Names a tab after the question that started it, the way a chat client does,
 * so switching between conversations does not mean opening each one to tell
 * them apart. A conversation with no question yet keeps the default name.
 */
function deriveTitle(messages: ChatMessage[]): string {
  const firstQuestion = messages.find((message) => message.role === "user");
  if (!firstQuestion) return DEFAULT_TITLE;

  const text = firstQuestion.text.replace(/\s+/g, " ").trim();
  if (!text) return DEFAULT_TITLE;

  return text.length > MAX_TITLE_LENGTH
    ? `${text.slice(0, MAX_TITLE_LENGTH)}…`
    : text;
}

function parseConversation(value: unknown): Conversation | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string") return null;

  const messages = Array.isArray(entry.messages)
    ? entry.messages.filter(isChatMessage)
    : [];

  return {
    id: entry.id,
    title: typeof entry.title === "string" ? entry.title : deriveTitle(messages),
    messages,
    createdAt: typeof entry.createdAt === "number" ? entry.createdAt : 0,
    updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0,
  };
}

/** Reads the transcript written by the single-conversation version of this store. */
function readLegacyState(): ChatStoreState | null {
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return null;

  const messages = parsed.filter(isChatMessage);
  if (messages.length === 0) return null;

  const conversation = createConversationRecord(messages);
  return { conversations: [conversation], activeId: conversation.id };
}

function freshState(): ChatStoreState {
  const conversation = createConversationRecord();
  return { conversations: [conversation], activeId: conversation.id };
}

function readFromStorage(): ChatStoreState {
  if (typeof window === "undefined") return SERVER_STATE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return readLegacyState() ?? freshState();

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return freshState();

    const entry = parsed as Record<string, unknown>;
    const conversations = Array.isArray(entry.conversations)
      ? entry.conversations
          .map(parseConversation)
          .filter((item): item is Conversation => item !== null)
      : [];

    if (conversations.length === 0) return freshState();

    const activeId =
      typeof entry.activeId === "string" &&
      conversations.some((item) => item.id === entry.activeId)
        ? entry.activeId
        : conversations[0].id;

    return { conversations, activeId };
  } catch {
    return freshState();
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function commit(state: ChatStoreState): void {
  cache = state;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, ...state }),
    );
    // The migrated copy is no longer read once v2 exists.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // A full quota must not stop the user from carrying on the conversation:
    // the transcripts stay in memory for this session either way.
  }

  notify();
}

export function subscribeChatStore(listener: () => void): () => void {
  listeners.add(listener);

  // Another tab writing the conversations invalidates what is cached here.
  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    cache = null;
    notify();
  }

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getChatSnapshot(): ChatStoreState {
  cache ??= readFromStorage();
  return cache;
}

export function getServerChatSnapshot(): ChatStoreState {
  return SERVER_STATE;
}

export function setActiveConversation(id: string): void {
  const state = getChatSnapshot();
  if (state.activeId === id) return;
  if (!state.conversations.some((item) => item.id === id)) return;

  commit({ ...state, activeId: id });
}

export function createConversation(): void {
  const state = getChatSnapshot();
  const conversation = createConversationRecord();
  const conversations = [...state.conversations, conversation];

  // Drop the least recently used tab once the cap is reached, never the one
  // being opened.
  while (conversations.length > MAX_CONVERSATIONS) {
    const oldest = conversations
      .filter((item) => item.id !== conversation.id)
      .reduce((a, b) => (a.updatedAt <= b.updatedAt ? a : b));
    conversations.splice(conversations.indexOf(oldest), 1);
  }

  commit({ conversations, activeId: conversation.id });
}

export function deleteConversation(id: string): void {
  const state = getChatSnapshot();
  if (!state.conversations.some((item) => item.id === id)) return;

  const remaining = state.conversations.filter((item) => item.id !== id);

  // Closing the last tab leaves an empty one rather than no panel at all.
  if (remaining.length === 0) {
    commit(freshState());
    return;
  }

  const activeId =
    state.activeId === id
      ? (remaining[
          Math.min(
            state.conversations.findIndex((item) => item.id === id),
            remaining.length - 1,
          )
        ]?.id ?? remaining[0].id)
      : state.activeId;

  commit({ conversations: remaining, activeId });
}

export function writeMessages(
  conversationId: string,
  messages: ChatMessage[],
): void {
  const state = getChatSnapshot();
  const trimmed =
    messages.length > MAX_STORED_MESSAGES
      ? messages.slice(-MAX_STORED_MESSAGES)
      : messages;

  const conversations = state.conversations.map((item) =>
    item.id === conversationId
      ? {
          ...item,
          messages: trimmed,
          // A tab still on the default name follows its first question; once
          // named it keeps that name even if the conversation is cleared.
          title:
            item.title === DEFAULT_TITLE ? deriveTitle(trimmed) : item.title,
          updatedAt: Date.now(),
        }
      : item,
  );

  commit({ ...state, conversations });
}
