import type {
  CharacterStats,
  EquipmentSlot,
  ItemGrade,
  ServerId,
} from "@/lib/equipment/types";
import type { AttackElement } from "@/lib/calculator/metadata";

export interface SlottedItem {
  slot: number;
  itemId: number;
}

export interface ItemOption {
  slot?: number;
  key: string;
  itemId?: number;
  value?: number;
  unit?: "flat" | "percent" | "level" | "text";
  label: string;
}

export interface ItemVariant {
  id: string;
  itemId: number;
  fingerprint: string;
  refine: number;
  grade?: ItemGrade;
  cards: SlottedItem[];
  enchants: ItemOption[];
  randomOptions: ItemOption[];
  customLabel?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceQuote {
  id: string;
  variantId: string;
  server: ServerId;
  priceZeny: number;
  quantity: number;
  sourceType: "manual" | "market" | "shop" | "trade" | "import";
  sourceLabel?: string;
  observedAt: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedEquipmentSelection {
  itemId?: number;
  cardIds?: number[];
  refine?: number;
  grade?: ItemGrade;
  enchantIds?: number[];
  randomOptions?: ItemOption[];
}

export interface CalculatorBuildDraft {
  classId: number;
  className?: string;
  baseLevel: number;
  jobLevel: number;
  skillId: string;
  skillLevel: number;
  propertyAtk: AttackElement;
  monsterId: number;
  server: ServerId;
  equipment: Partial<Record<EquipmentSlot, SavedEquipmentSelection>>;
  stats: CharacterStats;
  skillLevels: Record<string, number>;
  buffLevels: Record<string, number>;
  consumableIds: number[];
  targetDamage?: number;
  budgetZeny?: number;
}

export interface UserTag {
  id: string;
  name: string;
  normalizedName: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VariantTagLink {
  variantId: string;
  tagId: string;
}

export interface OwnedItem {
  id: string;
  variantId: string;
  quantity: number;
  acquisitionPriceZeny?: number;
  isAvailable: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedBuild {
  id: string;
  name: string;
  classId: number;
  className?: string;
  baseLevel: number;
  jobLevel: number;
  skillId: string;
  skillLevel: number;
  propertyAtk: AttackElement;
  monsterId: number;
  server: ServerId;
  equipment: Partial<
    Record<EquipmentSlot, SavedEquipmentSelection | string | null>
  >;
  stats: CharacterStats;
  skillLevels: Record<string, number>;
  buffLevels: Record<string, number>;
  consumableIds: number[];
  targetDamage?: number;
  budgetZeny?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeSnapshot {
  itemVariants: ItemVariant[];
  priceQuotes: PriceQuote[];
  tags: UserTag[];
  variantTags: VariantTagLink[];
  ownedItems: OwnedItem[];
  savedBuilds: SavedBuild[];
}

export interface SaveKnowledgeEntry {
  variant: ItemVariant;
  quote?: PriceQuote;
  tagNames: string[];
}
