/**
 * Class/item compatibility, shared by the calculator, the knowledge dashboard and
 * the parity tests. Ports the legacy `usableClass` / `unusableClass` filtering so
 * there is exactly one place the rule lives.
 */
import { CALCULATOR_CLASSES } from "@/lib/calculator/metadata";
import type { CatalogSearchItem } from "@/lib/catalog/types";

/** The legacy `ClassName` key that usableClass/unusableClass entries are written against. */
export function classToken(name: string): string {
  return name.replace(/\s+/g, "");
}

/** Same token, resolved from a calculator class id. Returns null for unknown ids. */
export function legacyClassToken(classId: number): string | null {
  const selectedClass = CALCULATOR_CLASSES.find((entry) => entry.id === classId);
  return selectedClass ? classToken(selectedClass.name) : null;
}

export function broadClassTokens(generation: 3 | 4 | "expanded"): string[] {
  if (generation === 4) return ["Only 4th", "4th"];
  if (generation === 3) return ["Only 3rd Cls", "3rd"];
  return ["Expanded", "Only Expanded"];
}

/**
 * `unusableClass` wins over `usableClass`; an empty `usableClass` means every
 * class may equip the item.
 */
export function itemMatchesClass(
  item: Pick<CatalogSearchItem, "usableClass" | "unusableClass">,
  classId: number,
): boolean {
  const selectedClass = CALCULATOR_CLASSES.find((entry) => entry.id === classId);
  if (!selectedClass) return true;

  const usableClass = item.usableClass ?? [];
  const unusableClass = item.unusableClass ?? [];
  const token = classToken(selectedClass.name);
  if (unusableClass.includes(token)) return false;
  if (usableClass.length === 0) return true;

  return [
    token,
    "all",
    "All",
    "Every Job",
    ...broadClassTokens(selectedClass.generation),
  ].some((entry) => usableClass.includes(entry));
}

/**
 * Drops every equipped item the new class cannot wear, and reports what was
 * removed so the UI can tell the user instead of silently clearing slots.
 */
export function sanitizeEquipmentForClass<
  TSelection extends { itemId?: number },
>(
  equipment: Partial<Record<string, TSelection>>,
  classId: number,
  itemById: Map<number, Pick<CatalogSearchItem, "usableClass" | "unusableClass" | "name">>,
): {
  equipment: Partial<Record<string, TSelection>>;
  removed: Array<{ slot: string; itemId: number; name: string }>;
} {
  const removed: Array<{ slot: string; itemId: number; name: string }> = [];
  const next: Partial<Record<string, TSelection>> = {};

  for (const [slot, selection] of Object.entries(equipment)) {
    if (!selection?.itemId) {
      if (selection) next[slot] = selection;
      continue;
    }
    const item = itemById.get(selection.itemId);
    if (item && !itemMatchesClass(item, classId)) {
      removed.push({
        slot,
        itemId: selection.itemId,
        name: item.name ?? String(selection.itemId),
      });
      continue;
    }
    next[slot] = selection;
  }

  return { equipment: next, removed };
}
