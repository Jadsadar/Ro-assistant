import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { MiniElement } from "./fixtures/mini-dom";

const SCRIPT = path.join(
  import.meta.dirname,
  "..",
  "scripts",
  "legacy-page",
  "ro-assistant-chat.js",
);
const ORDER_KEY = "ro-assistant:accordion-order:v1";

/**
 * "Item Descriptions" is present, so the injector also adds its own chat tab
 * directly after it. Every expectation below accounts for that.
 */
const LEGACY = ["Consumables", "Skills", "Battle Summary", "Item Descriptions"];
const WITH_CHAT = [...LEGACY, "Chat with AI"];

interface Page {
  order: () => string[];
  storedOrder: () => string[] | null;
}

function buildAccordion(headers: string[]): {
  body: MiniElement;
  accordion: MiniElement;
} {
  const body = new MiniElement("body");
  const host = new MiniElement("p-accordion");
  const accordion = new MiniElement("div", "p-accordion");
  host.appendChild(accordion);
  body.appendChild(host);

  for (const text of headers) {
    const tab = new MiniElement("div", "p-accordion-tab");
    const header = new MiniElement("div", "p-accordion-header");
    const link = new MiniElement("a", "p-accordion-header-link");
    link.textContent = text;
    header.appendChild(link);
    tab.appendChild(header);
    accordion.appendChild(tab);
  }

  return { body, accordion };
}

/** Runs the real injector against a page whose saved order is `stored`. */
function load(headers: string[], stored: string[] | string | null): Page {
  const { body, accordion } = buildAccordion(headers);
  const storage = new Map<string, string>();
  if (stored !== null) {
    storage.set(
      ORDER_KEY,
      typeof stored === "string" ? stored : JSON.stringify(stored),
    );
  }

  const document = {
    body,
    head: new MiniElement("head"),
    readyState: "complete",
    getElementById: () => null,
    createElement: (tagName: string) => new MiniElement(tagName),
    querySelector: (selector: string) =>
      selector.includes("p-accordion") ? accordion : null,
    addEventListener: () => {},
  };

  const sandbox: Record<string, unknown> = {
    document,
    window: {
      document,
      location: { origin: "http://localhost" },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
      },
      addEventListener: () => {},
      setTimeout: () => 0,
    },
    MutationObserver: class {
      observe() {}
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SCRIPT, "utf8"), sandbox);

  return {
    order: () =>
      accordion.children
        .filter((child) => child.classList.contains("p-accordion-tab"))
        .map(
          (tab) =>
            tab.querySelector(".p-accordion-header-link")?.textContent ?? "",
        ),
    storedOrder: () => {
      const raw = storage.get(ORDER_KEY);
      return raw ? (JSON.parse(raw) as string[]) : null;
    },
  };
}

test("the legacy tab order is untouched when nothing has been saved", () => {
  assert.deepEqual(load(LEGACY, null).order(), WITH_CHAT);
});

test("the chat tab is injected directly after Item Descriptions", () => {
  const order = load(LEGACY, null).order();
  assert.equal(
    order.indexOf("Chat with AI"),
    order.indexOf("Item Descriptions") + 1,
  );
});

test("a saved tab order is restored on load", () => {
  const saved = [
    "Battle Summary",
    "Chat with AI",
    "Consumables",
    "Item Descriptions",
    "Skills",
  ];

  assert.deepEqual(load(LEGACY, saved).order(), saved);
});

test("tabs the saved order never saw are kept, after the ones it knows", () => {
  // A legacy tab added upstream, or the chat tab before it is ever dragged.
  const page = load(LEGACY, ["Battle Summary", "Consumables"]);
  const order = page.order();

  assert.equal(order.length, WITH_CHAT.length);
  assert.deepEqual(order.slice(0, 2), ["Battle Summary", "Consumables"]);
  // The rest keep the order the legacy page rendered them in.
  assert.deepEqual(order.slice(2), [
    "Skills",
    "Item Descriptions",
    "Chat with AI",
  ]);
});

test("a saved tab that no longer exists is ignored", () => {
  const order = load(LEGACY, ["Removed Tab", "Skills", "Consumables"]).order();

  assert.deepEqual(order.slice(0, 2), ["Skills", "Consumables"]);
  assert.equal(order.length, WITH_CHAT.length);
});

test("a damaged saved order falls back to the legacy layout", () => {
  for (const payload of [
    "{ not json",
    '{"a":1}',
    "[]",
    '["Skills",null,7]',
    '"Skills"',
  ]) {
    const order = load(LEGACY, payload).order();
    assert.equal(order.length, WITH_CHAT.length, payload);
    assert.ok(order.includes("Chat with AI"), payload);
  }
});
