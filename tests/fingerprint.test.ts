import assert from "node:assert/strict";
import test from "node:test";
import { createVariantFingerprint } from "../src/lib/knowledge/fingerprint";

test("variant fingerprint is stable regardless of card and option order", () => {
  const first = createVariantFingerprint({
    itemId: 470001,
    refine: 11,
    grade: "A",
    cards: [
      { slot: 2, itemId: 4002 },
      { slot: 1, itemId: 4001 },
    ],
    enchants: [],
    randomOptions: [
      { key: "int", value: 5, unit: "flat", label: "INT +5" },
      { key: "matk", value: 3, unit: "percent", label: "MATK +3%" },
    ],
  });
  const second = createVariantFingerprint({
    itemId: 470001,
    refine: 11,
    grade: "A",
    cards: [
      { slot: 1, itemId: 4001 },
      { slot: 2, itemId: 4002 },
    ],
    enchants: [],
    randomOptions: [
      { key: "matk", value: 3, unit: "percent", label: "MATK +3%" },
      { key: "int", value: 5, unit: "flat", label: "INT +5" },
    ],
  });

  assert.equal(first, second);
});

test("variant fingerprint changes for price-relevant equipment properties", () => {
  const base = {
    itemId: 470001,
    refine: 11,
    cards: [],
    enchants: [],
    randomOptions: [],
  };

  assert.notEqual(
    createVariantFingerprint(base),
    createVariantFingerprint({ ...base, refine: 12 }),
  );
  assert.notEqual(
    createVariantFingerprint(base),
    createVariantFingerprint({
      ...base,
      randomOptions: [
        { key: "int", value: 5, unit: "flat", label: "INT +5" },
      ],
    }),
  );
  assert.notEqual(
    createVariantFingerprint({
      ...base,
      enchants: [
        { key: "special", itemId: 4872, unit: "text", label: "Hawkeye" },
      ],
    }),
    createVariantFingerprint({
      ...base,
      enchants: [
        { key: "special", itemId: 4873, unit: "text", label: "Hawkeye" },
      ],
    }),
  );
});
