import {
  loadCatalogItemDetail,
} from "@/lib/catalog/client";
import type { CatalogItemDetail } from "@/lib/catalog/types";
import type {
  DamageCalculationInput,
  DamageEquipmentSelection,
} from "@/lib/calculator/damage-engine";
import { validateCalculatorSelection } from "@/lib/calculator/validate-selection";
import {
  getLegacyRandomOptionTree,
  resolveRandomOptionPath,
} from "@/lib/equipment/random-options";
import type {
  CalculatorV2Data,
  CalculatorV2Selection,
  EquipmentSlotSelection,
} from "./types";

const CONSUMABLE_ITEM_IDS: Record<string, number> = {
  "Arunafeltz Desert Sandwich": 12321,
  "Full SwingK": 12418,
  "Mana +": 12419,
  "HP Increase Potion(Large)": 12424,
  "Greater Agimat of Ancient Spirit": 12775,
  "Battle Pill": 12791,
  "Suprem Battle Pill": 12792,
  "Red Booster": 12796,
  Almighty: 12883,
  Abrasive: 14536,
  "Blessing Of Tyr": 14601,
  "Power Booster": 14766,
  "Unlimited Drink": 23475,
  "Red Herb Activator": 100232,
  "Blue Herb Activator": 100233,
  "Force Booster": 102803,
  "Str 10": 14854,
  "Str 15": 14616,
  "Str 20": 12429,
  "Agi 10": 14853,
  "Agi 15": 14618,
  "Agi 20": 12433,
  "Vit 10": 14849,
  "Vit 15": 14617,
  "Vit 20": 12431,
  "Int 10": 14852,
  "Int 15": 14619,
  "Int 20": 12430,
  "Dex 10": 14851,
  "Dex 15": 14620,
  "Dex 20": 12432,
  "Luk 10": 14850,
  "Luk 15": 14621,
  "Luk 20": 12434,
  "Concentration Potion": 645,
  "Awakening Potion": 656,
  "Berserk Potion": 657,
  "Enrich Celermine": 12437,
  "ASPD Potion": 12684,
};

const EXCLUSIVE_BUFF_GROUPS = [
  ["Str 20", "Str 15", "Str 10"],
  ["Agi 20", "Agi 15", "Agi 10"],
  ["Vit 20", "Vit 15", "Vit 10"],
  ["Int 20", "Int 15", "Int 10"],
  ["Dex 20", "Dex 15", "Dex 10"],
  ["Luk 20", "Luk 15", "Luk 10"],
  ["Berserk Potion", "Awakening Potion", "Concentration Potion"],
  ["Suprem Battle Pill", "Battle Pill"],
] as const;

function resolveConsumableItemIds(activeBuffs: string[]): number[] {
  const active = new Set(activeBuffs);
  const exclusiveNames = new Set(EXCLUSIVE_BUFF_GROUPS.flat());
  const resolvedNames = activeBuffs.filter(
    (name) => !exclusiveNames.has(name as (typeof EXCLUSIVE_BUFF_GROUPS)[number][number]),
  );

  for (const group of EXCLUSIVE_BUFF_GROUPS) {
    const strongestActiveBuff = group.find((name) => active.has(name));
    if (strongestActiveBuff) resolvedNames.push(strongestActiveBuff);
  }

  return [...new Set(resolvedNames)]
    .map((name) => CONSUMABLE_ITEM_IDS[name])
    .filter((itemId): itemId is number => itemId !== undefined);
}

export function resolveEnchantIds(
  data: CalculatorV2Data,
  selection: EquipmentSlotSelection,
): Array<number | undefined> {
  if (!selection.itemId) return [];
  const enchantIds: Array<number | undefined> = [];
  const groups = data.options[selection.itemId]?.groups ?? [];

  for (const group of groups) {
    const optionKey = selection.optionKeys[group.slot];
    if (!optionKey) continue;
    enchantIds[group.slot] = group.choices.find(
      (choice) => choice.key === optionKey,
    )?.itemId;
  }

  return enchantIds;
}

/**
 * Legacy `getOptionScripts()` (ro-calculator.component.ts:2247) turned each raw
 * "attr:value" option string into `{ [attr]: value }`. The cascade leaf node
 * value uses exactly that format.
 */
export function resolveExtraOptionScripts(
  selection: CalculatorV2Selection,
): Array<Record<string, unknown[]>> {
  const tree = getLegacyRandomOptionTree();
  const scripts: Array<Record<string, unknown[]>> = [];

  for (const equipment of Object.values(selection.equipment)) {
    for (const path of equipment?.randomOptionPaths ?? []) {
      if (!path?.length) continue;
      const node = resolveRandomOptionPath(tree, path);
      if (!node) continue;

      const separator = node.value.lastIndexOf(":");
      if (separator < 0) continue;
      const attribute = node.value.slice(0, separator);
      const value = Number(node.value.slice(separator + 1));
      if (!attribute || !Number.isFinite(value)) continue;

      scripts.push({ [attribute]: value } as unknown as Record<string, unknown[]>);
    }
  }

  return scripts;
}

function toDamageEquipment(
  data: CalculatorV2Data,
  selection: CalculatorV2Selection,
): DamageCalculationInput["equipment"] {
  return Object.fromEntries(
    Object.entries(selection.equipment).flatMap(([slot, equipment]) => {
      if (!equipment?.itemId) return [];
      const resolved: DamageEquipmentSelection = {
        itemId: equipment.itemId,
        refine: equipment.refine,
        grade: equipment.grade,
        cardIds: equipment.cardIds.filter(Boolean),
        enchantIds: resolveEnchantIds(data, equipment),
      };
      return [[slot, resolved]];
    }),
  );
}

function collectItemIds(
  equipment: DamageCalculationInput["equipment"],
): number[] {
  const ids = new Set<number>();
  for (const selection of Object.values(equipment)) {
    if (!selection) continue;
    ids.add(selection.itemId);
    selection.cardIds.forEach((itemId) => ids.add(itemId));
    selection.enchantIds.forEach((itemId) => {
      if (itemId) ids.add(itemId);
    });
  }
  return [...ids];
}

async function loadSelectedItemDetails(
  data: CalculatorV2Data,
  itemIds: number[],
): Promise<CatalogItemDetail[]> {
  const itemById = new Map(data.items.map((item) => [item.id, item]));
  const details = await Promise.all(
    itemIds.map(async (itemId) => {
      const item = itemById.get(itemId);
      return item ? loadCatalogItemDetail(item) : null;
    }),
  );
  return details.filter((detail): detail is CatalogItemDetail => detail !== null);
}

export async function createDamageCalculationInput(
  data: CalculatorV2Data,
  selection: CalculatorV2Selection,
): Promise<DamageCalculationInput> {
  const monster = data.monsters.find(
    (entry) => entry.id === selection.monsterId,
  );
  if (!monster) throw new Error("กรุณาเลือกมอนสเตอร์เป้าหมาย");
  if (!selection.skillId) throw new Error("กรุณาเลือกสกิลโจมตี");

  // Never hand the engine a build the legacy rules would not have allowed.
  const validation = validateCalculatorSelection({
    classId: selection.classId,
    equipment: selection.equipment,
    items: data.items,
    options: data.options,
  });
  if (validation.errors.length > 0) {
    throw new Error(
      `อุปกรณ์ไม่ถูกต้อง: ${validation.errors.map((issue) => issue.message).join(" / ")}`,
    );
  }

  const equipment = toDamageEquipment(data, selection);
  const consumableItemIds = resolveConsumableItemIds(selection.activeBuffs);
  const items = await loadSelectedItemDetails(
    data,
    [...collectItemIds(equipment), ...consumableItemIds],
  );

  return {
    classId: selection.classId,
    baseLevel: selection.baseLevel,
    jobLevel: selection.jobLevel,
    skillValue: selection.skillId,
    activeSkillValues: selection.activeSkillLevels,
    passiveSkillValues: selection.passiveSkillLevels,
    extraOptionScripts: resolveExtraOptionScripts(selection),
    attackElement: selection.attackElement,
    stats: selection.stats,
    monster,
    items,
    equipment,
    hpSpTable: data.hpSpTable,
    consumableItemIds,
  };
}
