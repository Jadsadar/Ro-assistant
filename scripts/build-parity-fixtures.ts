/**
 * STEP 0.1 - Parity fixture builder.
 *
 * Replays the legacy Angular calculator's own list-building rules over the legacy
 * `item.json` and writes the resulting id sets to `tests/fixtures/parity/`.
 *
 * These fixtures are the reference the new equipment rules are measured against.
 * Nothing here may import from `src/` — the whole point is that it derives its
 * answers from the legacy source, independently of the code under test.
 *
 * Legacy references (tong-calc-ro):
 *   ro-calculator.component.ts:1779-2029  setItemList()
 *   constants/item.const.ts               ItemTypeId
 *   constants/item-sub-type.enum.ts       ItemSubTypeId
 *   constants/card-position.enum.ts       CardPosition
 *   constants/head-gear-location.ts       HeadGearLocation
 *   constants/allow-left-weapon-mapper.ts AllowLeftWeaponMapper
 *   constants/allow-ammo-mapper.ts        AllowAmmoMapper
 *   constants/weapon-ammo-mapper.ts       WeaponAmmoMapper / ClassAmmoMapper
 *   constants/weapon-type-mapper.ts       WeaponTypeNameMapBySubTypeId
 *   domain/weapon.ts:118                  AllowShieldTable
 *   equipment/equipment.component.ts:171  isRefinable ?? false
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const legacyRoot = resolve(
  projectRoot,
  process.env.RO_LEGACY_ROOT ?? "tong-calc-ro",
);
const legacyDataRoot = resolve(legacyRoot, "src", "assets", "demo", "data");
const outputRoot = resolve(projectRoot, "tests", "fixtures", "parity");

// --- legacy constants, transcribed verbatim -------------------------------

const ItemTypeId = {
  WEAPON: 1,
  ARMOR: 2,
  CONSUMABLE: 3,
  AMMO: 4,
  ETC: 5,
  CARD: 6,
  ENCHANT: 11,
} as const;

const ItemSubTypeId = {
  Dagger: 256,
  OneHandSword: 257,
  Arrow: 1024,
  Cannonball: 1025,
  Kunai: 1026,
  Bullet: 1027,
  Upper: 512,
  Shield: 514,
  Armor: 513,
  Garment: 515,
  Boot: 516,
  Acc: 517,
  Acc_R: 510,
  Acc_L: 511,
  Pet: 518,
  CostumeUpper: 519,
  CostumeMiddle: 520,
  CostumeLower: 521,
  CostumeGarment: 522,
  CostumeEnhUpper: 71,
  CostumeEnhMiddle: 72,
  CostumeEnhLower: 73,
  CostumeEnhGarment: 74,
  CostumeEnhGarment2: 76,
  CostumeEnhGarment4: 75,
  ShadowWeapon: 280,
  ShadowArmor: 526,
  ShadowShield: 527,
  ShadowBoot: 528,
  ShadowEarring: 529,
  ShadowPendant: 530,
} as const;

const CardPosition = {
  Weapon: 0,
  Head: 769,
  Shield: 32,
  Armor: 16,
  Garment: 4,
  Boot: 64,
  Acc: 136,
  AccL: 128,
  AccR: 8,
} as const;

/** constants/weapon-type-mapper.ts */
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

/** domain/weapon.ts:118 AllowShieldTable */
const ALLOW_SHIELD_WEAPON_TYPES = new Set([
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

/** constants/allow-ammo-mapper.ts */
const ALLOW_AMMO_WEAPON_TYPES = new Set([
  "bow",
  "gun",
  "whip",
  "instrument",
  "shuriken",
]);

/** constants/weapon-ammo-mapper.ts WeaponAmmoMapper */
const WEAPON_AMMO_SUB_TYPE: Record<string, number> = {
  bow: ItemSubTypeId.Arrow,
  whip: ItemSubTypeId.Arrow,
  instrument: ItemSubTypeId.Arrow,
  gun: ItemSubTypeId.Bullet,
  shuriken: ItemSubTypeId.Kunai,
};

/** constants/weapon-ammo-mapper.ts ClassAmmoMapper */
const CLASS_AMMO_SUB_TYPE: Record<string, number> = {
  Oboro: ItemSubTypeId.Kunai,
  Shinkiro: ItemSubTypeId.Kunai,
  Kagerou: ItemSubTypeId.Kunai,
  Shiranui: ItemSubTypeId.Kunai,
  Mechanic: ItemSubTypeId.Cannonball,
  Meister: ItemSubTypeId.Cannonball,
  Genetic: ItemSubTypeId.Cannonball,
  Biolo: ItemSubTypeId.Cannonball,
};

/** constants/allow-left-weapon-mapper.ts */
const ALLOW_LEFT_WEAPON_CLASSES = [
  "GuillotineCross",
  "ShadowCross",
  "Oboro",
  "Shiranui",
  "Kagerou",
  "Shinkiro",
];

/**
 * Classes sampled for the class-filter fixture, one per generation bucket that
 * `broadClassTokens()` distinguishes. `className` is the legacy ClassName key,
 * which is what usableClass/unusableClass entries are written against.
 */
const CLASS_FILTER_SAMPLE: Array<{
  classId: number;
  className: string;
  generation: "3" | "4" | "expanded";
}> = [
  { classId: 4254, className: "ShadowCross", generation: "4" },
  { classId: 5, className: "GuillotineCross", generation: "3" },
  { classId: 18, className: "Kagerou", generation: "expanded" },
  { classId: 30, className: "SuperNovice", generation: "expanded" },
];

function broadClassTokens(generation: "3" | "4" | "expanded"): string[] {
  if (generation === "4") return ["Only 4th", "4th"];
  if (generation === "3") return ["Only 3rd Cls", "3rd"];
  return ["Expanded", "Only Expanded"];
}

// --- raw item shape -------------------------------------------------------

interface RawItem {
  id: number;
  name?: string;
  aegisName?: string;
  slots?: number;
  itemTypeId?: number;
  itemSubTypeId?: number;
  itemLevel?: number | null;
  location?: string | null;
  compositionPos?: number | null;
  usableClass?: string[];
  unusableClass?: string[];
  isRefinable?: boolean;
  canGrade?: boolean;
}

function readLegacyCommit(): string {
  try {
    return execFileSync("git", ["-C", legacyRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

/** `sortObj('name')` in the legacy component; ids are what we persist. */
function sortedIds(items: RawItem[]): number[] {
  return items
    .slice()
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    .map((item) => Number(item.id));
}

// --- fixture builders -----------------------------------------------------

/** Mirrors setItemList()'s per-slot lists. */
function buildSlotItemLists(items: RawItem[]): Record<string, number[]> {
  const lists: Record<string, RawItem[]> = {
    weapon: [],
    leftWeapon: [],
    ammo: [],
    headUpper: [],
    headMiddle: [],
    headLower: [],
    armor: [],
    shield: [],
    garment: [],
    boot: [],
    accLeft: [],
    accRight: [],
    pet: [],
    costumeUpper: [],
    costumeMiddle: [],
    costumeLower: [],
    costumeGarment: [],
    costumeEnchantUpper: [],
    costumeEnchantMiddle: [],
    costumeEnchantLower: [],
    costumeEnchantGarment: [],
    costumeEnchantGarment2: [],
    costumeEnchantGarment4: [],
    shadowWeapon: [],
    shadowArmor: [],
    shadowShield: [],
    shadowBoot: [],
    shadowEarring: [],
    shadowPendant: [],
  };

  for (const item of items) {
    const itemTypeId = Number(item.itemTypeId ?? 0);
    const itemSubTypeId = Number(item.itemSubTypeId ?? 0);

    if (itemTypeId === ItemTypeId.WEAPON) {
      lists.weapon.push(item);
      // ro-calculator.component.ts:1840 — dagger and one-hand sword only.
      if (
        itemSubTypeId === ItemSubTypeId.Dagger ||
        itemSubTypeId === ItemSubTypeId.OneHandSword
      ) {
        lists.leftWeapon.push(item);
      }
      continue;
    }
    if (itemTypeId === ItemTypeId.AMMO) {
      lists.ammo.push(item);
      continue;
    }
    if (itemTypeId === ItemTypeId.CONSUMABLE) continue;

    switch (itemSubTypeId) {
      case ItemSubTypeId.Upper:
        if (item.location === "Middle") lists.headMiddle.push(item);
        else if (item.location === "Lower") lists.headLower.push(item);
        else lists.headUpper.push(item);
        continue;
      case ItemSubTypeId.Shield:
        lists.shield.push(item);
        continue;
      case ItemSubTypeId.Armor:
        lists.armor.push(item);
        continue;
      case ItemSubTypeId.Garment:
        lists.garment.push(item);
        continue;
      case ItemSubTypeId.Boot:
        lists.boot.push(item);
        continue;
      case ItemSubTypeId.Acc_L:
        lists.accLeft.push(item);
        continue;
      case ItemSubTypeId.Acc_R:
        lists.accRight.push(item);
        continue;
      case ItemSubTypeId.Acc:
        lists.accLeft.push(item);
        lists.accRight.push(item);
        continue;
      case ItemSubTypeId.Pet:
        lists.pet.push(item);
        continue;
      case ItemSubTypeId.CostumeUpper:
        lists.costumeUpper.push(item);
        continue;
      case ItemSubTypeId.CostumeMiddle:
        lists.costumeMiddle.push(item);
        continue;
      case ItemSubTypeId.CostumeLower:
        lists.costumeLower.push(item);
        continue;
      case ItemSubTypeId.CostumeGarment:
        lists.costumeGarment.push(item);
        continue;
      case ItemSubTypeId.CostumeEnhUpper:
        lists.costumeEnchantUpper.push(item);
        continue;
      case ItemSubTypeId.CostumeEnhMiddle:
        lists.costumeEnchantMiddle.push(item);
        continue;
      case ItemSubTypeId.CostumeEnhLower:
        lists.costumeEnchantLower.push(item);
        continue;
      case ItemSubTypeId.CostumeEnhGarment:
        lists.costumeEnchantGarment.push(item);
        continue;
      case ItemSubTypeId.CostumeEnhGarment2:
        lists.costumeEnchantGarment2.push(item);
        continue;
      case ItemSubTypeId.CostumeEnhGarment4:
        lists.costumeEnchantGarment4.push(item);
        continue;
      case ItemSubTypeId.ShadowWeapon:
        lists.shadowWeapon.push(item);
        continue;
      case ItemSubTypeId.ShadowArmor:
        lists.shadowArmor.push(item);
        continue;
      case ItemSubTypeId.ShadowShield:
        lists.shadowShield.push(item);
        continue;
      case ItemSubTypeId.ShadowBoot:
        lists.shadowBoot.push(item);
        continue;
      case ItemSubTypeId.ShadowEarring:
        lists.shadowEarring.push(item);
        continue;
      case ItemSubTypeId.ShadowPendant:
        lists.shadowPendant.push(item);
        continue;
    }
  }

  return Object.fromEntries(
    Object.entries(lists).map(([slot, entries]) => [slot, sortedIds(entries)]),
  );
}

/** Mirrors setItemList()'s card lists, keyed by the slot the cards are offered in. */
function buildCardLists(items: RawItem[]): Record<string, number[]> {
  const lists: Record<string, RawItem[]> = {
    weapon: [],
    head: [],
    shield: [],
    armor: [],
    garment: [],
    boot: [],
    accLeft: [],
    accRight: [],
  };

  for (const item of items) {
    if (Number(item.itemTypeId ?? 0) !== ItemTypeId.CARD) continue;

    switch (item.compositionPos) {
      case CardPosition.Weapon:
        lists.weapon.push(item);
        continue;
      case CardPosition.Head:
        lists.head.push(item);
        continue;
      case CardPosition.Shield:
        lists.shield.push(item);
        continue;
      case CardPosition.Armor:
        lists.armor.push(item);
        continue;
      case CardPosition.Garment:
        lists.garment.push(item);
        continue;
      case CardPosition.Boot:
        lists.boot.push(item);
        continue;
      case CardPosition.AccL:
        lists.accLeft.push(item);
        continue;
      case CardPosition.AccR:
        lists.accRight.push(item);
        continue;
      case CardPosition.Acc:
        lists.accLeft.push(item);
        lists.accRight.push(item);
        continue;
    }
  }

  return Object.fromEntries(
    Object.entries(lists).map(([slot, entries]) => [slot, sortedIds(entries)]),
  );
}

/** Per-weapon capabilities: what the legacy UI would open for each weapon. */
function buildWeaponCapabilities(items: RawItem[]) {
  const entries = items
    .filter((item) => Number(item.itemTypeId ?? 0) === ItemTypeId.WEAPON)
    .map((item) => {
      const itemSubTypeId = Number(item.itemSubTypeId ?? 0);
      const typeName = WEAPON_TYPE_NAME_BY_SUB_TYPE_ID[itemSubTypeId] ?? "";
      return {
        id: Number(item.id),
        itemSubTypeId,
        typeName,
        // domain/weapon.ts:203 — no weapon selected means shields stay available,
        // but a selected weapon must be in AllowShieldTable.
        allowsShield: ALLOW_SHIELD_WEAPON_TYPES.has(typeName),
        allowsAmmo: ALLOW_AMMO_WEAPON_TYPES.has(typeName),
        ammoSubTypeId: WEAPON_AMMO_SUB_TYPE[typeName] ?? null,
        canEquipLeftWeapon:
          itemSubTypeId === ItemSubTypeId.Dagger ||
          itemSubTypeId === ItemSubTypeId.OneHandSword,
      };
    })
    .sort((a, b) => a.id - b.id);

  return {
    allowLeftWeaponClasses: ALLOW_LEFT_WEAPON_CLASSES,
    classAmmoSubTypes: CLASS_AMMO_SUB_TYPE,
    /** Shields are available while no weapon is equipped (weapon.ts:204). */
    allowsShieldWithoutWeapon: true,
    weapons: entries,
  };
}

/** Items the legacy source explicitly flags as gradable (equipment.component.ts:205). */
function buildGradable(items: RawItem[]) {
  return {
    canGradeIds: items
      .filter((item) => item.canGrade === true)
      .map((item) => Number(item.id))
      .sort((a, b) => a - b),
  };
}

/** equipment.component.ts:171 — `isRefinable ?? false`, no slot-based fallback. */
function buildRefinable(items: RawItem[]) {
  const refinable = items
    .filter((item) => item.isRefinable === true)
    .map((item) => Number(item.id))
    .sort((a, b) => a - b);
  const explicitlyNotRefinable = items
    .filter((item) => item.isRefinable === false)
    .map((item) => Number(item.id))
    .sort((a, b) => a - b);
  const unknown = items.filter((item) => item.isRefinable === undefined).length;

  return { refinable, explicitlyNotRefinable, unknownCount: unknown };
}

function buildClassFilter(items: RawItem[]) {
  const equipable = items.filter((item) => {
    const itemTypeId = Number(item.itemTypeId ?? 0);
    return (
      itemTypeId === ItemTypeId.WEAPON ||
      itemTypeId === ItemTypeId.ARMOR ||
      itemTypeId === 9 ||
      itemTypeId === 10
    );
  });

  return Object.fromEntries(
    CLASS_FILTER_SAMPLE.map((sample) => {
      const tokens = [
        sample.className,
        "all",
        "All",
        "Every Job",
        ...broadClassTokens(sample.generation),
      ];
      const usable = equipable
        .filter((item) => {
          const usableClass = item.usableClass ?? [];
          const unusableClass = item.unusableClass ?? [];
          if (unusableClass.includes(sample.className)) return false;
          if (usableClass.length === 0) return true;
          return tokens.some((token) => usableClass.includes(token));
        })
        .map((item) => Number(item.id))
        .sort((a, b) => a - b);

      return [sample.className, { classId: sample.classId, usable }];
    }),
  );
}

async function buildEnchantGroups() {
  const enchantTablePath = resolve(
    legacyRoot,
    "src",
    "app",
    "constants",
    "enchant_item",
    "_enchant_table.ts",
  );
  const { EnchantTable } = (await import(
    `file://${enchantTablePath.replaceAll("\\", "/")}`
  )) as {
    EnchantTable: Array<{
      name: string;
      enchants: [null | string[], string[], string[], string[]];
    }>;
  };

  const groupCountByAegisName: Record<string, number> = {};
  for (const entry of EnchantTable) {
    groupCountByAegisName[entry.name] = entry.enchants.filter(
      (group) => Array.isArray(group) && group.length > 0,
    ).length;
  }

  const overThreeGroups = Object.entries(groupCountByAegisName)
    .filter(([, count]) => count > 3)
    .map(([aegisName, count]) => ({ aegisName, count }))
    .sort((a, b) => a.aegisName.localeCompare(b.aegisName));

  return { groupCountByAegisName, overThreeGroups };
}

// --- entry point ----------------------------------------------------------

async function main() {
  const raw = JSON.parse(
    await readFile(resolve(legacyDataRoot, "item.json"), "utf8"),
  ) as Record<string, RawItem>;
  const items = Object.values(raw);

  const header = {
    generatedBy: "scripts/build-parity-fixtures.ts",
    generatedAt: new Date().toISOString(),
    source: {
      repository: "tong-calc-ro",
      commit: readLegacyCommit(),
      itemCount: items.length,
    },
  };

  const slotItemLists = buildSlotItemLists(items);
  const cardLists = buildCardLists(items);
  const enchantGroups = await buildEnchantGroups();

  const fixtures: Record<string, unknown> = {
    "slot-item-lists.json": { ...header, lists: slotItemLists },
    "weapon-list.json": { ...header, ids: slotItemLists.weapon },
    "left-weapon-list.json": { ...header, ids: slotItemLists.leftWeapon },
    "ammo-list.json": { ...header, ids: slotItemLists.ammo },
    "card-lists.json": { ...header, lists: cardLists },
    "weapon-capabilities.json": { ...header, ...buildWeaponCapabilities(items) },
    "refinable.json": { ...header, ...buildRefinable(items) },
    "gradable.json": { ...header, ...buildGradable(items) },
    "class-filter.json": { ...header, classes: buildClassFilter(items) },
    "enchant-groups.json": { ...header, ...enchantGroups },
  };

  await mkdir(outputRoot, { recursive: true });
  for (const [fileName, content] of Object.entries(fixtures)) {
    await writeFile(
      resolve(outputRoot, fileName),
      `${JSON.stringify(content, null, 2)}\n`,
      "utf8",
    );
  }

  console.log(`parity fixtures written to ${outputRoot}`);
  console.log(`  source commit      ${header.source.commit}`);
  console.log(`  items              ${items.length}`);
  console.log(`  weapon             ${slotItemLists.weapon.length}`);
  console.log(`  leftWeapon         ${slotItemLists.leftWeapon.length}`);
  console.log(`  ammo               ${slotItemLists.ammo.length}`);
  console.log(`  accLeft            ${slotItemLists.accLeft.length}`);
  console.log(`  cards (weapon)     ${cardLists.weapon.length}`);
  console.log(
    `  enchant groups > 3 ${enchantGroups.overThreeGroups.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
