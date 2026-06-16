import { normalizeTagName } from "@/lib/knowledge/normalize";
import {
  ATTACK_ELEMENTS,
  DEFAULT_CHARACTER_STATS,
} from "@/lib/calculator/metadata";
import type {
  ItemVariant,
  KnowledgeSnapshot,
  OwnedItem,
  PriceQuote,
  SavedBuild,
  SaveKnowledgeEntry,
  UserTag,
  VariantTagLink,
} from "@/lib/knowledge/types";

const DATABASE_NAME = "ro-assistant";
const DATABASE_VERSION = 1;

const STORES = {
  itemVariants: "itemVariants",
  priceQuotes: "priceQuotes",
  tags: "tags",
  variantTags: "variantTags",
  ownedItems: "ownedItems",
  savedBuilds: "savedBuilds",
  syncMeta: "syncMeta",
} as const;

let databasePromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function createIndexes(database: IDBDatabase): void {
  const variants = database.createObjectStore(STORES.itemVariants, {
    keyPath: "id",
  });
  variants.createIndex("itemId", "itemId");
  variants.createIndex("fingerprint", "fingerprint", { unique: true });
  variants.createIndex("updatedAt", "updatedAt");

  const quotes = database.createObjectStore(STORES.priceQuotes, {
    keyPath: "id",
  });
  quotes.createIndex("variantId", "variantId");
  quotes.createIndex("server", "server");
  quotes.createIndex("observedAt", "observedAt");

  const tags = database.createObjectStore(STORES.tags, { keyPath: "id" });
  tags.createIndex("normalizedName", "normalizedName", { unique: true });

  const links = database.createObjectStore(STORES.variantTags, {
    keyPath: ["variantId", "tagId"],
  });
  links.createIndex("variantId", "variantId");
  links.createIndex("tagId", "tagId");

  const owned = database.createObjectStore(STORES.ownedItems, {
    keyPath: "id",
  });
  owned.createIndex("variantId", "variantId");
  owned.createIndex("isAvailable", "isAvailable");

  const builds = database.createObjectStore(STORES.savedBuilds, {
    keyPath: "id",
  });
  builds.createIndex("updatedAt", "updatedAt");

  database.createObjectStore(STORES.syncMeta, { keyPath: "key" });
}

export function openKnowledgeDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("เบราว์เซอร์นี้ไม่รองรับ IndexedDB"));
  }

  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      if ((event as IDBVersionChangeEvent).oldVersion === 0) {
        createIndexes(database);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("เปิด Knowledge Base ไม่สำเร็จ"));
    request.onblocked = () =>
      reject(new Error("Knowledge Base ถูกเปิดค้างจากแท็บอื่น"));
  });

  return databasePromise;
}

export async function loadKnowledgeSnapshot(): Promise<KnowledgeSnapshot> {
  const database = await openKnowledgeDatabase();
  const transaction = database.transaction(
    [
      STORES.itemVariants,
      STORES.priceQuotes,
      STORES.tags,
      STORES.variantTags,
      STORES.ownedItems,
      STORES.savedBuilds,
    ],
    "readonly",
  );

  const [
    itemVariants,
    priceQuotes,
    tags,
    variantTags,
    ownedItems,
    savedBuilds,
  ] = await Promise.all([
    requestToPromise(transaction.objectStore(STORES.itemVariants).getAll()),
    requestToPromise(transaction.objectStore(STORES.priceQuotes).getAll()),
    requestToPromise(transaction.objectStore(STORES.tags).getAll()),
    requestToPromise(transaction.objectStore(STORES.variantTags).getAll()),
    requestToPromise(transaction.objectStore(STORES.ownedItems).getAll()),
    requestToPromise(transaction.objectStore(STORES.savedBuilds).getAll()),
  ]);
  await transactionToPromise(transaction);

  return {
    itemVariants,
    priceQuotes,
    tags,
    variantTags,
    ownedItems,
    savedBuilds: (savedBuilds as unknown[]).map(normalizeSavedBuild),
  };
}

function normalizeSavedBuild(value: unknown): SavedBuild {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const legacySkill =
    typeof record.skillId === "string"
      ? record.skillId
      : typeof record.skill === "string"
        ? record.skill
        : "";
  const skillLevel = Number.isInteger(record.skillLevel)
    ? (record.skillLevel as number)
    : 1;
  const legacyBuffs = Array.isArray(record.buffs)
    ? record.buffs.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    ...(record as unknown as SavedBuild),
    id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
    name: typeof record.name === "string" ? record.name : "Imported Build",
    classId: Number.isInteger(record.classId) ? (record.classId as number) : 0,
    className:
      typeof record.className === "string"
        ? record.className
        : typeof record.job === "string"
          ? record.job
          : undefined,
    baseLevel: Number.isInteger(record.baseLevel)
      ? (record.baseLevel as number)
      : 1,
    jobLevel: Number.isInteger(record.jobLevel)
      ? (record.jobLevel as number)
      : 1,
    skillId: legacySkill,
    skillLevel,
    propertyAtk: ATTACK_ELEMENTS.includes(
      record.propertyAtk as SavedBuild["propertyAtk"],
    )
      ? (record.propertyAtk as SavedBuild["propertyAtk"])
      : "Neutral",
    monsterId: Number.isInteger(record.monsterId)
      ? (record.monsterId as number)
      : 0,
    server: record.server === "thor" ? "thor" : "chaos",
    equipment:
      typeof record.equipment === "object" && record.equipment !== null
        ? (record.equipment as SavedBuild["equipment"])
        : {},
    stats: {
      ...DEFAULT_CHARACTER_STATS,
      ...(typeof record.stats === "object" && record.stats !== null
        ? record.stats
        : {}),
    },
    skillLevels:
      typeof record.skillLevels === "object" && record.skillLevels !== null
        ? (record.skillLevels as Record<string, number>)
        : legacySkill
          ? { [legacySkill]: skillLevel }
          : {},
    buffLevels:
      typeof record.buffLevels === "object" && record.buffLevels !== null
        ? (record.buffLevels as Record<string, number>)
        : Object.fromEntries(legacyBuffs.map((buff) => [buff, 1])),
    consumableIds: Array.isArray(record.consumableIds)
      ? record.consumableIds.filter(
          (entry): entry is number => Number.isInteger(entry),
        )
      : [],
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
  };
}

export async function saveKnowledgeEntry({
  variant,
  quote,
  tagNames,
}: SaveKnowledgeEntry): Promise<{ variantId: string; quoteId?: string }> {
  const database = await openKnowledgeDatabase();
  const transaction = database.transaction(
    [
      STORES.itemVariants,
      STORES.priceQuotes,
      STORES.tags,
      STORES.variantTags,
    ],
    "readwrite",
  );

  const variantStore = transaction.objectStore(STORES.itemVariants);
  const existingVariant = (await requestToPromise(
    variantStore.index("fingerprint").get(variant.fingerprint),
  )) as ItemVariant | undefined;
  const variantToSave = existingVariant
    ? {
        ...existingVariant,
        ...variant,
        id: existingVariant.id,
        createdAt: existingVariant.createdAt,
      }
    : variant;
  variantStore.put(variantToSave);

  let quoteId: string | undefined;
  if (quote) {
    const quoteToSave: PriceQuote = {
      ...quote,
      variantId: variantToSave.id,
    };
    transaction.objectStore(STORES.priceQuotes).put(quoteToSave);
    quoteId = quoteToSave.id;
  }

  const tagStore = transaction.objectStore(STORES.tags);
  const tagIndex = tagStore.index("normalizedName");
  const linkStore = transaction.objectStore(STORES.variantTags);
  const uniqueNames = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];

  for (const name of uniqueNames) {
    const normalizedName = normalizeTagName(name);
    if (!normalizedName) continue;

    const existingTag = (await requestToPromise(
      tagIndex.get(normalizedName),
    )) as UserTag | undefined;
    const now = new Date().toISOString();
    const tag: UserTag =
      existingTag ?? {
        id: crypto.randomUUID(),
        name,
        normalizedName,
        createdAt: now,
        updatedAt: now,
      };
    if (!existingTag) tagStore.add(tag);

    const link: VariantTagLink = {
      variantId: variantToSave.id,
      tagId: tag.id,
    };
    linkStore.put(link);
  }

  await transactionToPromise(transaction);
  return { variantId: variantToSave.id, quoteId };
}

export async function saveBuild(build: SavedBuild): Promise<void> {
  const database = await openKnowledgeDatabase();
  const transaction = database.transaction(STORES.savedBuilds, "readwrite");
  transaction.objectStore(STORES.savedBuilds).put(build);
  await transactionToPromise(transaction);
}

export async function deleteBuild(buildId: string): Promise<void> {
  const database = await openKnowledgeDatabase();
  const transaction = database.transaction(STORES.savedBuilds, "readwrite");
  transaction.objectStore(STORES.savedBuilds).delete(buildId);
  await transactionToPromise(transaction);
}

export async function importKnowledgeSnapshot(
  snapshot: KnowledgeSnapshot,
  mode: "merge" | "replace",
): Promise<void> {
  const database = await openKnowledgeDatabase();
  const transaction = database.transaction(
    [
      STORES.itemVariants,
      STORES.priceQuotes,
      STORES.tags,
      STORES.variantTags,
      STORES.ownedItems,
      STORES.savedBuilds,
    ],
    "readwrite",
  );

  const variantStore = transaction.objectStore(STORES.itemVariants);
  const quoteStore = transaction.objectStore(STORES.priceQuotes);
  const tagStore = transaction.objectStore(STORES.tags);
  const linkStore = transaction.objectStore(STORES.variantTags);
  const ownedStore = transaction.objectStore(STORES.ownedItems);
  const buildStore = transaction.objectStore(STORES.savedBuilds);

  if (mode === "replace") {
    variantStore.clear();
    quoteStore.clear();
    tagStore.clear();
    linkStore.clear();
    ownedStore.clear();
    buildStore.clear();

    snapshot.itemVariants.forEach((record) => variantStore.put(record));
    snapshot.priceQuotes.forEach((record) => quoteStore.put(record));
    snapshot.tags.forEach((record) => tagStore.put(record));
    snapshot.variantTags.forEach((record) => linkStore.put(record));
    snapshot.ownedItems.forEach((record) => ownedStore.put(record));
    snapshot.savedBuilds.forEach((record) => buildStore.put(record));
    await transactionToPromise(transaction);
    return;
  }

  const variantIdMap = new Map<string, string>();
  for (const importedVariant of snapshot.itemVariants) {
    const existingByFingerprint = (await requestToPromise(
      variantStore.index("fingerprint").get(importedVariant.fingerprint),
    )) as ItemVariant | undefined;
    if (existingByFingerprint) {
      variantIdMap.set(importedVariant.id, existingByFingerprint.id);
      continue;
    }

    const existingById = (await requestToPromise(
      variantStore.get(importedVariant.id),
    )) as ItemVariant | undefined;
    const variantId = existingById ? crypto.randomUUID() : importedVariant.id;
    variantIdMap.set(importedVariant.id, variantId);
    variantStore.put({ ...importedVariant, id: variantId });
  }

  const tagIdMap = new Map<string, string>();
  for (const importedTag of snapshot.tags) {
    const normalizedName = normalizeTagName(importedTag.name);
    const existingByName = (await requestToPromise(
      tagStore.index("normalizedName").get(normalizedName),
    )) as UserTag | undefined;
    if (existingByName) {
      tagIdMap.set(importedTag.id, existingByName.id);
      continue;
    }

    const existingById = (await requestToPromise(
      tagStore.get(importedTag.id),
    )) as UserTag | undefined;
    const tagId = existingById ? crypto.randomUUID() : importedTag.id;
    tagIdMap.set(importedTag.id, tagId);
    tagStore.put({
      ...importedTag,
      id: tagId,
      normalizedName,
    });
  }

  for (const importedQuote of snapshot.priceQuotes) {
    const existing = (await requestToPromise(
      quoteStore.get(importedQuote.id),
    )) as PriceQuote | undefined;
    const mappedVariantId =
      variantIdMap.get(importedQuote.variantId) ?? importedQuote.variantId;
    quoteStore.put({
      ...importedQuote,
      id: existing ? crypto.randomUUID() : importedQuote.id,
      variantId: mappedVariantId,
    });
  }

  for (const importedLink of snapshot.variantTags) {
    const link: VariantTagLink = {
      variantId:
        variantIdMap.get(importedLink.variantId) ?? importedLink.variantId,
      tagId: tagIdMap.get(importedLink.tagId) ?? importedLink.tagId,
    };
    linkStore.put(link);
  }

  for (const importedOwnedItem of snapshot.ownedItems) {
    const existing = (await requestToPromise(
      ownedStore.get(importedOwnedItem.id),
    )) as OwnedItem | undefined;
    ownedStore.put({
      ...importedOwnedItem,
      id: existing ? crypto.randomUUID() : importedOwnedItem.id,
      variantId:
        variantIdMap.get(importedOwnedItem.variantId) ??
        importedOwnedItem.variantId,
    });
  }

  for (const importedBuild of snapshot.savedBuilds) {
    const existing = (await requestToPromise(
      buildStore.get(importedBuild.id),
    )) as SavedBuild | undefined;
    const equipment = Object.fromEntries(
      Object.entries(importedBuild.equipment).map(([slot, selection]) => {
        if (typeof selection === "string") {
          return [slot, variantIdMap.get(selection) ?? selection];
        }
        return [slot, selection ?? null];
      }),
    );
    buildStore.put({
      ...importedBuild,
      id: existing ? crypto.randomUUID() : importedBuild.id,
      equipment,
    });
  }

  await transactionToPromise(transaction);
}
