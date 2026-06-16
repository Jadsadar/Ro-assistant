import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogSearchItem } from "../src/lib/catalog/types";
import type { ItemVariant } from "../src/lib/knowledge/types";
import { isVariantCompatibleWithSlot } from "../src/lib/equipment/compatibility";

const accessory: CatalogSearchItem = {
  id: 1,
  name: "Accessory",
  aegisName: "Accessory",
  itemTypeId: 2,
  itemSubTypeId: 517,
  itemType: "Accessory",
  slot: "Accessory",
  equipSlots: ["accLeft", "accRight"],
  category: "equipment-accessory",
  slots: 1,
  compositionPos: null,
  canGrade: false,
  isRefinable: false,
  requiredLevel: null,
  searchable: "accessory",
};

const leftCard: CatalogSearchItem = {
  ...accessory,
  id: 2,
  name: "Left Card",
  itemTypeId: 6,
  itemSubTypeId: 0,
  itemType: "Card",
  slot: null,
  equipSlots: [],
  category: "cards",
  compositionPos: 128,
  searchable: "left card",
};

const variant: ItemVariant = {
  id: "variant",
  itemId: accessory.id,
  fingerprint: "fingerprint",
  refine: 0,
  cards: [{ slot: 1, itemId: leftCard.id }],
  enchants: [],
  randomOptions: [],
  createdAt: "2026-06-15T00:00:00.000Z",
  updatedAt: "2026-06-15T00:00:00.000Z",
};

const itemById = new Map([
  [accessory.id, accessory],
  [leftCard.id, leftCard],
]);

test("side-specific accessory cards constrain equipment placement", () => {
  assert.equal(
    isVariantCompatibleWithSlot(variant, accessory, "accLeft", itemById),
    true,
  );
  assert.equal(
    isVariantCompatibleWithSlot(variant, accessory, "accRight", itemById),
    false,
  );
});
