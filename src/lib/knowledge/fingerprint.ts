import type {
  ItemOption,
  ItemVariant,
  SlottedItem,
} from "@/lib/knowledge/types";

function cardToken(card: SlottedItem): string {
  return `${card.slot}:${card.itemId}`;
}

function optionToken(option: ItemOption): string {
  return [
    option.slot ?? "",
    option.key.trim().toLocaleLowerCase("en"),
    option.itemId ?? "",
    option.value ?? "",
    option.unit ?? "",
    option.label.trim().toLocaleLowerCase("th"),
  ].join(":");
}

export function createVariantFingerprint(
  variant: Pick<
    ItemVariant,
    "itemId" | "refine" | "grade" | "cards" | "enchants" | "randomOptions"
  >,
): string {
  const cards = [...variant.cards].map(cardToken).sort().join(",");
  const enchants = [...variant.enchants].map(optionToken).sort().join(",");
  const options = [...variant.randomOptions]
    .map(optionToken)
    .sort()
    .join(",");

  return [
    variant.itemId,
    variant.refine,
    variant.grade ?? "",
    `cards:${cards}`,
    `enchants:${enchants}`,
    `options:${options}`,
  ].join("|");
}
