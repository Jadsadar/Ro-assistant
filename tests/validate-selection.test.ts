import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogSearchItem } from "../src/lib/catalog/types";
import {
  validateCalculatorSelection,
  type ValidatableSelection,
} from "../src/lib/calculator/validate-selection";
import type { EquipmentSlot } from "../src/lib/equipment/types";

const SHADOW_CROSS = 4254;
const ARCH_MAGE = 4255;

function item(overrides: Partial<CatalogSearchItem>): CatalogSearchItem {
  return {
    id: 0,
    name: "Item",
    aegisName: "Item",
    itemTypeId: 2,
    itemSubTypeId: 513,
    itemType: "Armor",
    slot: "Armor",
    equipSlots: ["armor"],
    category: "equipment-armor",
    slots: 0,
    compositionPos: null,
    canGrade: false,
    isRefinable: true,
    requiredLevel: null,
    searchable: "item",
    ...overrides,
  };
}

const dagger = item({
  id: 1201,
  name: "Knife",
  itemTypeId: 1,
  itemSubTypeId: 256,
  itemType: "Weapon",
  equipSlots: ["weapon"],
  slots: 3,
});
const twoHandSword = item({
  id: 1101,
  name: "Two Hand Sword",
  itemTypeId: 1,
  itemSubTypeId: 258,
  equipSlots: ["weapon"],
});
const bow = item({
  id: 1701,
  name: "Bow",
  itemTypeId: 1,
  itemSubTypeId: 267,
  equipSlots: ["weapon"],
});
const shield = item({ id: 2101, name: "Guard", itemSubTypeId: 514, equipSlots: ["shield"] });
const accessory = item({
  id: 2601,
  name: "Ring",
  itemSubTypeId: 517,
  equipSlots: ["accLeft", "accRight"],
  isRefinable: false,
  slots: 1,
});
const weaponCard = item({
  id: 4001,
  name: "Weapon Card",
  itemTypeId: 6,
  itemSubTypeId: 0,
  equipSlots: [],
  compositionPos: 0,
});
const armorCard = item({
  id: 4002,
  name: "Armor Card",
  itemTypeId: 6,
  itemSubTypeId: 0,
  equipSlots: [],
  compositionPos: 16,
});
const arrow = item({
  id: 1750,
  name: "Arrow",
  itemTypeId: 4,
  itemSubTypeId: 1024,
  equipSlots: ["ammo"],
});
const bullet = item({
  id: 13200,
  name: "Bullet",
  itemTypeId: 4,
  itemSubTypeId: 1027,
  equipSlots: ["ammo"],
});

const CATALOG = [
  dagger,
  twoHandSword,
  bow,
  shield,
  accessory,
  weaponCard,
  armorCard,
  arrow,
  bullet,
];

function selection(
  overrides: Partial<ValidatableSelection> = {},
): ValidatableSelection {
  return { refine: 0, cardIds: [], optionKeys: [], ...overrides };
}

function validate(
  equipment: Partial<Record<EquipmentSlot, ValidatableSelection>>,
  classId = SHADOW_CROSS,
) {
  return validateCalculatorSelection({
    classId,
    equipment,
    items: CATALOG,
    options: {},
  });
}

function codes(result: ReturnType<typeof validate>) {
  return result.errors.map((issue) => issue.code);
}

test("a valid dual-wield build passes", () => {
  const result = validate({
    weapon: selection({ itemId: dagger.id }),
    leftWeapon: selection({ itemId: dagger.id }),
  });
  assert.deepEqual(result.errors, []);
});

test("shield and left weapon cannot be equipped together", () => {
  const result = validate({
    weapon: selection({ itemId: dagger.id }),
    leftWeapon: selection({ itemId: dagger.id }),
    shield: selection({ itemId: shield.id }),
  });
  assert.ok(codes(result).includes("shield-and-left-weapon"));
});

test("a two-hand weapon rejects a shield", () => {
  const result = validate({
    weapon: selection({ itemId: twoHandSword.id }),
    shield: selection({ itemId: shield.id }),
  });
  assert.ok(codes(result).includes("shield-not-allowed"));
});

test("classes outside the dual-wield list reject an off-hand weapon", () => {
  const result = validate(
    {
      weapon: selection({ itemId: dagger.id }),
      leftWeapon: selection({ itemId: dagger.id }),
    },
    ARCH_MAGE,
  );
  assert.ok(codes(result).includes("left-weapon-class"));
});

test("an item placed in the wrong slot is rejected", () => {
  const result = validate({
    armor: selection({ itemId: shield.id }),
  });
  assert.ok(codes(result).includes("wrong-slot"));
});

test("a non-refinable accessory rejects a refine value", () => {
  const result = validate({
    accLeft: selection({ itemId: accessory.id, refine: 5 }),
  });
  assert.ok(codes(result).includes("refine-not-allowed"));
});

test("refine above the legacy maximum is rejected", () => {
  const result = validate({
    weapon: selection({ itemId: dagger.id, refine: 19 }),
  });
  assert.ok(codes(result).includes("refine-out-of-range"));
});

test("a card from another position is rejected", () => {
  const result = validate({
    weapon: selection({ itemId: dagger.id, cardIds: [armorCard.id] }),
  });
  assert.ok(codes(result).includes("card-wrong-position"));
});

test("a non-card item in a card slot is rejected", () => {
  const result = validate({
    weapon: selection({ itemId: dagger.id, cardIds: [shield.id] }),
  });
  assert.ok(codes(result).includes("not-a-card"));
});

test("more cards than the item has slots is rejected", () => {
  const result = validate({
    armor: selection({
      itemId: item({ id: 2301, name: "Armor", slots: 1 }).id,
      cardIds: [armorCard.id, armorCard.id],
    }),
  });
  // The armor above is not in CATALOG, so this also exercises unknown-item.
  assert.ok(codes(result).includes("unknown-item"));

  const withKnownItem = validateCalculatorSelection({
    classId: SHADOW_CROSS,
    equipment: {
      armor: selection({
        itemId: 2301,
        cardIds: [armorCard.id, armorCard.id],
      }),
    },
    items: [...CATALOG, item({ id: 2301, name: "Armor", slots: 1 })],
    options: {},
  });
  assert.ok(
    withKnownItem.errors.map((issue) => issue.code).includes("too-many-cards"),
  );
});

test("ammo must match the weapon's ammo type", () => {
  const wrongAmmo = validate({
    weapon: selection({ itemId: bow.id }),
    ammo: selection({ itemId: bullet.id }),
  });
  assert.ok(wrongAmmo.errors.map((issue) => issue.code).includes("ammo-wrong-type"));

  const rightAmmo = validate({
    weapon: selection({ itemId: bow.id }),
    ammo: selection({ itemId: arrow.id }),
  });
  assert.deepEqual(rightAmmo.errors, []);
});

test("ammo is rejected for weapons that do not use it", () => {
  const result = validate({
    weapon: selection({ itemId: dagger.id }),
    ammo: selection({ itemId: arrow.id }),
  });
  assert.ok(codes(result).includes("ammo-not-allowed"));
});

test("an enchant that is not in the item's groups is rejected", () => {
  const result = validateCalculatorSelection({
    classId: SHADOW_CROSS,
    equipment: {
      weapon: selection({ itemId: dagger.id, optionKeys: ["", "Bogus"] }),
    },
    items: CATALOG,
    options: {
      [dagger.id]: {
        itemId: dagger.id,
        aegisName: dagger.aegisName,
        randomOptionCount: 0,
        groups: [
          {
            slot: 1,
            label: "Enchant 1",
            choices: [{ key: "Real", label: "Real" }],
          },
        ],
      },
    },
  });
  assert.ok(
    result.errors.map((issue) => issue.code).includes("enchant-not-in-group"),
  );
});

test("an empty build warns rather than failing", () => {
  const result = validate({});
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((issue) => issue.code === "no-weapon"));
});
