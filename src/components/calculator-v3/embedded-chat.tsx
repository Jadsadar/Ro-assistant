"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "./chat-panel";
import type { ChatBuildContext } from "./chat-client";
import styles from "./calculator-v3.module.css";

const EMPTY_CONTEXT: ChatBuildContext = {
  className: "",
  skillId: "",
  monsterName: "",
  equippedCount: 0,
};

/**
 * Chat rendered for embedding. The host page (the legacy calculator) posts the
 * current build over `postMessage`, so the chat always describes what the user
 * is actually looking at without the two apps sharing state directly.
 */
export function EmbeddedChat() {
  const [context, setContext] = useState<ChatBuildContext>(EMPTY_CONTEXT);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Same-origin only: the host is served from this app's own public folder.
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; context?: ChatBuildContext };
      if (data?.type === "ro-assistant:build-context" && data.context) {
        setContext({ ...EMPTY_CONTEXT, ...data.context });
      }
    }

    window.addEventListener("message", onMessage);
    window.parent?.postMessage(
      { type: "ro-assistant:chat-ready" },
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className={styles.embeddedChat}>
      <ChatPanel context={context} />
    </div>
  );
}
