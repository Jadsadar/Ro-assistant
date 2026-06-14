"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadCatalogItemOptions,
  loadCatalogManifest,
  loadCatalogSearch,
} from "@/lib/catalog/client";
import type {
  CatalogItemOptions,
  CatalogItemOptionsIndex,
  CatalogManifest,
  CatalogSearchItem,
} from "@/lib/catalog/types";
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

const MAX_VISIBLE_ITEMS = 80;

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

export function KnowledgeDashboard() {
  const [manifest, setManifest] = useState<CatalogManifest | null>(null);
  const [catalog, setCatalog] = useState<CatalogSearchItem[]>([]);
  const [itemOptions, setItemOptions] = useState<CatalogItemOptionsIndex>({});
  const [knowledge, setKnowledge] =
    useState<KnowledgeSnapshot>(EMPTY_KNOWLEDGE);
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState("all");
  const [selectedItem, setSelectedItem] =
    useState<CatalogSearchItem | null>(null);
  const [refine, setRefine] = useState("0");
  const [enchantSelections, setEnchantSelections] = useState<
    Record<number, string>
  >({});
  const [randomOptionInputs, setRandomOptionInputs] = useState<string[]>([]);
  const [optionLabel, setOptionLabel] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [server, setServer] = useState("Freya");
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

  const slots = useMemo(
    () =>
      [...new Set(catalog.map((item) => item.slot).filter(Boolean) as string[])].sort(
        (left, right) => left.localeCompare(right),
      ),
    [catalog],
  );

  const normalizedQuery = normalizeSearchText(query);
  const filteredItems = useMemo(() => {
    const tokens = normalizedQuery.split(" ").filter(Boolean);
    return catalog
      .filter((item) => slot === "all" || item.slot === slot)
      .filter(
        (item) =>
          tokens.length === 0 ||
          tokens.every((token) => item.searchable.includes(token)),
      )
      .slice(0, MAX_VISIBLE_ITEMS);
  }, [catalog, normalizedQuery, slot]);

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

  function chooseItem(item: CatalogSearchItem): void {
    setSelectedItem(item);
    setRefine("0");
    setEnchantSelections({});
    setRandomOptionInputs(
      Array.from(
        { length: itemOptions[item.id]?.randomOptionCount ?? 0 },
        () => "",
      ),
    );
    setOptionLabel("");
    setPriceInput("");
    setTagInput("");
    setNote("");
    setError("");
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
          unit: "text" as const,
          label: choice.label,
        };
      })
      .filter(Boolean) as ItemOption[];

    const randomOptions: ItemOption[] = [
      ...randomOptionInputs
        .map((value) => value.trim())
        .filter(Boolean)
        .map((label, index) => ({
          slot: index,
          key: `random_${index + 1}`,
          unit: "text" as const,
          label,
        })),
      ...(optionLabel.trim()
        ? [
            {
              key: "custom",
              unit: "text" as const,
              label: optionLabel.trim(),
            },
          ]
        : []),
    ];

    const variantBase = {
      itemId: selectedItem.id,
      refine: refineValue,
      cards: [],
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
          server: server.trim() || "Unknown",
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
      setSelectedItem(null);
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="เช่น Temporal Dex Boots, Volar, Hawkeye"
              type="search"
              value={query}
            />
          </label>
          <label>
            <span>Slot</span>
            <select onChange={(event) => setSlot(event.target.value)} value={slot}>
              <option value="all">ทุก slot</option>
              {slots.map((slotName) => (
                <option key={slotName} value={slotName}>
                  {slotName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="catalog-meta">
          <span>{status || "Catalog unavailable"}</span>
          <span>
            Version {manifest?.catalogVersion ?? "—"} · แสดงไม่เกิน{" "}
            {MAX_VISIBLE_ITEMS} รายการ
          </span>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="item-table" role="table" aria-label="รายการไอเท็ม">
          <div className="item-row item-header" role="row">
            <span>Item</span>
            <span>Type / Slot</span>
            <span>Action</span>
          </div>
          {filteredItems.map((item) => (
            <div className="item-row" role="row" key={item.id}>
              <span>
                <strong>{item.name}</strong>
                <small>#{item.id} · {item.aegisName}</small>
              </span>
              <span>
                {item.itemType}
                <small>{item.slot ?? "ไม่มี slot"} · {item.slots} ช่อง</small>
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
      </div>

      <aside className="knowledge-side">
        <div className="panel sticky-panel">
          {selectedItem ? (
            <form className="variant-form" onSubmit={saveEntry}>
              <div>
                <p className="eyebrow">New variant</p>
                <h2>{selectedItem.name}</h2>
                <p className="form-help">Item ID {selectedItem.id}</p>
                <p className="form-help">
                  {selectedItem.itemType}
                  {selectedItem.slot ? ` · ${selectedItem.slot}` : ""}
                </p>
              </div>

              <div className="form-grid">
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
                <label>
                  <span>Server</span>
                  <input
                    onChange={(event) => setServer(event.target.value)}
                    value={server}
                  />
                </label>
              </div>

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

              {randomOptionInputs.length > 0 ? (
                <div className="option-group-list">
                  {randomOptionInputs.map((value, index) => (
                    <label key={index}>
                      <span>Random Option {index + 1}</span>
                      <input
                        onChange={(event) =>
                          setRandomOptionInputs((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index ? event.target.value : entry,
                            ),
                          )
                        }
                        placeholder="ระบุ option ตามของจริง"
                        value={value}
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              <label>
                <span>ออฟชันเพิ่มเติม / ข้อมูลที่ยังไม่มีในลิสต์</span>
                <input
                  onChange={(event) => setOptionLabel(event.target.value)}
                  placeholder="เช่น INT +5 หรือ ออฟเวท"
                  value={optionLabel}
                />
              </label>

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
                  onClick={() => setSelectedItem(null)}
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
