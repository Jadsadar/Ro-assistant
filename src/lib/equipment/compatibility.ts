import type { CatalogSearchItem } from "@/lib/catalog/types";
import type { ItemVariant } from "@/lib/knowledge/types";
import {
  cardPositionsForSlot,
  type EquipmentSlot,
} from "@/lib/equipment/types";

export function isVariantCompatibleWithSlot(
  variant: ItemVariant,
  item: CatalogSearchItem | undefined,
  slot: EquipmentSlot,
  itemById: ReadonlyMap<number, CatalogSearchItem>,
): boolean {
  if (!item?.equipSlots.includes(slot)) return false;

  const allowedCardPositions = new Set<number>(cardPositionsForSlot(slot));
  return variant.cards.every((slottedCard) => {
    const card = itemById.get(slottedCard.itemId);
    return (
      card?.itemTypeId === 6 &&
      card.compositionPos !== null &&
      allowedCardPositions.has(card.compositionPos)
    );
  });
}
