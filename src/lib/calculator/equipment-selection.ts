import type {
  CatalogItemOptions,
  CatalogOptionGroup,
  CatalogSearchItem,
} from "@/lib/catalog/types";
import {
  resolveCardSlotCount,
  resolveRandomOptionCount,
} from "@/lib/equipment/catalog-rules";
import {
  EQUIPMENT_SLOT_RULES,
  type EquipmentSlot,
} from "@/lib/equipment/types";
import type { SavedEquipmentSelection } from "@/lib/knowledge/types";

export interface CalculatorSelectionTemplate {
  cardCount: number;
  enchantGroups: CatalogOptionGroup[];
  randomOptionCount: number;
}

export function getCalculatorSelectionTemplate(
  item: CatalogSearchItem,
  slot: EquipmentSlot,
  optionRecord: CatalogItemOptions | undefined,
): CalculatorSelectionTemplate {
  return {
    cardCount: resolveCardSlotCount(
      item,
      EQUIPMENT_SLOT_RULES[slot].maxCards,
    ),
    enchantGroups: optionRecord?.groups ?? [],
    randomOptionCount: resolveRandomOptionCount(
      item.itemTypeId,
      item.equipSlots,
      optionRecord?.randomOptionCount ?? 0,
    ),
  };
}

export function createBlankEquipmentSelection(
  item: CatalogSearchItem,
  slot: EquipmentSlot,
  optionRecord: CatalogItemOptions | undefined,
): SavedEquipmentSelection {
  const template = getCalculatorSelectionTemplate(item, slot, optionRecord);
  return {
    itemId: item.id,
    refine: 0,
    cardIds: Array.from({ length: template.cardCount }, () => 0),
    enchantIds: [],
    randomOptions: [],
  };
}

export function enchantChoiceKeyFromItemId(
  group: CatalogOptionGroup,
  itemId: number | undefined,
): string {
  if (!itemId) return "";
  return group.choices.find((choice) => choice.itemId === itemId)?.key ?? "";
}

export function enchantItemIdFromChoiceKey(
  group: CatalogOptionGroup,
  choiceKey: string,
): number {
  return group.choices.find((choice) => choice.key === choiceKey)?.itemId ?? 0;
}

export function updateEnchantSelectionByChoiceKey(
  selection: SavedEquipmentSelection,
  group: CatalogOptionGroup,
  choiceKey: string,
): SavedEquipmentSelection {
  const nextEnchantIds = [...(selection.enchantIds ?? [])];
  nextEnchantIds[group.slot] = enchantItemIdFromChoiceKey(group, choiceKey);
  return {
    ...selection,
    enchantIds: nextEnchantIds,
  };
}
