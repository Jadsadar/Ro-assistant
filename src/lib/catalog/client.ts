import type {
  CatalogItemDetail,
  CatalogItemOptionsIndex,
  CatalogClassSkills,
  CatalogManifest,
  CatalogMonster,
  CatalogSearchItem,
} from "@/lib/catalog/types";
import { resolveEquipmentSlots } from "@/lib/equipment/catalog-rules";
import { EQUIPMENT_SLOT_RULES } from "@/lib/equipment/types";

let manifestPromise: Promise<CatalogManifest> | null = null;
let searchPromise: Promise<CatalogSearchItem[]> | null = null;
let itemOptionsPromise: Promise<CatalogItemOptionsIndex> | null = null;
let monstersPromise: Promise<CatalogMonster[]> | null = null;
let skillsPromise: Promise<CatalogClassSkills[]> | null = null;
const itemDetailChunkPromises = new Map<string, Promise<CatalogItemDetail[]>>();

function publicAssetUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(publicAssetUrl(url));
  if (!response.ok) {
    throw new Error(`โหลดข้อมูลไม่สำเร็จ (${response.status}): ${url}`);
  }
  return response.json() as Promise<T>;
}

export function loadCatalogManifest(): Promise<CatalogManifest> {
  manifestPromise ??= fetchJson<CatalogManifest>("/data/catalog-manifest.json");
  return manifestPromise;
}

export async function loadCatalogSearch(): Promise<CatalogSearchItem[]> {
  searchPromise ??= loadCatalogManifest()
    .then((manifest) => fetchJson<CatalogSearchItem[]>(manifest.search.url))
    .then((items) =>
      items.map((item) => {
        const hasSubType = Number.isFinite(item.itemSubTypeId);
        const equipSlots = hasSubType
          ? resolveEquipmentSlots({
              itemTypeId: item.itemTypeId,
              itemSubTypeId: item.itemSubTypeId,
              displaySlot: item.slot,
            })
          : (item.equipSlots ?? []);
        return {
          ...item,
          itemSubTypeId: item.itemSubTypeId ?? 0,
          equipSlots,
          compositionPos: item.compositionPos ?? null,
          canGrade: item.canGrade === true,
          isRefinable:
            item.isRefinable === true ||
            equipSlots.some(
              (slot) => EQUIPMENT_SLOT_RULES[slot].allowsRefine,
            ),
        };
      }),
    );
  return searchPromise;
}

export async function loadCatalogItemOptions(): Promise<CatalogItemOptionsIndex> {
  itemOptionsPromise ??= loadCatalogManifest().then((manifest) =>
    fetchJson<CatalogItemOptionsIndex>(manifest.itemOptions.url),
  );
  return itemOptionsPromise;
}

export async function loadCatalogMonsters(): Promise<CatalogMonster[]> {
  monstersPromise ??= loadCatalogManifest()
    .then((manifest) =>
      fetchJson<Record<string, CatalogMonster>>(manifest.monsters.url),
    )
    .then((monsters) =>
      Object.values(monsters).sort((left, right) =>
        left.name.localeCompare(right.name, "en"),
      ),
    );
  return monstersPromise;
}

export function loadCatalogSkills(): Promise<CatalogClassSkills[]> {
  skillsPromise ??= fetchJson<CatalogClassSkills[]>("/data/skills.json");
  return skillsPromise;
}

export async function loadCatalogItemDetail(
  item: CatalogSearchItem,
): Promise<CatalogItemDetail | null> {
  const manifest = await loadCatalogManifest();
  const asset = manifest.chunks.find((chunk) => chunk.id === item.category);
  if (!asset) return null;

  if (!itemDetailChunkPromises.has(asset.id)) {
    itemDetailChunkPromises.set(
      asset.id,
      fetchJson<CatalogItemDetail[]>(asset.url),
    );
  }

  const items = await itemDetailChunkPromises.get(asset.id);
  return items?.find((entry) => entry.id === item.id) ?? null;
}

export function clearCatalogMemoryCache(): void {
  manifestPromise = null;
  searchPromise = null;
  itemOptionsPromise = null;
  monstersPromise = null;
  skillsPromise = null;
  itemDetailChunkPromises.clear();
}
