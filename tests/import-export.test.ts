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

const buildSnapshot: KnowledgeSnapshot = {
  ...emptySnapshot,
  savedBuilds: [
    {
      id: "build-1",
      name: "Cross Impact",
      classId: 4254,
      className: "Shadow Cross",
      baseLevel: 250,
      jobLevel: 50,
      skillId: "Cross Impact==5",
      skillLevel: 5,
      propertyAtk: "Neutral",
      monsterId: 1278,
      server: "chaos",
      equipment: { weapon: "variant-1" },
      stats: {
        str: 130,
        agi: 1,
        vit: 1,
        int: 1,
        dex: 130,
        luk: 1,
        pow: 100,
        sta: 0,
        wis: 0,
        spl: 0,
        con: 0,
        crt: 0,
      },
      skillLevels: { "Cross Impact==5": 5 },
      buffLevels: {},
      consumableIds: [],
      targetDamage: 1_000_000,
      budgetZeny: 1_000_000_000,
      createdAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z",
    },
  ],
};

test("knowledge export round-trips through JSON", () => {
  const exported = createKnowledgeExport(emptySnapshot, "catalog-test");
  const parsed = parseKnowledgeExport(JSON.stringify(exported));

  assert.equal(parsed.format, "ro-assistant-kb");
  assert.equal(parsed.schemaVersion, 3);
  assert.equal(parsed.catalogVersion, "catalog-test");
  assert.deepEqual(parsed.data, emptySnapshot);
});

test("knowledge export accepts calculator-ready saved builds", () => {
  const exported = createKnowledgeExport(buildSnapshot, "catalog-test");
  assert.deepEqual(
    parseKnowledgeExport(JSON.stringify(exported)).data.savedBuilds,
    buildSnapshot.savedBuilds,
  );
});

test("knowledge import rejects malformed and unsupported payloads", () => {
  assert.throws(() => parseKnowledgeExport("{"), /JSON/);
  assert.throws(
    () =>
      parseKnowledgeExport(
        JSON.stringify({
          format: "unknown",
          schemaVersion: 3,
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
          schemaVersion: 4,
          data: emptySnapshot,
        }),
      ),
    /schema version/,
  );
  assert.throws(
    () =>
      parseKnowledgeExport(
        `{"format":"ro-assistant-kb","schemaVersion":3,"data":{"itemVariants":[],"priceQuotes":[],"tags":[],"variantTags":[],"ownedItems":[],"savedBuilds":[],"__proto__":{}}}`,
      ),
    /ไม่อนุญาต/,
  );
});

test("knowledge import rejects calculator references outside schema", () => {
  assert.throws(
    () =>
      parseKnowledgeExport(
        JSON.stringify({
          ...createKnowledgeExport(emptySnapshot, "catalog-test"),
          data: {
            ...emptySnapshot,
            priceQuotes: [{ server: "freya" }],
          },
        }),
      ),
    /thor.*chaos/,
  );
});
