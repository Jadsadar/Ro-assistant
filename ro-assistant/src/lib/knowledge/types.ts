export interface SlottedItem {
  slot: number;
  itemId: number;
}

export interface ItemOption {
  slot?: number;
  key: string;
  value?: number;
  unit?: "flat" | "percent" | "level" | "text";
  label: string;
}

export interface ItemVariant {
  id: string;
  itemId: number;
  fingerprint: string;
  refine: number;
  grade?: "D" | "C" | "B" | "A";
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
  server: string;
  priceZeny: number;
  quantity: number;
  sourceType: "manual" | "market" | "shop" | "trade" | "import";
  sourceLabel?: string;
  observedAt: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
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
  job: string;
  skill: string;
  monsterId: number;
  equipment: Record<string, string | null>;
  stats: Record<string, number>;
  buffs: string[];
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
