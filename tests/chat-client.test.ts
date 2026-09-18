import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessage } from "../src/components/calculator-v3/chat-client";

type ChatClient = typeof import("../src/components/calculator-v3/chat-client");

const CONTEXT = {
  className: "Shadow Cross",
  skillId: "cross-impact",
  monsterName: "",
  equippedCount: 0,
};

function question(text: string): ChatMessage {
  return { id: "m1", role: "user", text, createdAt: 1 };
}

/**
 * The module reads its configuration once at import time, so each test sets the
 * environment and then imports a fresh instance. A unique query string defeats
 * the module cache.
 */
async function loadClient(): Promise<ChatClient> {
  process.env.NEXT_PUBLIC_PSU_API_KEY = "test-key";
  process.env.NEXT_PUBLIC_PSU_BASE_URL = "https://gateway.test/v1";
  process.env.NEXT_PUBLIC_PSU_MODEL = "test/model";

  return (await import(
    `../src/components/calculator-v3/chat-client.ts?case=${Math.random()}`
  )) as ChatClient;
}

/** Stands in for a gateway that never answers, so only the signal ends it. */
function stubHangingFetch(): { calls: RequestInit[] } {
  const calls: RequestInit[] = [];

  globalThis.fetch = ((_url: string, init: RequestInit) => {
    calls.push(init);
    return new Promise((_resolve, reject) => {
      const signal = init.signal;
      if (!signal) return;
      signal.addEventListener("abort", () => reject(signal.reason));
    });
  }) as typeof fetch;

  return { calls };
}

test("the caller's signal is passed through to the request", async () => {
  const client = await loadClient();
  const { calls } = stubHangingFetch();
  const controller = new AbortController();

  const pending = client.sendChatMessage({
    message: "สวัสดี",
    history: [question("สวัสดี")],
    context: CONTEXT,
    signal: controller.signal,
  });

  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].signal instanceof AbortSignal);

  controller.abort();
  await assert.rejects(pending);
});

test("stopping a reply rejects with AbortError, not a timeout", async () => {
  const client = await loadClient();
  stubHangingFetch();
  const controller = new AbortController();

  const pending = client.sendChatMessage({
    message: "สวัสดี",
    history: [question("สวัสดี")],
    context: CONTEXT,
    signal: controller.signal,
  });

  controller.abort();

  // The panel tells a deliberate stop from a timeout by this name, and shows an
  // error only for the timeout.
  await assert.rejects(pending, (reason: unknown) => {
    assert.ok(reason instanceof DOMException);
    assert.equal(reason.name, "AbortError");
    return true;
  });
});

test("a request still carries a timeout when the caller passes no signal", async () => {
  const client = await loadClient();
  const { calls } = stubHangingFetch();

  void client
    .sendChatMessage({
      message: "สวัสดี",
      history: [question("สวัสดี")],
      context: CONTEXT,
    })
    .catch(() => {});

  await Promise.resolve();
  assert.ok(calls[0].signal instanceof AbortSignal);
  assert.equal(calls[0].signal.aborted, false);
});

test("a reply is returned when the gateway answers", async () => {
  const client = await loadClient();
  globalThis.fetch = (() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ finish_reason: "stop", message: { content: " ตอบแล้ว " } }],
        }),
    })) as unknown as typeof fetch;

  const response = await client.sendChatMessage({
    message: "สวัสดี",
    history: [question("สวัสดี")],
    context: CONTEXT,
  });

  assert.equal(response.answered, true);
  assert.equal(response.text, "ตอบแล้ว");
});

test("a reasoning model that runs out of budget reports why", async () => {
  const client = await loadClient();
  globalThis.fetch = (() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ finish_reason: "length", message: { content: null } }],
        }),
    })) as unknown as typeof fetch;

  await assert.rejects(
    client.sendChatMessage({
      message: "สวัสดี",
      history: [question("สวัสดี")],
      context: CONTEXT,
    }),
    /token หมดก่อนตอบ/,
  );
});

test("a gateway error surfaces its message", async () => {
  const client = await loadClient();
  globalThis.fetch = (() =>
    Promise.resolve({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () =>
        Promise.resolve({ error: { message: "invalid api key" } }),
    })) as unknown as typeof fetch;

  await assert.rejects(
    client.sendChatMessage({
      message: "สวัสดี",
      history: [question("สวัสดี")],
      context: CONTEXT,
    }),
    /401.*invalid api key/,
  );
});

test("a missing key is reported without calling the gateway", async () => {
  process.env.NEXT_PUBLIC_PSU_API_KEY = "";
  const client = (await import(
    `../src/components/calculator-v3/chat-client.ts?case=${Math.random()}`
  )) as ChatClient;

  const { calls } = stubHangingFetch();
  const response = await client.sendChatMessage({
    message: "สวัสดี",
    history: [question("สวัสดี")],
    context: CONTEXT,
  });

  assert.equal(response.answered, false);
  assert.match(response.text, /ยังไม่ได้ตั้งค่า API key/);
  assert.equal(calls.length, 0);
});
