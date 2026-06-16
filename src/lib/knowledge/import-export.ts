import type { KnowledgeSnapshot } from "@/lib/knowledge/types";
import { ATTACK_ELEMENTS } from "@/lib/calculator/metadata";
import {
  EQUIPMENT_SLOTS,
  ITEM_GRADES,
  SERVER_IDS,
} from "@/lib/equipment/types";

export const KNOWLEDGE_FORMAT = "ro-assistant-kb";
export const KNOWLEDGE_SCHEMA_VERSION = 3;

export interface KnowledgeBaseExport {
  format: typeof KNOWLEDGE_FORMAT;
  schemaVersion: typeof KNOWLEDGE_SCHEMA_VERSION;
  exportedAt: string;
  catalogVersion: string;
  data: KnowledgeSnapshot;
}

export function createKnowledgeExport(
  data: KnowledgeSnapshot,
  catalogVersion: string,
): KnowledgeBaseExport {
  return {
    format: KNOWLEDGE_FORMAT,
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    catalogVersion,
    data,
  };
}

export function parseKnowledgeExport(raw: string): KnowledgeBaseExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("ไฟล์ไม่ใช่ JSON ที่ถูกต้อง");
  }

  if (!isRecord(parsed)) {
    throw new Error("โครงสร้างไฟล์ Knowledge Base ไม่ถูกต้อง");
  }
  assertNoDangerousKeys(parsed);
  if (parsed.format !== KNOWLEDGE_FORMAT) {
    throw new Error(`ไม่รองรับ format: ${String(parsed.format ?? "unknown")}`);
  }
  if (parsed.schemaVersion !== KNOWLEDGE_SCHEMA_VERSION) {
    throw new Error(
      `ไม่รองรับ schema version: ${String(parsed.schemaVersion ?? "unknown")}`,
    );
  }
  if (!isRecord(parsed.data)) {
    throw new Error("ไม่พบ data ในไฟล์ Knowledge Base");
  }

  const requiredArrays = [
    "itemVariants",
    "priceQuotes",
    "tags",
    "variantTags",
    "ownedItems",
    "savedBuilds",
  ] as const;
  for (const key of requiredArrays) {
    if (!Array.isArray(parsed.data[key])) {
      throw new Error(`data.${key} ต้องเป็น array`);
    }
  }
  validateCalculatorReferences(parsed.data);

  return parsed as unknown as KnowledgeBaseExport;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNoDangerousKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoDangerousKeys);
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (key === "__proto__" || key === "prototype" || key === "constructor") {
      throw new Error(`พบ key ที่ไม่อนุญาตในไฟล์ import: ${key}`);
    }
    assertNoDangerousKeys(child);
  }
}

function validateCalculatorReferences(
  data: Record<string, unknown>,
): void {
  for (const [index, value] of (data.itemVariants as unknown[]).entries()) {
    if (!isRecord(value) || !Number.isInteger(value.itemId)) {
      throw new Error(`data.itemVariants[${index}].itemId ไม่ถูกต้อง`);
    }
    if (
      value.grade !== undefined &&
      !ITEM_GRADES.includes(value.grade as (typeof ITEM_GRADES)[number])
    ) {
      throw new Error(`data.itemVariants[${index}].grade ไม่ถูกต้อง`);
    }
    if (!Array.isArray(value.cards)) {
      throw new Error(`data.itemVariants[${index}].cards ต้องเป็น array`);
    }
    value.cards.forEach((card, cardIndex) => {
      if (
        !isRecord(card) ||
        !Number.isInteger(card.slot) ||
        !Number.isInteger(card.itemId)
      ) {
        throw new Error(
          `data.itemVariants[${index}].cards[${cardIndex}] ไม่ถูกต้อง`,
        );
      }
    });
  }

  for (const [index, value] of (data.priceQuotes as unknown[]).entries()) {
    if (
      !isRecord(value) ||
      !SERVER_IDS.includes(value.server as (typeof SERVER_IDS)[number])
    ) {
      throw new Error(
        `data.priceQuotes[${index}].server ต้องเป็น thor หรือ chaos`,
      );
    }
  }

  const equipmentSlots = new Set<string>(EQUIPMENT_SLOTS);
  for (const [index, value] of (data.savedBuilds as unknown[]).entries()) {
    if (
      !isRecord(value) ||
      !Number.isInteger(value.classId) ||
      !Number.isInteger(value.baseLevel) ||
      !Number.isInteger(value.jobLevel) ||
      typeof value.skillId !== "string" ||
      !Number.isInteger(value.skillLevel) ||
      !Number.isInteger(value.monsterId) ||
      !SERVER_IDS.includes(value.server as (typeof SERVER_IDS)[number]) ||
      !ATTACK_ELEMENTS.includes(
        value.propertyAtk as (typeof ATTACK_ELEMENTS)[number],
      ) ||
      !isRecord(value.equipment) ||
      !isRecord(value.stats) ||
      !isRecord(value.skillLevels) ||
      !isRecord(value.buffLevels) ||
      !Array.isArray(value.consumableIds)
    ) {
      throw new Error(`data.savedBuilds[${index}] ไม่ตรงกับ schema`);
    }
    for (const [slot, selection] of Object.entries(value.equipment)) {
      const isSavedEquipmentSelection =
        isRecord(selection) &&
        (selection.itemId === undefined ||
          Number.isInteger(selection.itemId)) &&
        (selection.cardIds === undefined ||
          (Array.isArray(selection.cardIds) &&
            selection.cardIds.every((cardId) => Number.isInteger(cardId))));
      if (
        !equipmentSlots.has(slot) ||
        (selection !== null &&
          typeof selection !== "string" &&
          !isSavedEquipmentSelection)
      ) {
        throw new Error(
          `data.savedBuilds[${index}].equipment.${slot} ไม่ถูกต้อง`,
        );
      }
    }
  }
}
