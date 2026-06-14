import assert from "node:assert/strict";
import test from "node:test";
import {
  createKnowledgeExport,
  parseKnowledgeExport,
} from "../src/lib/knowledge/import-export";
import type { KnowledgeSnapshot } from "../src/lib/knowledge/types";

const emptySnapshot: KnowledgeSnapshot = {
  itemVariants: [],
  priceQuotes: [],
  tags: [],
  variantTags: [],
  ownedItems: [],
  savedBuilds: [],
};

test("knowledge export round-trips through JSON", () => {
  const exported = createKnowledgeExport(emptySnapshot, "catalog-test");
  const parsed = parseKnowledgeExport(JSON.stringify(exported));

  assert.equal(parsed.format, "ro-assistant-kb");
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.catalogVersion, "catalog-test");
  assert.deepEqual(parsed.data, emptySnapshot);
});

test("knowledge import rejects malformed and unsupported payloads", () => {
  assert.throws(() => parseKnowledgeExport("{"), /JSON/);
  assert.throws(
    () =>
      parseKnowledgeExport(
        JSON.stringify({
          format: "unknown",
          schemaVersion: 1,
          data: emptySnapshot,
        }),
      ),
    /format/,
  );
  assert.throws(
    () =>
      parseKnowledgeExport(
        JSON.stringify({
          format: "ro-assistant-kb",
          schemaVersion: 2,
          data: emptySnapshot,
        }),
      ),
    /schema version/,
  );
  assert.throws(
    () =>
      parseKnowledgeExport(
        `{"format":"ro-assistant-kb","schemaVersion":1,"data":{"itemVariants":[],"priceQuotes":[],"tags":[],"variantTags":[],"ownedItems":[],"savedBuilds":[],"__proto__":{}}}`,
      ),
    /ไม่อนุญาต/,
  );
});
