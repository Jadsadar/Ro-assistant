import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSlotCandidates } from "../src/lib/tools/slot-evaluator";
import type { CatalogSearchItem } from "../src/lib/catalog/types";
import type {
  DamageCalculationInput,
  DamageCalculationResult,
} from "../src/lib/calculator/damage-engine";

/**
 * The ranking, the deltas and the failure handling are what is under test here.
 * The damage formula itself is covered by the parity fixtures, so this runs
 * against a stub engine whose numbers are chosen to make an ordering obvious.
 */
const SKILL_MAX_BY_ITEM = new Map<number, number>([
  [0, 1000], // the empty-slot baseline
  [1, 5000],
  [2, 9000],
  [3, 3000],
]);

const FAILING_ITEM_ID = 99;

function item(id: number, overrides: Partial<CatalogSearchItem> = {}) {
  return {
    id,
    name: `Item ${id}`,
    aegisName: `ITEM_${id}`,
    itemTypeId: 1,
    itemSubTypeId: 257,
    itemType: "Weapon",
    slot: "Weapon",
    equipSlots: ["weapon"],
    category: "equipment-weapon",
    slots: 0,
    compositionPos: null,
    canGrade: false,
    isRefinable: true,
    requiredLevel: 1,
    searchable: `${id} item`,
    ...overrides,
  } as CatalogSearchItem;
}

/** Carries the candidate's id through to the stub engine. */
function buildInput(
  selected: CatalogSearchItem | null,
  refine: number,
): Promise<DamageCalculationInput> {
  return Promise.resolve({
    classId: 4254,
    baseLevel: 250,
    jobLevel: 50,
    skillValue: "test",
    attackElement: "Neutral",
    stats: {} as DamageCalculationInput["stats"],
    monster: {} as DamageCalculationInput["monster"],
    items: [],
    equipment: selected
      ? { weapon: { itemId: selected.id, refine, cardIds: [], enchantIds: [] } }
      : {},
    hpSpTable: [],
  } as unknown as DamageCalculationInput);
}

const refinesSeen: number[] = [];

function stubEngine(
  input: DamageCalculationInput,
): Promise<DamageCalculationResult> {
  const selection = input.equipment.weapon;
  const itemId = selection?.itemId ?? 0;
  if (selection) refinesSeen.push(selection.refine);
  if (itemId === FAILING_ITEM_ID) {
    return Promise.reject(new Error("ไอเทมนี้คำนวณไม่ได้"));
  }

  const max = SKILL_MAX_BY_ITEM.get(itemId) ?? 0;
  return Promise.resolve({
    skill: { min: max / 2, max, dps: max * 2 },
    basic: { dps: max / 4 },
  } as unknown as DamageCalculationResult);
}

function run(
  candidates: CatalogSearchItem[],
  overrides: Partial<Parameters<typeof evaluateSlotCandidates>[0]> = {},
) {
  return evaluateSlotCandidates({
    candidates,
    slot: "weapon",
    buildInput,
    calculate: stubEngine,
    ...overrides,
  });
}

test("candidates are ranked by skill damage, highest first", async () => {
  const result = await run([item(1), item(2), item(3)]);

  assert.deepEqual(
    result.scores.map((score) => score.item.id),
    [2, 1, 3],
  );
});

test("the delta is measured against the build with the slot left empty", async () => {
  const result = await run([item(1), item(2)]);

  assert.equal(result.baseline?.skill.max, 1000);
  assert.equal(result.scores[0].deltaSkillMax, 9000 - 1000);
  assert.equal(result.scores[1].deltaSkillMax, 5000 - 1000);
});

test("a candidate worse than an empty slot reports a negative delta", async () => {
  SKILL_MAX_BY_ITEM.set(4, 400);
  const result = await run([item(4)]);

  assert.equal(result.scores[0].deltaSkillMax, 400 - 1000);
  SKILL_MAX_BY_ITEM.delete(4);
});

test("each sort orders by its own metric", async () => {
  const byDps = await run([item(1), item(2), item(3)], { sort: "skillDps" });
  assert.deepEqual(byDps.scores.map((s) => s.item.id), [2, 1, 3]);

  const byBasic = await run([item(1), item(2), item(3)], { sort: "basicDps" });
  assert.deepEqual(byBasic.scores.map((s) => s.item.id), [2, 1, 3]);

  const byDelta = await run([item(1), item(2), item(3)], { sort: "delta" });
  assert.deepEqual(byDelta.scores.map((s) => s.item.id), [2, 1, 3]);
});

test("one unusable item does not end the run", async () => {
  const result = await run([item(1), item(FAILING_ITEM_ID), item(2)]);

  assert.equal(result.scores.length, 2);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].item.id, FAILING_ITEM_ID);
  assert.match(result.failures[0].message, /คำนวณไม่ได้/);
});

test("the stats separate what was tried from what succeeded", async () => {
  const result = await run([item(1), item(FAILING_ITEM_ID), item(2)]);

  assert.equal(result.stats.candidates, 3);
  assert.equal(result.stats.evaluated, 2);
  assert.ok(result.stats.elapsedMs >= 0);
  assert.ok(result.stats.msPerCandidate >= 0);
});

test("the limit trims the ranking, not the work that was measured", async () => {
  const result = await run([item(1), item(2), item(3)], { limit: 1 });

  assert.equal(result.scores.length, 1);
  assert.equal(result.scores[0].item.id, 2);
  assert.equal(result.stats.candidates, 3);
  assert.equal(result.stats.evaluated, 3);
});

test("refine is applied to refinable items and skipped for the rest", async () => {
  refinesSeen.length = 0;
  await run([item(1), item(2, { isRefinable: false })], { refine: 12 });

  assert.deepEqual(refinesSeen, [12, 0]);
});

test("progress is reported and ends at the candidate count", async () => {
  const seen: Array<[number, number]> = [];
  const candidates = Array.from({ length: 20 }, (_, index) => item(index + 1));

  await run(candidates, { onProgress: (done, total) => seen.push([done, total]) });

  assert.ok(seen.length > 0);
  assert.deepEqual(seen.at(-1), [20, 20]);
  for (const [done, total] of seen) {
    assert.equal(total, 20);
    assert.ok(done > 0 && done <= 20);
  }
});

test("an aborted run rejects instead of returning a partial ranking", async () => {
  const controller = new AbortController();
  const candidates = Array.from({ length: 64 }, (_, index) => item(index + 1));

  const pending = run(candidates, { signal: controller.signal });
  controller.abort();

  await assert.rejects(pending, (reason: unknown) => {
    assert.ok(reason instanceof DOMException);
    assert.equal(reason.name, "AbortError");
    return true;
  });
});

test("an empty candidate list is not an error", async () => {
  const result = await run([]);

  assert.deepEqual(result.scores, []);
  assert.equal(result.stats.candidates, 0);
  assert.equal(result.stats.msPerCandidate, 0);
});

test("a baseline that cannot be calculated leaves the ranking intact", async () => {
  const result = await evaluateSlotCandidates({
    candidates: [item(1), item(2)],
    slot: "weapon",
    buildInput,
    calculate: (input) =>
      input.equipment.weapon ? stubEngine(input) : Promise.reject(new Error("no baseline")),
  });

  assert.equal(result.baseline, null);
  assert.deepEqual(result.scores.map((s) => s.item.id), [2, 1]);
  // Without a baseline the delta is the raw number rather than a wrong gain.
  assert.equal(result.scores[0].deltaSkillMax, 9000);
});
