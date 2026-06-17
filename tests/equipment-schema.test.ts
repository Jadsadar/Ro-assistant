import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD_POSITIONS,
  EQUIPMENT_SLOT_RULES,
  cardPositionsForSlot,
} from "../src/lib/equipment/types";
import {
  ITEM_SUB_TYPE_IDS,
  ITEM_TYPE_IDS,
  resolveCardSlotCount,
  resolveEquipmentSlots,
  resolveRandomOptionCount,
} from "../src/lib/equipment/catalog-rules";

test("card compatibility follows the legacy calculator positions", () => {
  assert.deepEqual(cardPositionsForSlot("weapon"), [CARD_POSITIONS.weapon]);
  assert.deepEqual(cardPositionsForSlot("boot"), [CARD_POSITIONS.boot]);
  assert.deepEqual(cardPositionsForSlot("accLeft"), [
    CARD_POSITIONS.accessory,
    CARD_POSITIONS.accessoryLeft,
  ]);
  assert.deepEqual(cardPositionsForSlot("accRight"), [
    CARD_POSITIONS.accessory,
    CARD_POSITIONS.accessoryRight,
  ]);
  assert.deepEqual(cardPositionsForSlot("shadowWeapon"), []);
});

test("catalog slots match the legacy item subtype rules", () => {
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.weapon,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.oneHandSword,
      displaySlot: "Weapon",
    }),
    ["weapon", "leftWeapon"],
  );
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.weapon,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.spear,
      displaySlot: "Weapon",
    }),
    ["weapon", "leftWeapon"],
  );
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.weapon,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.twoHandSword,
      displaySlot: "Weapon",
    }),
    ["weapon"],
  );
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.weapon,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.bow,
      displaySlot: "Weapon",
    }),
    ["weapon"],
  );
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.costume,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.costumeUpper,
      displaySlot: "Upper",
    }),
    ["costumeUpper"],
  );
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: 11,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.costumeEnchantGarment2,
      displaySlot: null,
    }),
    ["costumeEnchantGarment2"],
  );
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.shadow,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.shadowBoot,
      displaySlot: "Shadow Shoes",
    }),
    ["shadowBoot"],
  );
});

test("slot relations match the legacy calculator controls", () => {
  assert.equal(EQUIPMENT_SLOT_RULES.weapon.maxCards, 4);
  assert.deepEqual(EQUIPMENT_SLOT_RULES.weapon.enchantSlots, [0, 1, 2, 3]);
  assert.equal(EQUIPMENT_SLOT_RULES.boot.maxCards, 1);
  assert.deepEqual(EQUIPMENT_SLOT_RULES.boot.enchantSlots, [1, 2, 3]);
  assert.equal(EQUIPMENT_SLOT_RULES.shadowWeapon.maxCards, 0);
  assert.deepEqual(EQUIPMENT_SLOT_RULES.shadowWeapon.enchantSlots, [2, 3]);
});

test("random option slot counts follow legacy equipment controls", () => {
  assert.equal(resolveRandomOptionCount(ITEM_TYPE_IDS.weapon, ["weapon"], 0), 3);
  assert.equal(
    resolveRandomOptionCount(ITEM_TYPE_IDS.shadow, ["shadowBoot"], 0),
    1,
  );
  assert.equal(resolveRandomOptionCount(ITEM_TYPE_IDS.armor, ["boot"], 2), 2);
});

test("card slot count falls back to bracketed item names", () => {
  assert.equal(
    resolveCardSlotCount({ name: "Legacy Weapon [2]", slots: 1 }, 4),
    2,
  );
  assert.equal(
    resolveCardSlotCount({ name: "Legacy Weapon [4]", slots: 1 }, 2),
    2,
  );
  assert.equal(resolveCardSlotCount({ name: "Armor", slots: 1 }, 1), 1);
});
