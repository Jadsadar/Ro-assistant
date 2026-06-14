import type { KnowledgeSnapshot } from "@/lib/knowledge/types";

export const KNOWLEDGE_FORMAT = "ro-assistant-kb";
export const KNOWLEDGE_SCHEMA_VERSION = 1;

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
