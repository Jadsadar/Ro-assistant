import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { filterItemsForSlot } from "../src/lib/tools/item-search";
import { evaluateSlotCandidates } from "../src/lib/tools/slot-evaluator";
import type {
  CatalogItemDetail,
  CatalogSearchItem,
} from "../src/lib/catalog/types";
import type {
  DamageCalculationInput,
  DamageCalculationResult,
} from "../src/lib/calculator/damage-engine";

/**
 * Runs the tool against the real catalog and the real damage engine, which is
 * what makes this worth having: the unit tests prove the ranking, this proves
 * the two halves actually fit together and that a slot is cheap enough to
 * evaluate exactly.
 */
const root = path.join(import.meta.dirname, "..");
const readJson = (relative: string) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));

const manifest = readJson("public/data/catalog-manifest.json") as {
  search: { url: string };
  monsters: { url: string };
  hpSpTable: { url: string };
  chunks: Array<{ id: string; url: string }>;
};

const items = readJson("public" + manifest.search.url) as CatalogSearchItem[];
const monsters = Object.values(
  readJson("public" + manifest.monsters.url) as Record<string, unknown>,
) as DamageCalculationInput["monster"][];
const hpSpTable = readJson(
  "public" + manifest.hpSpTable.url,
) as DamageCalculationInput["hpSpTable"];
const weaponChunk = readJson(
  "public" + manifest.chunks.find((chunk) => chunk.id === "equipment-weapon")!.url,
) as CatalogItemDetail[];
const detailById = new Map(weaponChunk.map((detail) => [detail.id, detail]));

type LegacyEngine = {
  calculateLegacyDamage: (
    input: DamageCalculationInput,
  ) => DamageCalculationResult;
};

// Loaded lazily: this file is transpiled to CommonJS, which has no top-level
// await, and the engine is an ES module.
let enginePromise: Promise<LegacyEngine> | null = null;
function loadEngine(): Promise<LegacyEngine> {
  enginePromise ??= import(
    pathToFileURL(path.join(root, "src/generated/legacy-engine.mjs")).href
  ) as Promise<LegacyEngine>;
  return enginePromise;
}

const SHADOW_CROSS = 4254;
const monster = monsters.find((entry) => entry.name === "Stalactic Golem") ?? monsters[0];

function buildInput(
  item: CatalogSearchItem | null,
  refine: number,
): Promise<DamageCalculationInput> {
  const detail = item ? detailById.get(item.id) : null;
  return Promise.resolve({
    classId: SHADOW_CROSS,
    baseLevel: 250,
    jobLevel: 50,
    skillValue: "Meteor Assault==10",
    attackElement: "Neutral",
    stats: {
      str: 120, agi: 120, vit: 90, int: 40, dex: 100, luk: 50,
      pow: 50, sta: 20, wis: 10, spl: 10, con: 40, crt: 30,
    },
    monster,
    items: detail ? [detail] : [],
    equipment: item
      ? { weapon: { itemId: item.id, refine, cardIds: [], enchantIds: [] } }
      : {},
    hpSpTable,
  });
}

const calculate = async (input: DamageCalculationInput) =>
  (await loadEngine()).calculateLegacyDamage(input);

test("a whole weapon slot is searched and ranked by real damage", async () => {
  const candidates = filterItemsForSlot(items, {
    slot: "weapon",
    classId: SHADOW_CROSS,
  });
  assert.ok(candidates.length > 0, "the class should have weapons to choose from");

  const result = await evaluateSlotCandidates({
    candidates,
    slot: "weapon",
    buildInput,
    calculate,
    refine: 10,
  });

  assert.equal(result.stats.candidates, candidates.length);
  assert.ok(result.scores.length > 0, "at least one weapon should evaluate");

  // Ranked, and the numbers are real rather than placeholders.
  for (let index = 1; index < result.scores.length; index += 1) {
    assert.ok(result.scores[index - 1].skillMax >= result.scores[index].skillMax);
  }
  assert.ok(result.scores[0].skillMax > 0);
  assert.ok(result.scores[0].skillMin <= result.scores[0].skillMax);
});

test("equipping a weapon beats leaving the slot empty", async () => {
  const candidates = filterItemsForSlot(items, {
    slot: "weapon",
    classId: SHADOW_CROSS,
  });

  const result = await evaluateSlotCandidates({
    candidates,
    slot: "weapon",
    buildInput,
    calculate,
  });

  assert.ok(result.baseline, "the empty build should still calculate");
  assert.ok(
    result.scores[0].deltaSkillMax > 0,
    "the best weapon should beat an empty hand",
  );
});

test("a higher refine does not lower the best weapon's damage", async () => {
  const candidates = filterItemsForSlot(items, {
    slot: "weapon",
    classId: SHADOW_CROSS,
  }).slice(0, 12);

  const low = await evaluateSlotCandidates({
    candidates, slot: "weapon", buildInput, calculate, refine: 0,
  });
  const high = await evaluateSlotCandidates({
    candidates, slot: "weapon", buildInput, calculate, refine: 10,
  });

  assert.ok(high.scores[0].skillMax >= low.scores[0].skillMax);
});

test("evaluating a slot stays inside the interactive time budget", async () => {
  const candidates = filterItemsForSlot(items, {
    slot: "weapon",
    classId: SHADOW_CROSS,
  });

  const result = await evaluateSlotCandidates({
    candidates, slot: "weapon", buildInput, calculate,
  });

  // Node is faster than a browser, so this is a loose ceiling that still fails
  // if a change makes an evaluation an order of magnitude more expensive.
  assert.ok(
    result.stats.msPerCandidate < 50,
    `${result.stats.msPerCandidate.toFixed(1)}ms per candidate is too slow to stay interactive`,
  );
});
