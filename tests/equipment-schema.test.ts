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
  resolveWeaponCapabilities,
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
  // Weapons occupy the main hand only. Off-hand eligibility is a capability,
  // asserted separately below and in tests/parity-equipment-list.test.ts.
  for (const itemSubTypeId of [
    ITEM_SUB_TYPE_IDS.oneHandSword,
    ITEM_SUB_TYPE_IDS.spear,
    ITEM_SUB_TYPE_IDS.twoHandSword,
    ITEM_SUB_TYPE_IDS.bow,
  ]) {
    assert.deepEqual(
      resolveEquipmentSlots({
        itemTypeId: ITEM_TYPE_IDS.weapon,
        itemSubTypeId,
        headgearLocation: null,
      }),
      ["weapon"],
    );
  }
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.ammo,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.arrow,
      headgearLocation: null,
    }),
    ["ammo"],
  );
  // itemTypeId 3 is the legacy consumable bucket, not ammo.
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.consumable,
      itemSubTypeId: 768,
      headgearLocation: null,
    }),
    [],
  );
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.armor,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.upper,
      headgearLocation: null,
    }),
    ["headUpper"],
  );
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.armor,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.upper,
      headgearLocation: "Middle",
    }),
    ["headMiddle"],
  );
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.costume,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.costumeUpper,
      headgearLocation: null,
    }),
    ["costumeUpper"],
  );
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: 11,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.costumeEnchantGarment2,
      headgearLocation: null,
    }),
    ["costumeEnchantGarment2"],
  );
  assert.deepEqual(
    resolveEquipmentSlots({
      itemTypeId: ITEM_TYPE_IDS.shadow,
      itemSubTypeId: ITEM_SUB_TYPE_IDS.shadowBoot,
      headgearLocation: null,
    }),
    ["shadowBoot"],
  );
});

test("weapon capabilities separate off-hand, shield and ammo eligibility", () => {
  const capability = (itemSubTypeId: number) =>
    resolveWeaponCapabilities({
      itemTypeId: ITEM_TYPE_IDS.weapon,
      itemSubTypeId,
    });

  // Only daggers and one-hand swords entered the legacy leftWeaponList.
  assert.equal(capability(ITEM_SUB_TYPE_IDS.dagger).canEquipLeftWeapon, true);
  assert.equal(
    capability(ITEM_SUB_TYPE_IDS.oneHandSword).canEquipLeftWeapon,
    true,
  );
  for (const itemSubTypeId of [
    ITEM_SUB_TYPE_IDS.spear,
    ITEM_SUB_TYPE_IDS.axe,
    ITEM_SUB_TYPE_IDS.mace,
    ITEM_SUB_TYPE_IDS.rod,
    ITEM_SUB_TYPE_IDS.fist,
    ITEM_SUB_TYPE_IDS.book,
  ]) {
    assert.equal(capability(itemSubTypeId).canEquipLeftWeapon, false);
  }

  // ...but all of those still leave the shield slot open, as do whip and instrument.
  for (const itemSubTypeId of [
    ITEM_SUB_TYPE_IDS.spear,
    ITEM_SUB_TYPE_IDS.axe,
    ITEM_SUB_TYPE_IDS.whip,
    ITEM_SUB_TYPE_IDS.instrument,
  ]) {
    assert.equal(capability(itemSubTypeId).allowsShield, true);
  }
  for (const itemSubTypeId of [
    ITEM_SUB_TYPE_IDS.twoHandSword,
    ITEM_SUB_TYPE_IDS.bow,
    ITEM_SUB_TYPE_IDS.katar,
    ITEM_SUB_TYPE_IDS.shuriken,
  ]) {
    assert.equal(capability(itemSubTypeId).allowsShield, false);
  }

  assert.equal(capability(ITEM_SUB_TYPE_IDS.twoHandSpear).twoHanded, true);
  assert.equal(capability(ITEM_SUB_TYPE_IDS.spear).twoHanded, false);

  assert.deepEqual(
    {
      allowsAmmo: capability(ITEM_SUB_TYPE_IDS.bow).allowsAmmo,
      ammoSubTypeId: capability(ITEM_SUB_TYPE_IDS.bow).ammoSubTypeId,
    },
    { allowsAmmo: true, ammoSubTypeId: ITEM_SUB_TYPE_IDS.arrow },
  );
  assert.equal(
    capability(ITEM_SUB_TYPE_IDS.revolver).ammoSubTypeId,
    ITEM_SUB_TYPE_IDS.bullet,
  );
  assert.equal(
    capability(ITEM_SUB_TYPE_IDS.shuriken).ammoSubTypeId,
    ITEM_SUB_TYPE_IDS.kunai,
  );
  assert.equal(capability(ITEM_SUB_TYPE_IDS.dagger).allowsAmmo, false);
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
