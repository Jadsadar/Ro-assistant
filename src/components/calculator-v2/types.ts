import type {
  CatalogClassSkills,
  CatalogItemOptionsIndex,
  CatalogHpSpTable,
  CatalogMonster,
  CatalogSearchItem,
  CatalogSkill,
} from "@/lib/catalog/types";
import type {
  CharacterStats,
  EquipmentSlot,
  ItemGrade,
} from "@/lib/equipment/types";
import type { AttackElement } from "@/lib/calculator/metadata";

export interface CalculatorV2Data {
  classes: CatalogClassSkills[];
  items: CatalogSearchItem[];
  options: CatalogItemOptionsIndex;
  monsters: CatalogMonster[];
  hpSpTable: CatalogHpSpTable;
}

export interface CalculatorV2Selection {
  buildName: string;
  classId: number;
  baseLevel: number;
  jobLevel: number;
  skillId: string;
  skillLevel: number;
  activeSkillKey: string;
  /** Offensive skill dropdown state, keyed by `name::label`. */
  skillSelections: Record<string, string>;
  /** Active buff levels, keyed by the legacy skill name the engine looks up. */
  activeSkillLevels: Record<string, number>;
  /** Passive skill levels, keyed by the legacy skill name. */
  passiveSkillLevels: Record<string, number>;
  attackElement: AttackElement;
  activeBuffs: string[];
  stats: CharacterStats;
  monsterId: number;
  equipment: Partial<Record<EquipmentSlot, EquipmentSlotSelection>>;
}

export interface EquipmentSlotSelection {
  itemId?: number;
  refine: number;
  grade?: ItemGrade;
  cardIds: number[];
  optionKeys: string[];
  /**
   * Random ("extra") option selections, one cascade path per option slot.
   * A path resolves to a leaf node whose value is the legacy `attr:value` text.
   */
  randomOptionPaths: string[][];
}

export interface EquipmentSlotDefinition {
  slot: EquipmentSlot;
  label: string;
  group: "main" | "costume" | "costumeEnchant" | "shadow";
}

export interface SelectedClassView {
  className: string;
  skills: CatalogSkill[];
  activeSkills: CatalogSkill[];
  passiveSkills: CatalogSkill[];
}
