import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  CatalogAsset,
  CatalogItemOptions,
  CatalogOptionGroup,
  CatalogItemOptionsIndex,
  CatalogItemDetail,
  CatalogManifest,
  CatalogSearchItem,
} from "../src/lib/catalog/types";
import {
  resolveEquipmentSlots,
  resolveRandomOptionCount,
} from "../src/lib/equipment/catalog-rules";
import { EQUIPMENT_SLOT_RULES } from "../src/lib/equipment/types";

interface RawItem {
  id: number;
  aegisName?: string;
  name?: string;
  unidName?: string;
  resName?: string;
  description?: string;
  slots?: number;
  itemTypeId?: number;
  itemSubTypeId?: number;
  itemLevel?: number | null;
  attack?: number | null;
  propertyAtk?: number | null;
  defense?: number | null;
  weight?: number;
  requiredLevel?: number | null;
  location?: string | null;
  compositionPos?: number | null;
  usableClass?: string[];
  unusableClass?: string[];
  canGrade?: boolean;
  isRefinable?: boolean;
  script?: Record<string, unknown[]>;
}

type LegacyEnchantGroup = [null | string[], string[], string[], string[]];
type LegacyEnchantEntry = { name: string; enchants: LegacyEnchantGroup };

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const legacyRoot = resolve(
  projectRoot,
  process.env.RO_LEGACY_ROOT ?? "tong-calc-ro",
);
const outputRoot = resolve(projectRoot, "public", "data");
const manifestPath = resolve(outputRoot, "catalog-manifest.json");

const sources = {
  items: resolve(legacyRoot, "item.json"),
  monsters: resolve(legacyRoot, "monster.json"),
  hpSpTable: resolve(
    legacyRoot,
    "src",
    "assets",
    "demo",
    "data",
    "hp_sp_table.json",
  ),
  enchantTable: resolve(
    legacyRoot,
    "src",
    "app",
    "constants",
    "enchant_item",
    "_enchant_table.ts",
  ),
  extraOptionTable: resolve(
    legacyRoot,
    "src",
    "app",
    "constants",
    "extra-option-table.ts",
  ),
};

function assertSafeOutputPath(): void {
  const projectPrefix = `${projectRoot}${sep}`;
  if (!outputRoot.startsWith(projectPrefix) || basename(outputRoot) !== "data") {
    throw new Error(`Refusing to replace unsafe output path: ${outputRoot}`);
  }
}

async function hasAllCatalogSources(): Promise<boolean> {
  try {
    await Promise.all(Object.values(sources).map((path) => access(path)));
    return true;
  } catch {
    return false;
  }
}

async function canUseExistingCatalog(): Promise<boolean> {
  try {
    await access(manifestPath);
    return true;
  } catch {
    return false;
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("th")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeSlotLabel(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  const lower = normalized.toLocaleLowerCase("en");
  if (lower.includes("accessory") && lower.includes("left")) return "Accessory Left";
  if (lower.includes("accessory") && lower.includes("right")) return "Accessory Right";
  if (lower.includes("accessory")) return "Accessory";
  if (lower.includes("footwear") || lower.includes("shoes")) return "Shoes";
  if (lower.includes("garment")) return "Garment";
  if (lower.includes("shield")) return "Shield";
  if (lower.includes("armor")) return "Armor";
  if (lower.includes("upper")) return "Upper";
  if (lower.includes("middle")) return "Middle";
  if (lower.includes("lower")) return "Lower";
  if (
    lower.includes("sword") ||
    lower.includes("dagger") ||
    lower.includes("rod") ||
    lower.includes("staff") ||
    lower.includes("spear") ||
    lower.includes("axe") ||
    lower.includes("mace") ||
    lower.includes("bow") ||
    lower.includes("gun") ||
    lower.includes("rifle") ||
    lower.includes("revolver") ||
    lower.includes("shotgun") ||
    lower.includes("gatling") ||
    lower.includes("grenade") ||
    lower.includes("katar") ||
    lower.includes("knuckle") ||
    lower.includes("book") ||
    lower.includes("instrument") ||
    lower.includes("whip") ||
    lower.includes("huuma")
  ) {
    return "Weapon";
  }

  return normalized;
}

function extractHighlightedDescriptionValue(
  description: string | undefined,
  keys: string[],
): string | null {
  if (!description) return null;

  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = description.match(
      new RegExp(`${escaped}\\s*:\\s*\\^777777([^\\^\\n]+)\\^000000`, "i"),
    );
    const value = normalizeSlotLabel(match?.[1] ?? "");
    if (value) return value;
  }

  return null;
}

function resolveBaseSlot(item: RawItem): string | null {
  if ((item.itemTypeId ?? 0) === 1) return "Weapon";

  const candidates = [
    item.location,
    extractHighlightedDescriptionValue(item.description, ["ตำแหน่ง", "Position"]),
    extractHighlightedDescriptionValue(item.description, ["ประเภท", "Type"]),
    item.unidName,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSlotLabel(candidate ?? "");
    if (normalized) return normalized;
  }

  return null;
}

function resolvedSlot(item: RawItem): string | null {
  const baseSlot = resolveBaseSlot(item);
  if (!baseSlot) return item.itemTypeId === 10 ? "Shadow Equipment" : null;
  if (item.itemTypeId === 10) return `Shadow ${baseSlot}`;
  return baseSlot;
}

function itemTypeLabel(item: RawItem): string {
  const slot = resolvedSlot(item);
  if (slot) return slot;

  const itemTypeId = Number(item.itemTypeId ?? 0);
  const labels: Record<number, string> = {
    2: "Armor",
    3: "Ammo",
    4: "Consumable",
    6: "Card",
    9: "Costume",
    10: "Shadow Equipment",
    11: "Enchant",
    3333: "Consumable",
  };
  return labels[itemTypeId] ?? "Other";
}

function itemCategory(item: RawItem): string {
  const baseSlot = resolveBaseSlot(item);
  if (item.itemTypeId === 6) return "cards";
  if (item.itemTypeId === 11) return "enchants";
  if (item.itemTypeId === 10) return "shadow-equipment";
  if (baseSlot === "Weapon") return "equipment-weapon";
  if (["Armor", "Shield", "Garment", "Shoes"].includes(baseSlot ?? "")) {
    return "equipment-armor";
  }
  if (["Upper", "Middle", "Lower"].includes(baseSlot ?? "")) {
    return "equipment-head";
  }
  if ((baseSlot ?? "").startsWith("Accessory")) {
    return "equipment-accessory";
  }
  if ([4, 3333].includes(item.itemTypeId ?? -1)) return "consumables";
  return "misc";
}

function toSearchItem(item: RawItem): CatalogSearchItem {
  const id = Number(item.id);
  const name = item.name?.trim() || item.aegisName?.trim() || `Item ${id}`;
  const aegisName = item.aegisName?.trim() ?? "";
  const itemTypeId = Number(item.itemTypeId ?? 0);
  const itemSubTypeId = Number(item.itemSubTypeId ?? 0);
  const slot = resolvedSlot(item);
  const equipSlots = resolveEquipmentSlots({
    itemTypeId,
    itemSubTypeId,
    displaySlot: slot,
  });
  const itemType = itemTypeLabel(item);
  const category = itemCategory(item);
  const searchable = normalizeSearchText(
    [
      id,
      name,
      aegisName,
      item.unidName,
      item.resName,
      item.location,
      slot,
      itemType,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return {
    id,
    name,
    aegisName,
    itemTypeId,
    itemSubTypeId,
    itemType,
    slot,
    equipSlots,
    category,
    slots: Number(item.slots ?? 0),
    compositionPos: item.compositionPos ?? null,
    canGrade: item.canGrade === true,
    isRefinable:
      item.isRefinable ??
      equipSlots.some(
        (equipmentSlot) => EQUIPMENT_SLOT_RULES[equipmentSlot].allowsRefine,
      ),
    requiredLevel:
      item.requiredLevel === null || item.requiredLevel === undefined
        ? null
        : Number(item.requiredLevel),
    usableClass: item.usableClass,
    unusableClass: item.unusableClass,
    searchable,
  };
}

function optionLabelFromKey(
  optionKey: string,
  itemsByAegisName: Map<string, RawItem>,
): { itemId?: number; label: string } {
  const item = itemsByAegisName.get(optionKey);
  if (item) {
    return {
      itemId: Number(item.id),
      label: item.name?.trim() || item.aegisName?.trim() || optionKey,
    };
  }

  return {
    label: optionKey.replaceAll("_", " "),
  };
}

async function loadLegacyOptionSources(): Promise<{
  enchantTable: LegacyEnchantEntry[];
  extraOptionTable: Record<string, number>;
}> {
  const enchantModulePath = pathToFileURL(sources.enchantTable).href;
  const extraOptionModulePath = pathToFileURL(sources.extraOptionTable).href;
  const [{ EnchantTable: enchantTable }, { ExtraOptionTable: extraOptionTable }] =
    await Promise.all([
      import(enchantModulePath) as Promise<{ EnchantTable: LegacyEnchantEntry[] }>,
      import(extraOptionModulePath) as Promise<{
        ExtraOptionTable: Record<string, number>;
      }>,
    ]);

  return { enchantTable, extraOptionTable };
}

function buildItemOptionsIndexFromSources(
  items: RawItem[],
  {
    enchantTable,
    extraOptionTable,
  }: {
    enchantTable: LegacyEnchantEntry[];
    extraOptionTable: Record<string, number>;
  },
): CatalogItemOptionsIndex {
  const itemsByAegisName = new Map(
    items
      .filter((item) => item.aegisName)
      .map((item) => [item.aegisName as string, item]),
  );
  const enchantTableMap = new Map(
    enchantTable.map((entry) => [entry.name, entry.enchants as LegacyEnchantGroup]),
  );
  const result: CatalogItemOptionsIndex = {};

  for (const item of items) {
    const aegisName = item.aegisName?.trim();
    if (!aegisName) continue;

    const groups = (enchantTableMap.get(aegisName) ?? [])
      .map<CatalogOptionGroup | null>((choices, index) => {
        if (!choices?.length) return null;
        return {
          slot: index,
          label: `Enchant ${index + 1}`,
          choices: choices.map((choice) => {
            const resolved = optionLabelFromKey(choice, itemsByAegisName);
            return {
              key: choice,
              label: resolved.label,
              itemId: resolved.itemId,
            };
          }),
        };
      })
      .filter((group): group is CatalogOptionGroup => group !== null);
    const randomOptionCount = resolveRandomOptionCount(
      Number(item.itemTypeId ?? 0),
      resolveEquipmentSlots({
        itemTypeId: Number(item.itemTypeId ?? 0),
        itemSubTypeId: Number(item.itemSubTypeId ?? 0),
        displaySlot: resolvedSlot(item),
      }),
      extraOptionTable[aegisName] ?? 0,
    );

    if (groups.length === 0 && randomOptionCount === 0) continue;

    const record: CatalogItemOptions = {
      itemId: Number(item.id),
      aegisName,
      groups,
      randomOptionCount,
    };
    result[Number(item.id)] = record;
  }

  return result;
}

function toDetailItem(item: RawItem): CatalogItemDetail {
  return {
    ...toSearchItem(item),
    unidName: item.unidName ?? "",
    resName: item.resName ?? "",
    description: item.description ?? "",
    itemLevel: item.itemLevel ?? null,
    attack: item.attack ?? null,
    propertyAtk: item.propertyAtk ?? null,
    defense: item.defense ?? null,
    weight: Number(item.weight ?? 0),
    usableClass: item.usableClass,
    unusableClass: item.unusableClass,
    script: item.script ?? {},
  };
}

async function writeHashedJson(
  directory: string,
  id: string,
  records: unknown,
  recordCount: number,
): Promise<CatalogAsset> {
  const json = JSON.stringify(records);
  const digest = sha256(json);
  const filename = `${id}.${digest.slice(0, 12)}.json`;
  const absoluteDirectory = resolve(outputRoot, directory);
  const absolutePath = resolve(absoluteDirectory, filename);
  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(absolutePath, json, "utf8");

  return {
    id,
    url: `/${relative(resolve(projectRoot, "public"), absolutePath).replaceAll("\\", "/")}`,
    sha256: digest,
    recordCount,
    bytes: Buffer.byteLength(json),
  };
}

async function readJson<T>(path: string): Promise<{ raw: string; data: T }> {
  const raw = await readFile(path, "utf8");
  return { raw, data: JSON.parse(raw) as T };
}

async function main(): Promise<void> {
  assertSafeOutputPath();

  if (!(await hasAllCatalogSources())) {
    if (await canUseExistingCatalog()) {
      console.warn(
        `Legacy catalog source not found at ${legacyRoot}; using committed public/data assets.`,
      );
      return;
    }

    throw new Error(
      `Legacy catalog source not found at ${legacyRoot}, and no generated catalog manifest is available.`,
    );
  }

  const [itemSource, monsterSource, hpSpSource] = await Promise.all([
    readJson<Record<string, RawItem>>(sources.items),
    readJson<Record<string, unknown>>(sources.monsters),
    readJson<unknown[]>(sources.hpSpTable),
  ]);
  const legacyOptionSources = await loadLegacyOptionSources();

  const items = Object.values(itemSource.data)
    .filter((item) => Number.isFinite(Number(item.id)))
    .sort((left, right) => Number(left.id) - Number(right.id));
  const searchItems = items.map(toSearchItem);
  const itemOptionsIndex = buildItemOptionsIndexFromSources(
    items,
    legacyOptionSources,
  );
  const detailGroups = new Map<string, CatalogItemDetail[]>();

  for (const item of items) {
    const detail = toDetailItem(item);
    const group = detailGroups.get(detail.category) ?? [];
    group.push(detail);
    detailGroups.set(detail.category, group);
  }

  const sourceStats = await Promise.all(
    Object.values(sources).map((path) => stat(path)),
  );
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  const searchAsset = await writeHashedJson(
    "items",
    "search",
    searchItems,
    searchItems.length,
  );
  const itemOptions = await writeHashedJson(
    "",
    "item-options",
    itemOptionsIndex,
    Object.keys(itemOptionsIndex).length,
  );
  const chunks = await Promise.all(
    [...detailGroups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([category, records]) =>
        writeHashedJson("items", category, records, records.length),
      ),
  );
  const monsterRecords = Object.values(monsterSource.data);
  const monsters = await writeHashedJson(
    "",
    "monsters",
    monsterSource.data,
    monsterRecords.length,
  );
  const hpSpTable = await writeHashedJson(
    "",
    "hp-sp-table",
    hpSpSource.data,
    hpSpSource.data.length,
  );

  const catalogVersion = sha256(
    `${sha256(itemSource.raw)}:${sha256(monsterSource.raw)}:${sha256(hpSpSource.raw)}`,
  ).slice(0, 16);
  const manifest: CatalogManifest = {
    schemaVersion: 2,
    catalogVersion,
    generatedAt: new Date(
      Math.max(...sourceStats.map((sourceStat) => sourceStat.mtimeMs)),
    ).toISOString(),
    source: {
      itemCount: items.length,
      monsterCount: monsterRecords.length,
    },
    search: searchAsset,
    itemOptions,
    monsters,
    hpSpTable,
    chunks,
  };
  await writeFile(
    manifestPath,
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  const totalBytes = [
    searchAsset,
    itemOptions,
    monsters,
    hpSpTable,
    ...chunks,
  ].reduce((sum, asset) => sum + asset.bytes, 0);
  console.log(
    `Catalog ${catalogVersion}: ${items.length} items, ${monsterRecords.length} monsters, ${(totalBytes / 1_000_000).toFixed(2)} MB generated`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
