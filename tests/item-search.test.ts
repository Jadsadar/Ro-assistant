import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { filterItemsForSlot, searchItems } from "../src/lib/tools/item-search";
import { itemMatchesClass } from "../src/lib/equipment/class-compatibility";
import type { CatalogSearchItem } from "../src/lib/catalog/types";

const root = path.join(import.meta.dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/catalog-manifest.json"), "utf8"),
) as { search: { url: string } };
const items = JSON.parse(
  fs.readFileSync(path.join(root, "public", manifest.search.url), "utf8"),
) as CatalogSearchItem[];

const SHADOW_CROSS = 4254;

test("the catalog fixture is the one the app ships", () => {
  assert.ok(items.length > 6000, `expected the full catalog, got ${items.length}`);
});

test("a slot search returns only items that fill that slot", () => {
  const found = filterItemsForSlot(items, {
    slot: "armor",
    classId: SHADOW_CROSS,
  });

  assert.ok(found.length > 0);
  for (const item of found) assert.ok(item.equipSlots.includes("armor"));
});

test("the class rule matches the one the calculator's equipment panel uses", () => {
  // The panel filters with equipSlots + itemMatchesClass; a tool that offered
  // anything else would suggest gear the calculator refuses to equip.
  const expected = items.filter(
    (item) =>
      item.equipSlots.includes("weapon") && itemMatchesClass(item, SHADOW_CROSS),
  );
  const found = filterItemsForSlot(items, {
    slot: "weapon",
    classId: SHADOW_CROSS,
  });

  assert.deepEqual(
    found.map((item) => item.id),
    expected.map((item) => item.id),
  );
});

test("different classes get different weapons", () => {
  const shadowCross = filterItemsForSlot(items, {
    slot: "weapon",
    classId: SHADOW_CROSS,
  }).map((item) => item.id);
  const archMage = filterItemsForSlot(items, {
    slot: "weapon",
    classId: 4255,
  }).map((item) => item.id);

  assert.notDeepEqual(shadowCross, archMage);
});

test("a keyword requires every term, so more words narrow the result", () => {
  const broad = filterItemsForSlot(items, {
    slot: "weapon",
    classId: SHADOW_CROSS,
    keyword: "shadow",
  });
  const narrow = filterItemsForSlot(items, {
    slot: "weapon",
    classId: SHADOW_CROSS,
    keyword: "shadow katar",
  });

  assert.ok(narrow.length <= broad.length);
  for (const item of narrow) {
    const haystack = `${item.searchable} ${item.name}`.toLowerCase();
    assert.ok(haystack.includes("shadow") && haystack.includes("katar"));
  }
});

test("the level cap drops gear the character could not wear yet", () => {
  const found = filterItemsForSlot(items, {
    slot: "armor",
    classId: SHADOW_CROSS,
    maxRequiredLevel: 100,
  });

  assert.ok(found.length > 0);
  for (const item of found) {
    assert.ok((item.requiredLevel ?? 0) <= 100);
  }
});

test("a card-slot floor keeps only gear that can hold that many cards", () => {
  const found = filterItemsForSlot(items, {
    slot: "armor",
    classId: SHADOW_CROSS,
    minCardSlots: 1,
  });

  assert.ok(found.length > 0);
  for (const item of found) assert.ok(item.slots >= 1);
});

test("refinable-only keeps only refinable gear", () => {
  const found = filterItemsForSlot(items, {
    slot: "armor",
    classId: SHADOW_CROSS,
    refinableOnly: true,
  });

  assert.ok(found.length > 0);
  for (const item of found) assert.equal(item.isRefinable, true);
});

test("ammo is matched to the weapon's subtype rather than to the class", () => {
  const anyAmmo = filterItemsForSlot(items, { slot: "ammo", classId: SHADOW_CROSS });
  assert.ok(anyAmmo.length > 0);

  const subTypeId = anyAmmo[0].itemSubTypeId;
  const matched = filterItemsForSlot(items, {
    slot: "ammo",
    classId: SHADOW_CROSS,
    ammoSubTypeId: subTypeId,
  });

  assert.ok(matched.length > 0);
  assert.ok(matched.length <= anyAmmo.length);
  for (const item of matched) assert.equal(item.itemSubTypeId, subTypeId);
});

test("the limit caps the result but still reports the full match count", () => {
  const result = searchItems(items, {
    slot: "garment",
    classId: SHADOW_CROSS,
    limit: 5,
  });

  assert.equal(result.items.length, 5);
  assert.ok(result.matched > 5);
});

test("the result names the detail chunks a run would have to load", () => {
  const result = searchItems(items, { slot: "weapon", classId: SHADOW_CROSS });

  assert.ok(result.categories.length > 0);
  for (const category of result.categories) {
    assert.ok(result.items.some((item) => item.category === category));
  }
});

test("sorting by card slots puts the most sockets first", () => {
  const result = searchItems(items, {
    slot: "armor",
    classId: SHADOW_CROSS,
    sort: "cardSlots",
  });

  for (let index = 1; index < result.items.length; index += 1) {
    assert.ok(result.items[index - 1].slots >= result.items[index].slots);
  }
});

test("sorting by required level goes from lowest to highest", () => {
  const result = searchItems(items, {
    slot: "armor",
    classId: SHADOW_CROSS,
    sort: "requiredLevel",
  });

  for (let index = 1; index < result.items.length; index += 1) {
    assert.ok(
      (result.items[index - 1].requiredLevel ?? 0) <=
        (result.items[index].requiredLevel ?? 0),
    );
  }
});

test("every slot stays small enough to evaluate exactly", () => {
  // The evaluator runs the real engine once per candidate at roughly 3ms a
  // call, so this is the budget that keeps a run under a second in the browser.
  const slots = [
    "weapon", "armor", "garment", "boot", "shield", "headUpper",
    "headMiddle", "headLower", "accLeft", "accRight",
    "shadowWeapon", "shadowArmor", "shadowShield", "shadowBoot",
  ] as const;

  for (const classId of [4254, 4255, 1, 11]) {
    for (const slot of slots) {
      const count = filterItemsForSlot(items, { slot, classId }).length;
      assert.ok(
        count <= 400,
        `${slot} for class ${classId} has ${count} candidates, over the 400 budget`,
      );
    }
  }
});
