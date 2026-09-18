import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessage } from "../src/components/calculator-v3/chat-client";

const STORAGE_KEY = "ro-assistant:calculator-v3-chat:v2";
const LEGACY_STORAGE_KEY = "ro-assistant:calculator-v3-chat:v1";

type ChatStorage = typeof import("../src/components/calculator-v3/chat-storage");

/**
 * The store reads `window.localStorage` and caches the parsed result at module
 * scope, so each test needs both a fresh backing map and a fresh module
 * instance. Importing with a unique query string defeats the module cache.
 */
async function loadStore(
  seed: Record<string, string> = {},
): Promise<{ store: ChatStorage; backing: Map<string, string> }> {
  const backing = new Map(Object.entries(seed));

  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
      removeItem: (key: string) => void backing.delete(key),
    },
    addEventListener() {},
    removeEventListener() {},
  };

  const store = (await import(
    `../src/components/calculator-v3/chat-storage.ts?case=${Math.random()}`
  )) as ChatStorage;

  return { store, backing };
}

function message(index: number, text = `ถาม${index}`): ChatMessage {
  return { id: `m${index}`, role: "user", text, createdAt: index };
}

test("a fresh panel starts with exactly one empty conversation", async () => {
  const { store } = await loadStore();
  const state = store.getChatSnapshot();

  assert.equal(state.conversations.length, 1);
  assert.equal(state.conversations[0].messages.length, 0);
  assert.equal(state.activeId, state.conversations[0].id);
});

test("each new conversation is added, never folded into an existing empty one", async () => {
  // Regression: an earlier version reused any empty conversation, so pressing
  // the button on a fresh panel only re-selected the tab already open and
  // looked like nothing happened.
  const { store } = await loadStore();
  const firstId = store.getChatSnapshot().activeId;

  store.createConversation();
  const afterFirst = store.getChatSnapshot();
  assert.equal(afterFirst.conversations.length, 2);
  assert.notEqual(afterFirst.activeId, firstId);

  store.createConversation();
  const afterSecond = store.getChatSnapshot();
  assert.equal(afterSecond.conversations.length, 3);
  assert.notEqual(afterSecond.activeId, afterFirst.activeId);

  // Every tab is distinct even though none of them has been used yet.
  const ids = new Set(afterSecond.conversations.map((item) => item.id));
  assert.equal(ids.size, 3);
});

test("a new conversation becomes active and starts empty", async () => {
  const { store } = await loadStore();
  store.writeMessages(store.getChatSnapshot().activeId, [message(1)]);

  store.createConversation();
  const state = store.getChatSnapshot();
  const active = state.conversations.find((item) => item.id === state.activeId);

  assert.ok(active);
  assert.equal(active.messages.length, 0);
  assert.equal(state.conversations[0].messages.length, 1);
});

test("creating a conversation persists it for the next load", async () => {
  const { store, backing } = await loadStore();
  store.createConversation();

  const { store: reloaded } = await loadStore({
    [STORAGE_KEY]: backing.get(STORAGE_KEY) ?? "",
  });

  assert.equal(reloaded.getChatSnapshot().conversations.length, 2);
});

test("conversations keep their own transcripts when switching between them", async () => {
  const { store } = await loadStore();
  const firstId = store.getChatSnapshot().activeId;
  store.writeMessages(firstId, [message(1)]);

  store.createConversation();
  const secondId = store.getChatSnapshot().activeId;
  store.writeMessages(secondId, [message(2), message(3)]);

  store.setActiveConversation(firstId);
  const state = store.getChatSnapshot();

  assert.equal(state.activeId, firstId);
  assert.equal(
    state.conversations.find((item) => item.id === firstId)?.messages.length,
    1,
  );
  assert.equal(
    state.conversations.find((item) => item.id === secondId)?.messages.length,
    2,
  );
});

test("a conversation is named after its first question", async () => {
  const { store } = await loadStore();
  const id = store.getChatSnapshot().activeId;

  assert.equal(store.getChatSnapshot().conversations[0].title, "บทสนทนาใหม่");

  store.writeMessages(id, [message(1, "Shadow Cross ควรใส่อาวุธอะไร")]);
  assert.equal(
    store.getChatSnapshot().conversations[0].title,
    "Shadow Cross ควรใส่อาวุธอะไร",
  );
});

test("deleting a conversation removes only that one", async () => {
  const { store } = await loadStore();
  const firstId = store.getChatSnapshot().activeId;
  store.writeMessages(firstId, [message(1)]);

  store.createConversation();
  const secondId = store.getChatSnapshot().activeId;

  store.deleteConversation(secondId);
  const state = store.getChatSnapshot();

  assert.equal(state.conversations.length, 1);
  assert.equal(state.conversations[0].id, firstId);
  assert.equal(state.conversations[0].messages.length, 1);
});

test("deleting an inactive conversation leaves the active one selected", async () => {
  const { store } = await loadStore();
  const firstId = store.getChatSnapshot().activeId;
  store.createConversation();
  const secondId = store.getChatSnapshot().activeId;

  store.deleteConversation(firstId);

  assert.equal(store.getChatSnapshot().activeId, secondId);
});

test("deleting the active conversation selects a neighbour", async () => {
  const { store } = await loadStore();
  store.createConversation();
  store.createConversation();
  const [first, second, third] = store.getChatSnapshot().conversations;

  store.setActiveConversation(second.id);
  store.deleteConversation(second.id);

  const state = store.getChatSnapshot();
  assert.equal(state.conversations.length, 2);
  assert.equal(state.activeId, third.id);
  assert.ok(state.conversations.some((item) => item.id === first.id));
});

test("deleting the last conversation leaves one empty conversation", async () => {
  const { store } = await loadStore();
  const id = store.getChatSnapshot().activeId;
  store.writeMessages(id, [message(1)]);

  store.deleteConversation(id);
  const state = store.getChatSnapshot();

  assert.equal(state.conversations.length, 1);
  assert.equal(state.conversations[0].messages.length, 0);
  assert.equal(state.activeId, state.conversations[0].id);
});

test("deleting a conversation persists for the next load", async () => {
  const { store, backing } = await loadStore();
  store.createConversation();
  const removed = store.getChatSnapshot().activeId;
  store.deleteConversation(removed);

  const { store: reloaded } = await loadStore({
    [STORAGE_KEY]: backing.get(STORAGE_KEY) ?? "",
  });
  const state = reloaded.getChatSnapshot();

  assert.equal(state.conversations.length, 1);
  assert.ok(!state.conversations.some((item) => item.id === removed));
});

test("deleting an unknown id changes nothing", async () => {
  const { store } = await loadStore();
  const before = store.getChatSnapshot();

  store.deleteConversation("does-not-exist");
  const after = store.getChatSnapshot();

  assert.equal(after.conversations.length, before.conversations.length);
  assert.equal(after.activeId, before.activeId);
});

test("the conversation count is capped, dropping the least recently used", async () => {
  const { store } = await loadStore();
  store.writeMessages(store.getChatSnapshot().activeId, [message(0)]);
  const oldestId = store.getChatSnapshot().activeId;

  for (let index = 1; index <= 25; index += 1) {
    store.createConversation();
    store.writeMessages(store.getChatSnapshot().activeId, [message(index)]);
  }

  const state = store.getChatSnapshot();
  assert.equal(state.conversations.length, 20);
  assert.ok(!state.conversations.some((item) => item.id === oldestId));
  assert.ok(state.conversations.some((item) => item.id === state.activeId));
});

test("a transcript from the single-conversation version is migrated once", async () => {
  const { store, backing } = await loadStore({
    [LEGACY_STORAGE_KEY]: JSON.stringify([
      { id: "a", role: "user", text: "คำถามเดิม", createdAt: 1 },
    ]),
  });

  const state = store.getChatSnapshot();
  assert.equal(state.conversations.length, 1);
  assert.equal(state.conversations[0].messages.length, 1);
  assert.equal(state.conversations[0].title, "คำถามเดิม");

  // The first write moves it to the current key and drops the old one.
  store.createConversation();
  assert.ok(!backing.has(LEGACY_STORAGE_KEY));
  assert.ok(backing.has(STORAGE_KEY));
});

test("a damaged payload recovers to one empty conversation", async () => {
  for (const payload of [
    "{ not json",
    "[]",
    '{"version":2,"conversations":[],"activeId":"x"}',
    '{"version":2,"conversations":[{"id":"a","messages":"nope"}],"activeId":"gone"}',
  ]) {
    const { store } = await loadStore({ [STORAGE_KEY]: payload });
    const state = store.getChatSnapshot();

    assert.equal(state.conversations.length, 1, payload);
    assert.ok(
      state.conversations.some((item) => item.id === state.activeId),
      payload,
    );
  }
});

test("each conversation keeps only its most recent messages", async () => {
  const { store } = await loadStore();
  const id = store.getChatSnapshot().activeId;

  store.writeMessages(
    id,
    Array.from({ length: 250 }, (_, index) => message(index)),
  );
  const kept = store.getChatSnapshot().conversations[0].messages;

  assert.equal(kept.length, 200);
  assert.equal(kept[0].text, "ถาม50");
  assert.equal(kept[199].text, "ถาม249");
});
