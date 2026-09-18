/**
 * Item search: the cheap half of finding gear for a build.
 *
 * This narrows the 6,490-item catalog down to what a class can actually wear in
 * one slot, using only the search index that is already loaded for the
 * calculator. It never touches the damage engine, so it stays fast enough to
 * run on every keystroke.
 *
 * The slot and class rules deliberately match `itemOptionsForSlot` in the
 * calculator's equipment panel: a tool that offered items the calculator would
 * refuse would be worse than no tool at all.
 *
 * Ranking by actual damage is the expensive half, and lives in
 * `slot-evaluator.ts`.
 */

import type { CatalogSearchItem } from "@/lib/catalog/types";
import { resolveWeaponCapabilities } from "@/lib/equipment/catalog-rules";
import { itemMatchesClass } from "@/lib/equipment/class-compatibility";
import type { EquipmentSlot } from "@/lib/equipment/types";

export interface ItemSearchFilters {
  /** The slot being filled. Required: it is what makes the result a shortlist. */
  slot: EquipmentSlot;
  /** Calculator class id, used for the legacy usableClass/unusableClass rules. */
  classId: number;
  /** Matched against the prebuilt `searchable` text (id, names, type). */
  keyword?: string;
  /** Drops items the character could not equip yet. */
  maxRequiredLevel?: number;
  /** Minimum card slots, for builds that depend on a carded piece. */
  minCardSlots?: number;
  /** Keeps only items that can be refined. */
  refinableOnly?: boolean;
  /** Ammo slot only: restricts to the subtype the equipped weapon consumes. */
  ammoSubTypeId?: number | null;
}

export type ItemSearchSort = "name" | "requiredLevel" | "cardSlots";

export interface ItemSearchParams extends ItemSearchFilters {
  sort?: ItemSearchSort;
  /** Caps the result, so a slot with hundreds of matches stays cheap to render. */
  limit?: number;
}

export interface ItemSearchResult {
  items: CatalogSearchItem[];
  /** How many matched before `limit` was applied. */
  matched: number;
  /** Detail chunks the caller must load to evaluate these items. */
  categories: string[];
}

/**
 * Splits on whitespace and requires every term, so "shadow katar" narrows
 * rather than widening the way a single OR match would.
 */
function matchesKeyword(item: CatalogSearchItem, keyword: string): boolean {
  const terms = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = `${item.searchable} ${item.name}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/** The off-hand is a weapon capability rather than an `equipSlots` membership. */
function fillsSlot(item: CatalogSearchItem, slot: EquipmentSlot): boolean {
  if (slot === "leftWeapon") {
    return resolveWeaponCapabilities(item).canEquipLeftWeapon;
  }
  return item.equipSlots.includes(slot);
}

export function filterItemsForSlot(
  items: CatalogSearchItem[],
  filters: ItemSearchFilters,
): CatalogSearchItem[] {
  const {
    slot,
    classId,
    keyword,
    maxRequiredLevel,
    minCardSlots,
    refinableOnly,
    ammoSubTypeId,
  } = filters;

  return items.filter((item) => {
    if (!fillsSlot(item, slot)) return false;

    // Ammo is matched to the weapon rather than to the class, exactly as the
    // calculator does it.
    if (slot === "ammo") {
      if (ammoSubTypeId != null && item.itemSubTypeId !== ammoSubTypeId) {
        return false;
      }
    } else if (!itemMatchesClass(item, classId)) {
      return false;
    }

    if (refinableOnly && !item.isRefinable) return false;
    if (minCardSlots != null && item.slots < minCardSlots) return false;
    if (
      maxRequiredLevel != null &&
      item.requiredLevel != null &&
      item.requiredLevel > maxRequiredLevel
    ) {
      return false;
    }
    if (keyword && !matchesKeyword(item, keyword)) return false;

    return true;
  });
}

function compare(sort: ItemSearchSort) {
  return (left: CatalogSearchItem, right: CatalogSearchItem): number => {
    if (sort === "requiredLevel") {
      return (left.requiredLevel ?? 0) - (right.requiredLevel ?? 0);
    }
    if (sort === "cardSlots") {
      // Most slots first: that is the reason to sort by it at all.
      return right.slots - left.slots;
    }
    return left.name.localeCompare(right.name, "en");
  };
}

export function searchItems(
  items: CatalogSearchItem[],
  params: ItemSearchParams,
): ItemSearchResult {
  const matched = filterItemsForSlot(items, params);
  const sorted = matched.slice().sort(compare(params.sort ?? "name"));
  const limited =
    params.limit != null ? sorted.slice(0, params.limit) : sorted;

  return {
    items: limited,
    matched: matched.length,
    // Evaluating these needs their detail chunks; naming them up front lets the
    // caller see how much data a run will pull before it starts.
    categories: [...new Set(limited.map((item) => item.category))],
  };
}
