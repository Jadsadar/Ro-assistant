"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  loadCatalogItemDetail,
  loadCatalogItemOptions,
  loadCatalogManifest,
  loadCatalogSearch,
} from "@/lib/catalog/client";
import { RandomOptionCascade } from "@/components/equipment/random-option-cascade";
import type {
  CatalogItemDetail,
  CatalogItemOptions,
  CatalogItemOptionsIndex,
  CatalogManifest,
  CatalogSearchItem,
} from "@/lib/catalog/types";
import { CALCULATOR_CLASSES } from "@/lib/calculator/metadata";
import {
  EQUIPMENT_SLOT_RULES,
  ITEM_GRADES,
  cardPositionsForSlot,
  type EquipmentSlot,
  type ItemGrade,
  type ServerId,
} from "@/lib/equipment/types";
import { resolveRandomOptionCount } from "@/lib/equipment/catalog-rules";
import {
  getLegacyRandomOptionTree,
  resolveRandomOptionPath,
  toItemOption,
} from "@/lib/equipment/random-options";
import { createVariantFingerprint } from "@/lib/knowledge/fingerprint";
import { normalizeSearchText } from "@/lib/knowledge/normalize";
import {
  formatCompactZeny,
  parsePriceInput,
} from "@/lib/knowledge/price";
import {
  loadKnowledgeSnapshot,
  saveKnowledgeEntry,
} from "@/lib/knowledge/repository";
import type {
  ItemOption,
  ItemVariant,
  KnowledgeSnapshot,
  PriceQuote,
} from "@/lib/knowledge/types";

const EMPTY_KNOWLEDGE: KnowledgeSnapshot = {
  itemVariants: [],
  priceQuotes: [],
  tags: [],
  variantTags: [],
  ownedItems: [],
  savedBuilds: [],
};

const PAGE_SIZE_OPTIONS = [16, 32, 64] as const;
type SlotFilterValue = EquipmentSlot | "card";
const SLOT_FILTERS: Array<{
  value: SlotFilterValue;
  label: string;
}> = [
  { value: "weapon", label: "weapon" },
  { value: "headUpper", label: "upper" },
  { value: "headMiddle", label: "middle" },
  { value: "headLower", label: "lower" },
  { value: "armor", label: "armor" },
  { value: "garment", label: "garment" },
  { value: "boot", label: "boot" },
  { value: "accRight", label: "AccRight" },
  { value: "accLeft", label: "AccLeft" },
  { value: "shadowWeapon", label: "Shadow weapon" },
  { value: "shadowBoot", label: "Shadow Boot" },
  { value: "shadowArmor", label: "Shadow armor" },
  { value: "shadowShield", label: "Shadow shield" },
  { value: "shadowEarring", label: "Shadow earring" },
  { value: "shadowPendant", label: "Shadow Pendant" },
  { value: "pet", label: "pet" },
  { value: "card", label: "card" },
] as const;
const SLOT_FILTER_LABELS = new Map(
  SLOT_FILTERS.map((filter) => [filter.value, filter.label]),
);

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function latestQuoteForVariant(
  quotes: PriceQuote[],
  variantId: string,
): PriceQuote | undefined {
  return quotes
    .filter((quote) => quote.variantId === variantId)
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt))[0];
}

function slotFilterValuesForItem(item: CatalogSearchItem): SlotFilterValue[] {
  if (item.itemTypeId === 6 || item.category === "cards") return ["card"];
  return item.equipSlots.filter((slot): slot is EquipmentSlot =>
    SLOT_FILTER_LABELS.has(slot),
  );
}

function slotDisplayLabel(item: CatalogSearchItem): string {
  const values = slotFilterValuesForItem(item);
  if (values.length === 0) return "ไม่มี slot";
  return values
    .map((value) => SLOT_FILTER_LABELS.get(value) ?? value)
    .join(" / ");
}

function classToken(name: string): string {
  return name.replace(/\s+/g, "");
}

function broadClassTokens(generation: 3 | 4 | "expanded"): string[] {
  if (generation === 4) return ["Only 4th", "4th"];
  if (generation === 3) return ["Only 3rd Cls", "3rd"];
  return ["Expanded", "Only Expanded"];
}

function itemMatchesClass(
  item: CatalogSearchItem,
  selectedClassId: string,
): boolean {
  if (selectedClassId === "all") return true;
  const selectedClass = CALCULATOR_CLASSES.find(
    (entry) => String(entry.id) === selectedClassId,
  );
  if (!selectedClass) return true;

  const usableClass = item.usableClass ?? [];
  const unusableClass = item.unusableClass ?? [];
  const token = classToken(selectedClass.name);
  if (unusableClass.includes(token)) return false;
  if (usableClass.length === 0) return true;

  return [
    token,
    "Every Job",
    "All",
    ...broadClassTokens(selectedClass.generation),
  ].some((entry) => usableClass.includes(entry));
}

function cleanDescription(description: string): string {
  return description
    .replace(/\^[0-9a-fA-F]{6}/g, "")
    .replace(/\^000000/g, "")
    .trim();
}

function itemImageUrl(item: CatalogSearchItem): string {
  return `/data/images/items/${item.id}.png`;
}

function fallbackInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function KnowledgeDashboard() {
  const [manifest, setManifest] = useState<CatalogManifest | null>(null);
  const [catalog, setCatalog] = useState<CatalogSearchItem[]>([]);
  const [itemOptions, setItemOptions] = useState<CatalogItemOptionsIndex>({});
  const [knowledge, setKnowledge] =
    useState<KnowledgeSnapshot>(EMPTY_KNOWLEDGE);
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(16);
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] =
    useState<CatalogSearchItem | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<CatalogItemDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [refine, setRefine] = useState("0");
  const [grade, setGrade] = useState<ItemGrade | "">("");
  const [cardSelections, setCardSelections] = useState<string[]>([]);
  const [enchantSelections, setEnchantSelections] = useState<
    Record<number, string>
  >({});
  const [randomOptionPaths, setRandomOptionPaths] = useState<string[][]>([]);
  const [priceInput, setPriceInput] = useState("");
  const [server, setServer] = useState<ServerId>("chaos");
  const [tagInput, setTagInput] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("กำลังโหลด catalog...");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function refreshKnowledge(): Promise<void> {
    const snapshot = await loadKnowledgeSnapshot();
    setKnowledge(snapshot);
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadCatalogManifest(),
      loadCatalogSearch(),
      loadCatalogItemOptions(),
      loadKnowledgeSnapshot(),
    ])
      .then(([nextManifest, items, optionIndex, snapshot]) => {
        if (cancelled) return;
        setManifest(nextManifest);
        setCatalog(items);
        setItemOptions(optionIndex);
        setKnowledge(snapshot);
        setStatus(`พร้อมค้นหา ${items.length.toLocaleString("en-US")} ไอเท็ม`);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error ? reason.message : "โหลด Knowledge Base ไม่สำเร็จ",
        );
        setStatus("");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedItem) return;

    let cancelled = false;
    loadCatalogItemDetail(selectedItem)
      .then((detail) => {
        if (!cancelled) setSelectedDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setSelectedDetail(null);
      })
      .finally(() => {
        if (!cancelled) setIsDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedItem]);

  const slots = SLOT_FILTERS;

  const normalizedQuery = normalizeSearchText(query);
  const filteredItems = useMemo(() => {
    const tokens = normalizedQuery.split(" ").filter(Boolean);
    return catalog
      .filter(
        (item) =>
          slot === "all" ||
          slotFilterValuesForItem(item).includes(slot as SlotFilterValue),
      )
      .filter((item) => itemMatchesClass(item, classFilter))
      .filter(
        (item) =>
          tokens.length === 0 ||
          tokens.every((token) => item.searchable.includes(token)),
      );
  }, [catalog, classFilter, normalizedQuery, slot]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, pageSize, safePage]);

  const itemById = useMemo(
    () => new Map(catalog.map((item) => [item.id, item])),
    [catalog],
  );
  const tagById = useMemo(
    () => new Map(knowledge.tags.map((tag) => [tag.id, tag])),
    [knowledge.tags],
  );
  const savedRows = useMemo(() => {
    return knowledge.itemVariants
      .map((variant) => {
        const item = itemById.get(variant.itemId);
        const quote = latestQuoteForVariant(
          knowledge.priceQuotes,
          variant.id,
        );
        const tags = knowledge.variantTags
          .filter((link) => link.variantId === variant.id)
          .map((link) => tagById.get(link.tagId)?.name)
          .filter(Boolean) as string[];
        const searchable = normalizeSearchText(
          [
            item?.name,
            variant.customLabel,
            variant.enchants.map((option) => option.label).join(" "),
            variant.randomOptions.map((option) => option.label).join(" "),
            variant.note,
            tags.join(" "),
          ]
            .filter(Boolean)
            .join(" "),
        );
        return { variant, item, quote, tags, searchable };
      })
      .filter(
        (row) =>
          !normalizedQuery ||
          normalizedQuery
            .split(" ")
            .filter(Boolean)
            .every((token) => row.searchable.includes(token)),
      )
      .sort((left, right) =>
        right.variant.updatedAt.localeCompare(left.variant.updatedAt),
      );
  }, [
    itemById,
    knowledge.itemVariants,
    knowledge.priceQuotes,
    knowledge.variantTags,
    normalizedQuery,
    tagById,
  ]);

  const parsedPrice = priceInput ? parsePriceInput(priceInput) : null;
  const selectedTemplate: CatalogItemOptions | undefined = selectedItem
    ? itemOptions[selectedItem.id]
    : undefined;
  const randomOptionTree = useMemo(
    () => (randomOptionPaths.length > 0 ? getLegacyRandomOptionTree() : []),
    [randomOptionPaths.length],
  );
  const availableCards = useMemo(() => {
    if (!selectedItem) return [];
    const positions = new Set<number>(
      selectedItem.equipSlots.flatMap((equipmentSlot) =>
        cardPositionsForSlot(equipmentSlot),
      ),
    );
    return catalog.filter(
      (item) =>
        item.itemTypeId === 6 &&
        item.compositionPos !== null &&
        positions.has(item.compositionPos),
    );
  }, [catalog, selectedItem]);

  function chooseItem(item: CatalogSearchItem): void {
    setSelectedItem(item);
    setSelectedDetail(null);
    setIsDetailLoading(true);
    setRefine("0");
    setGrade("");
    const maxCards = Math.max(
      0,
      ...item.equipSlots.map(
        (equipmentSlot) => EQUIPMENT_SLOT_RULES[equipmentSlot].maxCards,
      ),
    );
    setCardSelections(
      Array.from({ length: Math.min(item.slots, maxCards) }, () => ""),
    );
    setEnchantSelections({});
    const randomOptionCount = resolveRandomOptionCount(
      item.itemTypeId,
      item.equipSlots,
      itemOptions[item.id]?.randomOptionCount ?? 0,
    );
    setRandomOptionPaths(
      Array.from(
        { length: randomOptionCount },
        () => [],
      ),
    );
    setPriceInput("");
    setTagInput("");
    setNote("");
    setError("");
  }

  function clearSelectedItem(): void {
    setSelectedItem(null);
    setSelectedDetail(null);
    setIsDetailLoading(false);
  }

  async function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItem) return;

    const refineValue = Number(refine);
    if (!Number.isInteger(refineValue) || refineValue < 0 || refineValue > 20) {
      setError("Refine ต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 20");
      return;
    }
    if (priceInput && !parsedPrice) {
      setError("อ่านราคาไม่สำเร็จ ตัวอย่างที่รองรับ: 50m, 20 เอ็ม, 1.2b");
      return;
    }
    if (
      randomOptionPaths.some(
        (path) =>
          path.length > 0 && !resolveRandomOptionPath(randomOptionTree, path),
      )
    ) {
      setError("กรุณาเลือก Random Option ให้ครบจนถึงค่าของออฟ");
      return;
    }

    setIsSaving(true);
    setError("");
    const now = new Date().toISOString();

    const enchants: ItemOption[] = (selectedTemplate?.groups ?? [])
      .map((group) => {
        const choiceKey = enchantSelections[group.slot];
        if (!choiceKey) return null;
        const choice = group.choices.find((entry) => entry.key === choiceKey);
        if (!choice) return null;
        return {
          slot: group.slot,
          key: choice.key,
          itemId: choice.itemId,
          unit: "text" as const,
          label: choice.label,
        };
      })
      .filter(Boolean) as ItemOption[];

    const randomOptions: ItemOption[] = randomOptionPaths.flatMap(
      (path, index) => {
        const option = resolveRandomOptionPath(randomOptionTree, path);
        return option ? [toItemOption(option, index + 1)] : [];
      },
    );

    const variantBase = {
      itemId: selectedItem.id,
      refine: refineValue,
      grade: grade || undefined,
      cards: cardSelections.flatMap((cardId, index) => {
        const itemId = Number(cardId);
        return Number.isInteger(itemId) && itemId > 0
          ? [{ slot: index + 1, itemId }]
          : [];
      }),
      enchants,
      randomOptions,
    };
    const variant: ItemVariant = {
      id: createId("variant"),
      ...variantBase,
      fingerprint: createVariantFingerprint(variantBase),
      customLabel: [
        selectedItem.name,
        refineValue > 0 ? `+${refineValue}` : "",
        grade ? `Grade ${grade}` : "",
        ...cardSelections
          .map((cardId) => itemById.get(Number(cardId))?.name)
          .filter(Boolean),
        ...enchants.map((entry) => entry.label),
        ...randomOptions.map((entry) => entry.label),
      ]
        .filter(Boolean)
        .join(" "),
      note: note.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    const quote: PriceQuote | undefined = parsedPrice
      ? {
          id: createId("quote"),
          variantId: variant.id,
          server,
          priceZeny: parsedPrice.value,
          quantity: 1,
          sourceType: "manual",
          observedAt: now,
          createdAt: now,
          updatedAt: now,
        }
      : undefined;
    const tagNames = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      await saveKnowledgeEntry({ variant, quote, tagNames });
      await refreshKnowledge();
      setStatus(`บันทึก ${variant.customLabel} แล้ว`);
      clearSelectedItem();
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "บันทึกข้อมูลไม่สำเร็จ",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="knowledge-layout">
      <div className="knowledge-main panel">
        <div className="knowledge-toolbar">
          <label>
            <span>ค้นหา item ID หรือชื่อ</span>
            <input
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="เช่น Temporal Dex Boots, Volar, Hawkeye"
              type="search"
              value={query}
            />
          </label>
          <label>
            <span>Slot</span>
            <select
              onChange={(event) => {
                setSlot(event.target.value);
                setPage(1);
              }}
              value={slot}
            >
              <option value="all">ทุก slot</option>
              {slots.map((slotOption) => (
                <option key={slotOption.value} value={slotOption.value}>
                  {slotOption.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Class</span>
            <select
              onChange={(event) => {
                setClassFilter(event.target.value);
                setPage(1);
              }}
              value={classFilter}
            >
              <option value="all">ทุกอาชีพ</option>
              {CALCULATOR_CLASSES.map((jobClass) => (
                <option key={jobClass.id} value={jobClass.id}>
                  {jobClass.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="catalog-meta">
          <span>{status || "Catalog unavailable"}</span>
          <span>
            Version {manifest?.catalogVersion ?? "—"} · พบ{" "}
            {filteredItems.length.toLocaleString("en-US")} รายการ
          </span>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="item-table" role="table" aria-label="รายการไอเท็ม">
          <div className="item-row item-header" role="row">
            <span>Item</span>
            <span>Type / Slot</span>
            <span>Action</span>
          </div>
          {visibleItems.map((item) => (
            <div className="item-row" role="row" key={item.id}>
              <span>
                <span className="item-name-with-thumb">
                  <span className="catalog-thumb">
                    <Image
                      alt={item.name}
                      height={38}
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                      src={itemImageUrl(item)}
                      unoptimized
                      width={38}
                    />
                    <span>{fallbackInitials(item.name)}</span>
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>#{item.id} · {item.aegisName}</small>
                  </span>
                </span>
              </span>
              <span>
                {item.itemType}
                <small>{slotDisplayLabel(item)} · {item.slots} ช่อง</small>
              </span>
              <span>
                <button
                  className="secondary-button"
                  onClick={() => chooseItem(item)}
                  type="button"
                >
                  เพิ่มราคา
                </button>
              </span>
            </div>
          ))}
          {filteredItems.length === 0 ? (
            <div className="empty-state">ไม่พบไอเท็มตามตัวกรองนี้</div>
          ) : null}
        </div>
        <div className="catalog-pagination">
          <label>
            <span>แสดงต่อหน้า</span>
            <select
              onChange={(event) => {
                setPageSize(Number(event.target.value) as typeof pageSize);
                setPage(1);
              }}
              value={pageSize}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="pagination-actions">
            <button
              className="secondary-button"
              disabled={safePage <= 1}
              onClick={() => setPage(1)}
              type="button"
            >
              First
            </button>
            <button
              className="secondary-button"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Prev
            </button>
            <span>
              หน้า {safePage} / {totalPages}
            </span>
            <button
              className="secondary-button"
              disabled={safePage >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              type="button"
            >
              Next
            </button>
            <button
              className="secondary-button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(totalPages)}
              type="button"
            >
              Last
            </button>
          </div>
        </div>
      </div>

      <aside className="knowledge-side">
        <div className="panel sticky-panel">
          {selectedItem ? (
            <form className="variant-form" onSubmit={saveEntry}>
              <div>
                <p className="eyebrow">New variant</p>
                <div className="selected-item-heading">
                  <span className="catalog-thumb">
                    <Image
                      alt={selectedItem.name}
                      height={38}
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                      src={itemImageUrl(selectedItem)}
                      unoptimized
                      width={38}
                    />
                    <span>{fallbackInitials(selectedItem.name)}</span>
                  </span>
                  <h2>{selectedItem.name}</h2>
                </div>
                <p className="form-help">Item ID {selectedItem.id}</p>
                <p className="form-help">
                  {selectedItem.itemType}
                  {selectedItem.slot ? ` · ${selectedItem.slot}` : ""}
                </p>
              </div>

              <div className="item-description-card">
                <p className="eyebrow">Item description</p>
                {isDetailLoading ? (
                  <p className="form-help">กำลังโหลดรายละเอียดไอเท็ม...</p>
                ) : selectedDetail?.description ? (
                  <p>{cleanDescription(selectedDetail.description)}</p>
                ) : (
                  <p className="form-help">ยังไม่มีคำอธิบายใน catalog</p>
                )}
              </div>

              <div className="form-grid">
                {selectedItem.isRefinable ? (
                  <label>
                    <span>Refine</span>
                    <input
                      inputMode="numeric"
                      max="20"
                      min="0"
                      onChange={(event) => setRefine(event.target.value)}
                      type="number"
                      value={refine}
                    />
                  </label>
                ) : null}
                <label>
                  <span>Server</span>
                  <select
                    onChange={(event) => setServer(event.target.value as ServerId)}
                    value={server}
                  >
                    <option value="chaos">Chaos</option>
                    <option value="thor">Thor</option>
                  </select>
                </label>
              </div>

              {selectedItem.canGrade ? (
                <label>
                  <span>Grade</span>
                  <select
                    onChange={(event) =>
                      setGrade(event.target.value as ItemGrade | "")
                    }
                    value={grade}
                  >
                    <option value="">ไม่มี Grade</option>
                    {ITEM_GRADES.map((itemGrade) => (
                      <option key={itemGrade} value={itemGrade}>
                        Grade {itemGrade}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {cardSelections.length > 0 ? (
                <div className="option-group-list">
                  {cardSelections.map((cardId, index) => (
                    <label key={index}>
                      <span>Card {index + 1}</span>
                      <select
                        onChange={(event) =>
                          setCardSelections((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? event.target.value
                                : entry,
                            ),
                          )
                        }
                        value={cardId}
                      >
                        <option value="">ไม่ใส่การ์ด</option>
                        {availableCards.map((card) => (
                          <option key={card.id} value={card.id}>
                            {card.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ) : null}

              {selectedTemplate?.groups.length ? (
                <div className="option-group-list">
                  {selectedTemplate.groups.map((group) => (
                    <label key={group.slot}>
                      <span>{group.label}</span>
                      <select
                        onChange={(event) =>
                          setEnchantSelections((current) => ({
                            ...current,
                            [group.slot]: event.target.value,
                          }))
                        }
                        value={enchantSelections[group.slot] ?? ""}
                      >
                        <option value="">ไม่เลือก</option>
                        {group.choices.map((choice) => (
                          <option key={choice.key} value={choice.key}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ) : null}

              {randomOptionPaths.length > 0 ? (
                <div className="option-group-list">
                  {randomOptionPaths.map((path, index) => (
                    <RandomOptionCascade
                      index={index}
                      key={index}
                      onChange={(nextPath) =>
                        setRandomOptionPaths((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? nextPath : entry,
                          ),
                        )
                      }
                      path={path}
                      tree={randomOptionTree}
                    />
                  ))}
                </div>
              ) : null}

              <label>
                <span>ราคา</span>
                <input
                  onChange={(event) => setPriceInput(event.target.value)}
                  placeholder="50m, 20 เอ็ม, 1.2b"
                  value={priceInput}
                />
                <small>
                  {priceInput
                    ? parsedPrice?.normalized ?? "รูปแบบราคาไม่ถูกต้อง"
                    : "ไม่กรอกราคาได้ ระบบจะถือว่า unknown"}
                </small>
              </label>

              <label>
                <span>Tags คั่นด้วย comma</span>
                <input
                  onChange={(event) => setTagInput(event.target.value)}
                  placeholder="ออฟเวท, รอซื้อ, Cross Impact"
                  value={tagInput}
                />
              </label>

              <label>
                <span>Note</span>
                <textarea
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="แหล่งราคา หรือรายละเอียดเพิ่มเติม"
                  rows={3}
                  value={note}
                />
              </label>

              <div className="form-actions">
                <button
                  className="secondary-button"
                  onClick={clearSelectedItem}
                  type="button"
                >
                  ยกเลิก
                </button>
                <button className="primary-button" disabled={isSaving} type="submit">
                  {isSaving ? "กำลังบันทึก..." : "บันทึก variant"}
                </button>
              </div>
            </form>
          ) : (
            <div className="editor-empty">
              <p className="eyebrow">Variant editor</p>
              <h2>เลือกไอเท็มจากตาราง</h2>
              <p>
                จากนั้นระบุ refine, enchant, ราคา และ tag
                ข้อมูลจะถูกเก็บในเครื่องนี้
              </p>
            </div>
          )}
        </div>

        <div className="panel saved-panel">
          <div className="saved-heading">
            <div>
              <p className="eyebrow">Saved locally</p>
              <h2>{knowledge.itemVariants.length} variants</h2>
            </div>
            <span>{knowledge.priceQuotes.length} prices</span>
          </div>
          <div className="saved-list">
            {savedRows.slice(0, 20).map(({ variant, item, quote, tags }) => (
              <article className="saved-card" key={variant.id}>
                <div>
                  <strong>{variant.customLabel ?? item?.name ?? variant.itemId}</strong>
                  <small>
                    {quote
                      ? `${formatCompactZeny(quote.priceZeny)} · ${quote.server}`
                      : "Unknown price"}
                  </small>
                </div>
                {tags.length > 0 ? (
                  <div className="tag-list">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setQuery(tag)}
                        type="button"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
            {savedRows.length === 0 ? (
              <div className="empty-state">
                ยังไม่มี variant ที่ตรงกับคำค้น ลองเพิ่มราคาแรกจากตาราง
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </section>
  );
}
