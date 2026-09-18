import type {
  CatalogHpSpTable,
  CatalogItemDetail,
  CatalogMonster,
} from "@/lib/catalog/types";
import type {
  CharacterStats,
  EquipmentSlot,
  ItemGrade,
} from "@/lib/equipment/types";
import type { AttackElement } from "@/lib/calculator/metadata";

export interface DamageEquipmentSelection {
  itemId: number;
  refine: number;
  grade?: ItemGrade;
  cardIds: number[];
  enchantIds: Array<number | undefined>;
}

export interface DamageCalculationInput {
  classId: number;
  baseLevel: number;
  jobLevel: number;
  skillValue: string;
  attackElement: AttackElement;
  stats: CharacterStats;
  monster: CatalogMonster;
  items: CatalogItemDetail[];
  equipment: Partial<Record<EquipmentSlot, DamageEquipmentSelection>>;
  hpSpTable: CatalogHpSpTable;
  activeSkillValues?: Record<string, number>;
  passiveSkillValues?: Record<string, number>;
  consumableItemIds?: number[];
  extraOptionScripts?: Array<Record<string, unknown[]>>;
}

export interface DamageCalculationResult {
  engine: "tong-calc-ro";
  engineVersion: string;
  className: string;
  skillName: string;
  targetName: string;
  basic: {
    min: number;
    max: number;
    criticalMin: number;
    criticalMax: number;
    dps: number;
    accuracy: number;
    attackSpeed: number;
    hitsPerSecond: number;
  };
  skill: {
    min: number;
    max: number;
    nonCriticalMin: number;
    nonCriticalMax: number;
    dps: number;
    hits: number;
    accuracy: number;
    damageType: string;
    element: string;
  };
  defense: {
    def: number;
    softDef: number;
    mdef: number;
    softMdef: number;
    res: number;
    mres: number;
  };
  resources: {
    maxHp: number;
    maxSp: number;
  };
  warnings: string[];
}

export type DamageCalculationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: DamageCalculationResult }
  | { status: "error"; message: string };

let enginePromise:
  | Promise<typeof import("@/generated/legacy-engine.mjs")>
  | null = null;

export async function calculateDamage(
  input: DamageCalculationInput,
): Promise<DamageCalculationResult> {
  enginePromise ??= import("@/generated/legacy-engine.mjs");
  const engine = await enginePromise;
  return engine.calculateLegacyDamage(input);
}
