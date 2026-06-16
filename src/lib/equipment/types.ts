export const SERVER_IDS = ["thor", "chaos"] as const;
export type ServerId = (typeof SERVER_IDS)[number];

export const ITEM_GRADES = ["D", "C", "B", "A"] as const;
export type ItemGrade = (typeof ITEM_GRADES)[number];

export const EQUIPMENT_SLOTS = [
  "weapon",
  "leftWeapon",
  "ammo",
  "shield",
  "headUpper",
  "headMiddle",
  "headLower",
  "armor",
  "garment",
  "boot",
  "accLeft",
  "accRight",
  "pet",
  "costumeUpper",
  "costumeMiddle",
  "costumeLower",
  "costumeGarment",
  "costumeEnchantUpper",
  "costumeEnchantMiddle",
  "costumeEnchantLower",
  "costumeEnchantGarment",
  "costumeEnchantGarment2",
  "costumeEnchantGarment4",
  "shadowWeapon",
  "shadowArmor",
  "shadowShield",
  "shadowBoot",
  "shadowEarring",
  "shadowPendant",
] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export interface EquipmentSlotRule {
  allowsRefine: boolean;
  allowsGrade: boolean;
  maxCards: number;
  enchantSlots: readonly number[];
}

const NO_RELATIONS: EquipmentSlotRule = {
  allowsRefine: false,
  allowsGrade: false,
  maxCards: 0,
  enchantSlots: [],
};

export const EQUIPMENT_SLOT_RULES: Record<
  EquipmentSlot,
  EquipmentSlotRule
> = {
  weapon: {
    allowsRefine: true,
    allowsGrade: true,
    maxCards: 4,
    enchantSlots: [0, 1, 2, 3],
  },
  leftWeapon: {
    allowsRefine: true,
    allowsGrade: true,
    maxCards: 4,
    enchantSlots: [0, 1, 2, 3],
  },
  ammo: NO_RELATIONS,
  shield: {
    allowsRefine: true,
    allowsGrade: true,
    maxCards: 1,
    enchantSlots: [1, 2, 3],
  },
  headUpper: {
    allowsRefine: true,
    allowsGrade: true,
    maxCards: 1,
    enchantSlots: [1, 2, 3],
  },
  headMiddle: {
    allowsRefine: false,
    allowsGrade: true,
    maxCards: 1,
    enchantSlots: [1, 2, 3],
  },
  headLower: {
    allowsRefine: false,
    allowsGrade: true,
    maxCards: 0,
    enchantSlots: [1, 2, 3],
  },
  armor: {
    allowsRefine: true,
    allowsGrade: true,
    maxCards: 1,
    enchantSlots: [1, 2, 3],
  },
  garment: {
    allowsRefine: true,
    allowsGrade: true,
    maxCards: 1,
    enchantSlots: [1, 2, 3],
  },
  boot: {
    allowsRefine: true,
    allowsGrade: true,
    maxCards: 1,
    enchantSlots: [1, 2, 3],
  },
  accLeft: {
    allowsRefine: true,
    allowsGrade: true,
    maxCards: 1,
    enchantSlots: [1, 2, 3],
  },
  accRight: {
    allowsRefine: true,
    allowsGrade: true,
    maxCards: 1,
    enchantSlots: [1, 2, 3],
  },
  pet: NO_RELATIONS,
  costumeUpper: NO_RELATIONS,
  costumeMiddle: NO_RELATIONS,
  costumeLower: NO_RELATIONS,
  costumeGarment: NO_RELATIONS,
  costumeEnchantUpper: NO_RELATIONS,
  costumeEnchantMiddle: NO_RELATIONS,
  costumeEnchantLower: NO_RELATIONS,
  costumeEnchantGarment: NO_RELATIONS,
  costumeEnchantGarment2: NO_RELATIONS,
  costumeEnchantGarment4: NO_RELATIONS,
  shadowWeapon: {
    allowsRefine: true,
    allowsGrade: false,
    maxCards: 0,
    enchantSlots: [2, 3],
  },
  shadowArmor: {
    allowsRefine: true,
    allowsGrade: false,
    maxCards: 0,
    enchantSlots: [2, 3],
  },
  shadowShield: {
    allowsRefine: true,
    allowsGrade: false,
    maxCards: 0,
    enchantSlots: [2, 3],
  },
  shadowBoot: {
    allowsRefine: true,
    allowsGrade: false,
    maxCards: 0,
    enchantSlots: [2, 3],
  },
  shadowEarring: {
    allowsRefine: true,
    allowsGrade: false,
    maxCards: 0,
    enchantSlots: [2, 3],
  },
  shadowPendant: {
    allowsRefine: true,
    allowsGrade: false,
    maxCards: 0,
    enchantSlots: [2, 3],
  },
};

export const CARD_POSITIONS = {
  weapon: 0,
  head: 769,
  shield: 32,
  armor: 16,
  garment: 4,
  boot: 64,
  accessory: 136,
  accessoryLeft: 128,
  accessoryRight: 8,
} as const;

export type CardPosition =
  (typeof CARD_POSITIONS)[keyof typeof CARD_POSITIONS];

export const BASE_STAT_KEYS = [
  "str",
  "agi",
  "vit",
  "int",
  "dex",
  "luk",
] as const;

export const TRAIT_STAT_KEYS = [
  "pow",
  "sta",
  "wis",
  "spl",
  "con",
  "crt",
] as const;

export type CharacterStatKey =
  | (typeof BASE_STAT_KEYS)[number]
  | (typeof TRAIT_STAT_KEYS)[number];

export type CharacterStats = Record<CharacterStatKey, number>;

export function cardPositionsForSlot(slot: EquipmentSlot): CardPosition[] {
  switch (slot) {
    case "weapon":
    case "leftWeapon":
      return [CARD_POSITIONS.weapon];
    case "headUpper":
    case "headMiddle":
      return [CARD_POSITIONS.head];
    case "shield":
      return [CARD_POSITIONS.shield];
    case "armor":
      return [CARD_POSITIONS.armor];
    case "garment":
      return [CARD_POSITIONS.garment];
    case "boot":
      return [CARD_POSITIONS.boot];
    case "accLeft":
      return [CARD_POSITIONS.accessory, CARD_POSITIONS.accessoryLeft];
    case "accRight":
      return [CARD_POSITIONS.accessory, CARD_POSITIONS.accessoryRight];
    default:
      return [];
  }
}
