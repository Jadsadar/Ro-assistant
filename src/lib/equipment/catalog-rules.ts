import type { EquipmentSlot } from "@/lib/equipment/types";

export const ITEM_TYPE_IDS = {
  weapon: 1,
  armor: 2,
  ammo: 3,
  costume: 9,
  shadow: 10,
} as const;

export const ITEM_SUB_TYPE_IDS = {
  dagger: 256,
  oneHandSword: 257,
  twoHandSword: 258,
  spear: 259,
  twoHandSpear: 260,
  axe: 261,
  twoHandAxe: 262,
  mace: 263,
  twoHandMace: 264,
  rod: 265,
  twoHandRod: 266,
  bow: 267,
  fist: 268,
  instrument: 269,
  whip: 270,
  book: 271,
  katar: 272,
  revolver: 273,
  rifle: 274,
  gatlingGun: 275,
  shotgun: 276,
  grenadeLauncher: 277,
  shuriken: 278,
  upper: 512,
  armor: 513,
  shield: 514,
  garment: 515,
  boot: 516,
  accessory: 517,
  accessoryRight: 510,
  accessoryLeft: 511,
  pet: 518,
  costumeUpper: 519,
  costumeMiddle: 520,
  costumeLower: 521,
  costumeGarment: 522,
  costumeEnchantUpper: 71,
  costumeEnchantMiddle: 72,
  costumeEnchantLower: 73,
  costumeEnchantGarment: 74,
  costumeEnchantGarment4: 75,
  costumeEnchantGarment2: 76,
  shadowWeapon: 280,
  shadowArmor: 526,
  shadowShield: 527,
  shadowBoot: 528,
  shadowEarring: 529,
  shadowPendant: 530,
} as const;

const ONE_HAND_WEAPON_SUB_TYPES = new Set<number>([
  ITEM_SUB_TYPE_IDS.dagger,
  ITEM_SUB_TYPE_IDS.oneHandSword,
  ITEM_SUB_TYPE_IDS.spear,
  ITEM_SUB_TYPE_IDS.axe,
  ITEM_SUB_TYPE_IDS.mace,
  ITEM_SUB_TYPE_IDS.rod,
  ITEM_SUB_TYPE_IDS.fist,
  ITEM_SUB_TYPE_IDS.book,
]);

interface CatalogSlotInput {
  itemTypeId: number;
  itemSubTypeId: number;
  displaySlot: string | null;
}

export function resolveEquipmentSlots({
  itemTypeId,
  itemSubTypeId,
  displaySlot,
}: CatalogSlotInput): EquipmentSlot[] {
  if (itemTypeId === ITEM_TYPE_IDS.weapon) {
    return ONE_HAND_WEAPON_SUB_TYPES.has(itemSubTypeId)
      ? ["weapon", "leftWeapon"]
      : ["weapon"];
  }
  if (itemTypeId === ITEM_TYPE_IDS.ammo) return ["ammo"];

  const slotsBySubType: Partial<Record<number, EquipmentSlot[]>> = {
    [ITEM_SUB_TYPE_IDS.armor]: ["armor"],
    [ITEM_SUB_TYPE_IDS.shield]: ["shield"],
    [ITEM_SUB_TYPE_IDS.garment]: ["garment"],
    [ITEM_SUB_TYPE_IDS.boot]: ["boot"],
    [ITEM_SUB_TYPE_IDS.accessory]: ["accLeft", "accRight"],
    [ITEM_SUB_TYPE_IDS.accessoryLeft]: ["accLeft"],
    [ITEM_SUB_TYPE_IDS.accessoryRight]: ["accRight"],
    [ITEM_SUB_TYPE_IDS.pet]: ["pet"],
    [ITEM_SUB_TYPE_IDS.costumeUpper]: ["costumeUpper"],
    [ITEM_SUB_TYPE_IDS.costumeMiddle]: ["costumeMiddle"],
    [ITEM_SUB_TYPE_IDS.costumeLower]: ["costumeLower"],
    [ITEM_SUB_TYPE_IDS.costumeGarment]: ["costumeGarment"],
    [ITEM_SUB_TYPE_IDS.costumeEnchantUpper]: ["costumeEnchantUpper"],
    [ITEM_SUB_TYPE_IDS.costumeEnchantMiddle]: ["costumeEnchantMiddle"],
    [ITEM_SUB_TYPE_IDS.costumeEnchantLower]: ["costumeEnchantLower"],
    [ITEM_SUB_TYPE_IDS.costumeEnchantGarment]: ["costumeEnchantGarment"],
    [ITEM_SUB_TYPE_IDS.costumeEnchantGarment2]: ["costumeEnchantGarment2"],
    [ITEM_SUB_TYPE_IDS.costumeEnchantGarment4]: ["costumeEnchantGarment4"],
    [ITEM_SUB_TYPE_IDS.shadowWeapon]: ["shadowWeapon"],
    [ITEM_SUB_TYPE_IDS.shadowArmor]: ["shadowArmor"],
    [ITEM_SUB_TYPE_IDS.shadowShield]: ["shadowShield"],
    [ITEM_SUB_TYPE_IDS.shadowBoot]: ["shadowBoot"],
    [ITEM_SUB_TYPE_IDS.shadowEarring]: ["shadowEarring"],
    [ITEM_SUB_TYPE_IDS.shadowPendant]: ["shadowPendant"],
  };
  const resolved = slotsBySubType[itemSubTypeId];
  if (resolved) return resolved;

  if (itemSubTypeId === ITEM_SUB_TYPE_IDS.upper) {
    if (displaySlot === "Middle") return ["headMiddle"];
    if (displaySlot === "Lower") return ["headLower"];
    return ["headUpper"];
  }

  return [];
}

export function resolveRandomOptionCount(
  itemTypeId: number,
  equipSlots: EquipmentSlot[],
  configuredCount: number,
): number {
  if (itemTypeId === ITEM_TYPE_IDS.weapon) return 3;
  if (equipSlots.some((slot) => slot.startsWith("shadow"))) return 1;
  return configuredCount;
}
