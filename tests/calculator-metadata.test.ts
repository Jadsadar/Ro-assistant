import assert from "node:assert/strict";
import test from "node:test";
import {
  CALCULATOR_CLASSES,
  DEFAULT_CHARACTER_STATS,
} from "../src/lib/calculator/metadata";

test("calculator class metadata retains legacy class IDs", () => {
  assert.equal(
    CALCULATOR_CLASSES.find((entry) => entry.name === "Rune Knight")?.id,
    12,
  );
  assert.equal(
    CALCULATOR_CLASSES.find((entry) => entry.name === "Shadow Cross")?.id,
    4254,
  );
  assert.equal(new Set(CALCULATOR_CLASSES.map((entry) => entry.id)).size, 40);
});

test("new character stats match legacy defaults", () => {
  assert.deepEqual(DEFAULT_CHARACTER_STATS, {
    str: 1,
    agi: 1,
    vit: 1,
    int: 1,
    dex: 1,
    luk: 1,
    pow: 0,
    sta: 0,
    wis: 0,
    spl: 0,
    con: 0,
    crt: 0,
  });
});
