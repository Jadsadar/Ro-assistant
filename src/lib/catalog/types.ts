import type { EquipmentSlot } from "@/lib/equipment/types";

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
  itemSubTypeId: number;
  itemType: string;
  slot: string | null;
  equipSlots: EquipmentSlot[];
  category: string;
  slots: number;
  compositionPos: number | null;
  canGrade: boolean;
  isRefinable: boolean;
  requiredLevel: number | null;
  usableClass?: string[];
  unusableClass?: string[];
  searchable: string;
}

export type CatalogItemOptionsIndex = Record<number, CatalogItemOptions>;

export interface CatalogItemDetail extends CatalogSearchItem {
  unidName: string;
  resName: string;
  description: string;
  itemLevel: number | null;
  attack: number | null;
  propertyAtk?: number | null;
  defense: number | null;
  weight: number;
  usableClass?: string[];
  unusableClass?: string[];
  script: Record<string, unknown[]>;
}

export interface CatalogMonster {
  id: number;
  dbname: string;
  name: string;
  spawn: string;
  stats: {
    level: number;
    health: number;
    defense: number;
    magicDefense: number;
    res: number;
    mres: number;
    elementName: string;
    elementShortName: string;
    scaleName: string;
    raceName: string;
    class: number;
    mvp: number;
    [key: string]: unknown;
  };
}

export interface CatalogSkillChoice {
  label: string;
  value: string;
  level: number;
}

export interface CatalogSkill {
  name: string;
  choices: CatalogSkillChoice[];
}

export interface CatalogClassSkills {
  classId: number;
  className: string;
  skills: CatalogSkill[];
}
