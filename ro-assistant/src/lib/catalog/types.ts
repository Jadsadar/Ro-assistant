export interface CatalogAsset {
  id: string;
  url: string;
  sha256: string;
  recordCount: number;
  bytes: number;
}

export interface CatalogOptionChoice {
  key: string;
  label: string;
  itemId?: number;
}

export interface CatalogOptionGroup {
  slot: number;
  label: string;
  choices: CatalogOptionChoice[];
}

export interface CatalogItemOptions {
  itemId: number;
  aegisName: string;
  groups: CatalogOptionGroup[];
  randomOptionCount: number;
}

export interface CatalogManifest {
  schemaVersion: number;
  catalogVersion: string;
  generatedAt: string;
  source: {
    itemCount: number;
    monsterCount: number;
  };
  search: CatalogAsset;
  itemOptions: CatalogAsset;
  monsters: CatalogAsset;
  hpSpTable: CatalogAsset;
  chunks: CatalogAsset[];
}

export interface CatalogSearchItem {
  id: number;
  name: string;
  aegisName: string;
  itemTypeId: number;
  itemType: string;
  slot: string | null;
  category: string;
  slots: number;
  requiredLevel: number | null;
  searchable: string;
}

export type CatalogItemOptionsIndex = Record<number, CatalogItemOptions>;

export interface CatalogItemDetail extends CatalogSearchItem {
  unidName: string;
  resName: string;
  description: string;
  itemSubTypeId: number;
  itemLevel: number | null;
  attack: number | null;
  propertyAtk?: number | null;
  defense: number | null;
  weight: number;
  compositionPos: number | null;
  usableClass?: string[];
  unusableClass?: string[];
  canGrade?: boolean;
  isRefinable?: boolean;
  script: Record<string, unknown[]>;
}
