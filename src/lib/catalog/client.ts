import type {
  CatalogItemOptionsIndex,
  CatalogManifest,
  CatalogSearchItem,
} from "@/lib/catalog/types";

let manifestPromise: Promise<CatalogManifest> | null = null;
let searchPromise: Promise<CatalogSearchItem[]> | null = null;
let itemOptionsPromise: Promise<CatalogItemOptionsIndex> | null = null;

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
  searchPromise ??= loadCatalogManifest().then((manifest) =>
    fetchJson<CatalogSearchItem[]>(manifest.search.url),
  );
  return searchPromise;
}

export async function loadCatalogItemOptions(): Promise<CatalogItemOptionsIndex> {
  itemOptionsPromise ??= loadCatalogManifest().then((manifest) =>
    fetchJson<CatalogItemOptionsIndex>(manifest.itemOptions.url),
  );
  return itemOptionsPromise;
}

export function clearCatalogMemoryCache(): void {
  manifestPromise = null;
  searchPromise = null;
  itemOptionsPromise = null;
}
