"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  createMessage,
  sendChatMessage,
  type ChatBuildContext,
} from "./chat-client";
import {
  createConversation,
  deleteConversation,
  getChatSnapshot,
  getServerChatSnapshot,
  setActiveConversation,
  subscribeChatStore,
  writeMessages,
} from "./chat-storage";
import styles from "./calculator-v3.module.css";

const SUGGESTIONS = [
  "ทำไมดาเมจถึงต่ำกว่าที่คาด",
  "อาวุธชิ้นไหนคุ้มที่สุดตอนนี้",
];

interface ChatPanelProps {
  context: ChatBuildContext;
}

/**
 * Stopping is a choice, not a failure, so it leaves no error behind — the
 * question simply stays in the log unanswered. A timeout reads as an abort too
 * and has to be told apart from a deliberate stop.
 */
function describeFailure(reason: unknown): string | null {
  if (reason instanceof DOMException) {
    if (reason.name === "AbortError") return null;
    if (reason.name === "TimeoutError") {
      return "ผู้ช่วยใช้เวลานานเกินไป ลองถามใหม่หรือเปลี่ยนโมเดลใน .env";
    }
  }

  return reason instanceof Error ? reason.message : "ส่งข้อความไม่สำเร็จ";
}

export function ChatPanel({ context }: ChatPanelProps) {
  // The conversations live in localStorage rather than component state, so they
  // survive the iframe reloading with the legacy calculator around it.
  const { conversations, activeId } = useSyncExternalStore(
    subscribeChatStore,
    getChatSnapshot,
    getServerChatSnapshot,
  );
  const active =
    conversations.find((item) => item.id === activeId) ?? conversations[0];
  const messages = active.messages;
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  /** Held so the stop button can abort the reply that is currently in flight. */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // A reply left in flight when the panel unmounts has nowhere to land.
    return () => abortRef.current?.abort();
  }, []);

  function stop() {
    abortRef.current?.abort();
  }

  useEffect(() => {
    // Keep the newest message in view as the conversation grows.
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, isSending]);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    // Captured, so a reply still lands in the conversation that asked for it
    // even if the user switches tabs while it is in flight.
    const conversationId = active.id;
    const question = createMessage("user", trimmed);
    const history = [...messages, question];
    writeMessages(conversationId, history);
    setDraft("");
    setIsSending(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await sendChatMessage({
        message: trimmed,
        history,
        context,
        signal: controller.signal,
      });
      writeMessages(conversationId, [
        ...history,
        createMessage("assistant", response.text),
      ]);
    } catch (reason: unknown) {
      setError(describeFailure(reason));
    } finally {
      // Only clear the controller this call owns: a newer request may already
      // have replaced it.
      if (abortRef.current === controller) abortRef.current = null;
      setIsSending(false);
    }
  }

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatTabs} role="tablist">
        {conversations.map((conversation) => {
          const isActive = conversation.id === active.id;
          return (
            <div
              className={isActive ? styles.chatTabActive : styles.chatTab}
              key={conversation.id}
            >
              <button
                aria-selected={isActive}
                className={styles.chatTabLabel}
                role="tab"
                title={conversation.title}
                type="button"
                onClick={() => setActiveConversation(conversation.id)}
              >
                {conversation.title}
              </button>
              <button
                aria-label={`ปิด ${conversation.title}`}
                className={styles.chatTabClose}
                title="ปิดบทสนทนา"
                type="button"
                onClick={() => deleteConversation(conversation.id)}
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          aria-label="เปิดบทสนทนาใหม่"
          className={styles.chatTabAdd}
          title="บทสนทนาใหม่"
          type="button"
          onClick={() => createConversation()}
        >
          +
        </button>
      </div>

      <div className={styles.chatContextBar}>
        <span>
          <strong>{context.className || "ยังไม่ได้เลือกอาชีพ"}</strong>
          {context.skillId ? ` · ${context.skillId}` : ""}
        </span>
        <span>
          {context.damage
            ? `ดาเมจ ${context.damage.min.toLocaleString()}–${context.damage.max.toLocaleString()}`
            : "ยังไม่มีผลคำนวณ"}
        </span>
      </div>

      {/* Hidden until there is something to show: an empty bordered box took
          up most of the panel and said nothing the placeholder below does not. */}
      {messages.length > 0 ? (
        <div
          aria-label="ประวัติการสนทนา"
          className={styles.chatLog}
          ref={logRef}
          role="log"
        >
          {messages.map((message) => (
            <article
              className={
                message.role === "user"
                  ? styles.chatMessageUser
                  : styles.chatMessageAssistant
              }
              key={message.id}
            >
              <span className={styles.chatRole}>
                {message.role === "user" ? "คุณ" : "ผู้ช่วย"}
              </span>
              <p>{message.text}</p>
            </article>
          ))}
          {isSending ? (
            <article className={styles.chatMessageAssistant}>
              <span className={styles.chatRole}>ผู้ช่วย</span>
              <p className={styles.chatPending}>กำลังคิด…</p>
            </article>
          ) : null}
        </div>
      ) : null}

      {error ? <p className={styles.chatError}>{error}</p> : null}

      {/* Sits with the input rather than in the empty log, so a starting point
          is still one click away once the conversation is under way. */}
      <div className={styles.chatSuggestions}>
        {SUGGESTIONS.map((suggestion) => (
          <button
            className={styles.chatSuggestion}
            disabled={isSending}
            key={suggestion}
            type="button"
            onClick={() => void submit(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form
        className={styles.chatForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(draft);
        }}
      >
        <textarea
          aria-label="พิมพ์ข้อความถึงผู้ช่วย"
          className={styles.chatInput}
          disabled={isSending}
          placeholder="พิมพ์คำถามเกี่ยวกับ build นี้…  (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit(draft);
            }
          }}
        />
        <div className={styles.chatActions}>
          <button
            className={styles.chatClear}
            disabled={messages.length === 0 || isSending}
            type="button"
            onClick={() => {
              writeMessages(active.id, []);
              setError(null);
            }}
          >
            ล้างบทสนทนา
          </button>
          {isSending ? (
            // Takes the send button's place while a reply is in flight, so the
            // control the user needs is always in the same spot.
            <button className={styles.chatStop} type="button" onClick={stop}>
              หยุด
            </button>
          ) : (
            <button
              className={styles.chatSend}
              disabled={!draft.trim()}
              type="submit"
            >
              ส่ง
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
