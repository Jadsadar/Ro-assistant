import { EQUIPMENT_SLOT_RULES, type EquipmentSlot } from "@/lib/equipment/types";

/**
 * Legacy `ItemTypeId` (tong-calc-ro/src/app/constants/item.const.ts).
 * Ammo is 4; 3 is the consumable bucket.
 */
export const ITEM_TYPE_IDS = {
  weapon: 1,
  armor: 2,
  consumable: 3,
  ammo: 4,
  etc: 5,
  card: 6,
  costume: 9,
  shadow: 10,
  enchant: 11,
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
  arrow: 1024,
  cannonball: 1025,
  kunai: 1026,
  bullet: 1027,
} as const;

/** Legacy `WeaponTypeNameMapBySubTypeId` (constants/weapon-type-mapper.ts). */
const WEAPON_TYPE_NAME_BY_SUB_TYPE_ID: Record<number, string> = {
  256: "dagger",
  257: "sword",
  258: "twohandSword",
  259: "spear",
  260: "twohandSpear",
  261: "axe",
  262: "twohandAxe",
  263: "mace",
  264: "twohandMace",
  265: "rod",
  266: "twohandRod",
  267: "bow",
  268: "fist",
  269: "instrument",
  270: "whip",
  271: "book",
  272: "katar",
  273: "gun",
  274: "gun",
  275: "gun",
  276: "gun",
  277: "gun",
  278: "shuriken",
};

/**
 * Only daggers and one-hand swords ever entered the legacy `leftWeaponList`
 * (ro-calculator.component.ts:1840). This is deliberately narrower than the set
 * of one-hand weapons — being one-handed is what opens the shield slot, which is
 * a different question.
 */
const LEFT_WEAPON_SUB_TYPES = new Set<number>([
  ITEM_SUB_TYPE_IDS.dagger,
  ITEM_SUB_TYPE_IDS.oneHandSword,
]);

/** Legacy `AllowShieldTable` (domain/weapon.ts:118). */
const ALLOWS_SHIELD_WEAPON_TYPES = new Set<string>([
  "sword",
  "whip",
  "instrument",
  "fist",
  "dagger",
  "mace",
  "rod",
  "book",
  "spear",
  "axe",
]);

/** Legacy `AllowAmmoMapper` (constants/allow-ammo-mapper.ts). */
const ALLOWS_AMMO_WEAPON_TYPES = new Set<string>([
  "bow",
  "gun",
  "whip",
  "instrument",
  "shuriken",
]);

/** Legacy `WeaponAmmoMapper` (constants/weapon-ammo-mapper.ts). */
const WEAPON_AMMO_SUB_TYPE_ID: Record<string, number> = {
  bow: ITEM_SUB_TYPE_IDS.arrow,
  whip: ITEM_SUB_TYPE_IDS.arrow,
  instrument: ITEM_SUB_TYPE_IDS.arrow,
  gun: ITEM_SUB_TYPE_IDS.bullet,
  shuriken: ITEM_SUB_TYPE_IDS.kunai,
};

export interface WeaponCapabilities {
  /** Whether the item can occupy the main-hand slot at all. */
  canEquipMainHand: boolean;
  /** Whether the item may be equipped in the off-hand weapon slot. */
  canEquipLeftWeapon: boolean;
  /** Whether holding this weapon leaves the shield slot available. */
  allowsShield: boolean;
  /** Whether this weapon consumes ammunition. */
  allowsAmmo: boolean;
  /** The ammo subtype this weapon requires, if any. */
  ammoSubTypeId: number | null;
  twoHanded: boolean;
  weaponTypeName: string | null;
}

const NON_WEAPON_CAPABILITIES: WeaponCapabilities = {
  canEquipMainHand: false,
  canEquipLeftWeapon: false,
  allowsShield: false,
  allowsAmmo: false,
  ammoSubTypeId: null,
  twoHanded: false,
  weaponTypeName: null,
};

/**
 * Resolves the four independent questions the legacy UI asked about a weapon.
 * They were previously conflated into a single "is one-handed" set, which both
 * over-opened the off-hand slot and under-opened the shield slot.
 */
export function resolveWeaponCapabilities({
  itemTypeId,
  itemSubTypeId,
}: {
  itemTypeId: number;
  itemSubTypeId: number;
}): WeaponCapabilities {
  if (itemTypeId !== ITEM_TYPE_IDS.weapon) return NON_WEAPON_CAPABILITIES;

  const weaponTypeName = WEAPON_TYPE_NAME_BY_SUB_TYPE_ID[itemSubTypeId] ?? null;
  const allowsAmmo = weaponTypeName
    ? ALLOWS_AMMO_WEAPON_TYPES.has(weaponTypeName)
    : false;

  return {
    canEquipMainHand: true,
    canEquipLeftWeapon: LEFT_WEAPON_SUB_TYPES.has(itemSubTypeId),
    allowsShield: weaponTypeName
      ? ALLOWS_SHIELD_WEAPON_TYPES.has(weaponTypeName)
      : false,
    allowsAmmo,
    ammoSubTypeId: weaponTypeName
      ? (WEAPON_AMMO_SUB_TYPE_ID[weaponTypeName] ?? null)
      : null,
    twoHanded: weaponTypeName ? weaponTypeName.startsWith("twohand") : false,
    weaponTypeName,
  };
}

interface CatalogSlotInput {
  itemTypeId: number;
  itemSubTypeId: number;
  /**
   * The raw legacy `location` field ("Middle" / "Lower" / null). The legacy
   * component split headgear on this value alone; deriving it from a display
   * label instead misplaces headgear whose description mentions another slot.
   */
  headgearLocation: string | null;
}

export function resolveEquipmentSlots({
  itemTypeId,
  itemSubTypeId,
  headgearLocation,
}: CatalogSlotInput): EquipmentSlot[] {
  // Weapons only ever occupy the main hand as a slot. Whether the off-hand is
  // available is a capability of the equipped weapon plus the class, resolved by
  // resolveWeaponCapabilities() and the weapon state machine.
  if (itemTypeId === ITEM_TYPE_IDS.weapon) return ["weapon"];
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
    if (headgearLocation === "Middle") return ["headMiddle"];
    if (headgearLocation === "Lower") return ["headLower"];
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

/**
 * Grade eligibility. The legacy calculator read the source `canGrade` flag alone
 * (equipment.component.ts:205); the name heuristics below cover Patent and -LT
 * gear that the synced release does not always flag. Refine is deliberately not
 * consulted — the legacy code never coupled the two, and doing so made the
 * gradable set move whenever the refine rules changed.
 */
export function resolveCanGrade(item: {
  name?: string;
  aegisName?: string;
  canGrade?: boolean | null;
  equipSlots?: readonly EquipmentSlot[];
}): boolean {
  if (item.canGrade === true) return true;
  if (!item.equipSlots?.some((slot) => EQUIPMENT_SLOT_RULES[slot].allowsGrade)) {
    return false;
  }

  const name = item.name?.trim() ?? "";
  const aegisName = item.aegisName?.trim() ?? "";
  return (
    /^Patent\s/i.test(name) ||
    /-LT(?:\s|\[|$)/i.test(name) ||
    /^Up_/i.test(aegisName) ||
    /_LT$/i.test(aegisName)
  );
}

export function resolveCardSlotCount(
  item: { name?: string; aegisName?: string; slots?: number | null },
  maxCards: number,
): number {
  const catalogSlots = Number.isFinite(item.slots) ? Number(item.slots) : 0;
  const bracketSlots = [item.name, item.aegisName].reduce((largest, value) => {
    const match = value?.match(/\[(\d+)\]\s*$/);
    const parsed = match ? Number(match[1]) : 0;
    return Number.isInteger(parsed) ? Math.max(largest, parsed) : largest;
  }, 0);

  return Math.min(maxCards, Math.max(catalogSlots, bracketSlots));
}
