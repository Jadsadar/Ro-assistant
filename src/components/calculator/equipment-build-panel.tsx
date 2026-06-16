"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  loadCatalogItemDetail,
  loadCatalogMonsters,
  loadCatalogSearch,
  loadCatalogSkills,
} from "@/lib/catalog/client";
import type {
  CatalogClassSkills,
  CatalogItemDetail,
  CatalogMonster,
  CatalogSearchItem,
} from "@/lib/catalog/types";
import {
  ATTACK_ELEMENTS,
  CALCULATOR_CLASSES,
  DEFAULT_CHARACTER_STATS,
  type AttackElement,
} from "@/lib/calculator/metadata";
import type {
  CharacterStatKey,
  CharacterStats,
  EquipmentSlot,
  ServerId,
} from "@/lib/equipment/types";
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_RULES,
  cardPositionsForSlot,
} from "@/lib/equipment/types";
import {
  formatCompactZeny,
  parsePriceInput,
} from "@/lib/knowledge/price";
import {
  deleteBuild,
  loadKnowledgeSnapshot,
  saveBuild,
} from "@/lib/knowledge/repository";
import type {
  KnowledgeSnapshot,
  SavedBuild,
  SavedEquipmentSelection,
} from "@/lib/knowledge/types";

const STORAGE_KEY = "ro-assistant-equipment-draft-v3";
const DEFAULT_CLASS_ID = 12;

const EMPTY_KNOWLEDGE: KnowledgeSnapshot = {
  itemVariants: [],
  priceQuotes: [],
  tags: [],
  variantTags: [],
  ownedItems: [],
  savedBuilds: [],
};

const STAT_FIELDS: Array<{
  key: CharacterStatKey;
  label: string;
  min: number;
  max: number;
}> = [
  { key: "str", label: "STR", min: 1, max: 130 },
  { key: "agi", label: "AGI", min: 1, max: 130 },
  { key: "vit", label: "VIT", min: 1, max: 130 },
  { key: "int", label: "INT", min: 1, max: 130 },
  { key: "dex", label: "DEX", min: 1, max: 130 },
  { key: "luk", label: "LUK", min: 1, max: 130 },
  { key: "pow", label: "POW", min: 1, max: 110 },
  { key: "sta", label: "STA", min: 1, max: 110 },
  { key: "wis", label: "WIS", min: 1, max: 110 },
  { key: "spl", label: "SPL", min: 1, max: 110 },
  { key: "con", label: "CON", min: 1, max: 110 },
  { key: "crt", label: "CRT", min: 1, max: 110 },
];

const BASE_LEVEL_MAX = 275;
const JOB_LEVEL_MAX = 70;
const AMMO_SUB_TYPE_ID = 1024;

interface SlotDefinition {
  slot: EquipmentSlot;
  label: string;
}

interface SlotGroup {
  title: string;
  description: string;
  slots: SlotDefinition[];
}

const SLOT_GROUPS: SlotGroup[] = [
  {
    title: "Main Equipment",
    description: "เลือกอาวุธก่อน ถ้าเป็นอาวุธมือเดียวจะเปิดช่อง Shield",
    slots: [
      { slot: "weapon", label: "Weapon" },
      { slot: "shield", label: "Shield" },
    ],
  },
  {
    title: "Armor & Accessories",
    description: "ช่องสวมใส่ปกติที่ส่งผลต่อ stat และ damage",
    slots: [
      { slot: "headUpper", label: "Head Upper" },
      { slot: "headMiddle", label: "Head Middle" },
      { slot: "headLower", label: "Head Lower" },
      { slot: "armor", label: "Armor" },
      { slot: "garment", label: "Garment" },
      { slot: "boot", label: "Shoes" },
      { slot: "accLeft", label: "Accessory Left" },
      { slot: "accRight", label: "Accessory Right" },
      { slot: "pet", label: "Pet" },
    ],
  },
  {
    title: "Costume",
    description: "Costume และ costume enchant แยกช่องเหมือนเว็บเก่า",
    slots: [
      { slot: "costumeUpper", label: "Costume Upper" },
      { slot: "costumeEnchantUpper", label: "Upper Enchant" },
      { slot: "costumeMiddle", label: "Costume Middle" },
      { slot: "costumeEnchantMiddle", label: "Middle Enchant" },
      { slot: "costumeLower", label: "Costume Lower" },
      { slot: "costumeEnchantLower", label: "Lower Enchant" },
      { slot: "costumeGarment", label: "Costume Garment" },
      { slot: "costumeEnchantGarment", label: "Garment Enchant 1" },
      { slot: "costumeEnchantGarment2", label: "Garment Enchant 2" },
      { slot: "costumeEnchantGarment4", label: "Garment Enchant 4" },
    ],
  },
  {
    title: "Shadow Equipment",
    description: "แยกจาก Weapon/Armor ปกติและรองรับ Shadow Option",
    slots: [
      { slot: "shadowWeapon", label: "Shadow Weapon" },
      { slot: "shadowArmor", label: "Shadow Armor" },
      { slot: "shadowShield", label: "Shadow Shield" },
      { slot: "shadowBoot", label: "Shadow Shoes" },
      { slot: "shadowEarring", label: "Shadow Earring" },
      { slot: "shadowPendant", label: "Shadow Pendant" },
    ],
  },
];

type CalculatorEquipmentDraft = Partial<
  Record<EquipmentSlot, SavedEquipmentSelection>
>;

function parseStoredDraft(raw: string | null): CalculatorEquipmentDraft {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const validSlots = new Set<string>(EQUIPMENT_SLOTS);
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([slot, value]) =>
          validSlots.has(slot) &&
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value),
      ),
    ) as CalculatorEquipmentDraft;
  } catch {
    return {};
  }
}

function sanitizeEquipmentDraft(
  draft: CalculatorEquipmentDraft,
  catalog: CatalogSearchItem[],
): CalculatorEquipmentDraft {
  const itemById = new Map(catalog.map((item) => [item.id, item]));
  const sanitized = Object.fromEntries(
    Object.entries(draft).flatMap(([slot, selection]) => {
      const equipmentSlot = slot as EquipmentSlot;
      const item = selection.itemId ? itemById.get(selection.itemId) : undefined;
      if (!item?.equipSlots.includes(equipmentSlot)) return [];

      const allowedCardPositions = new Set<number>(
        cardPositionsForSlot(equipmentSlot),
      );
      const cardIds = (selection.cardIds ?? []).filter((cardId) => {
        const card = itemById.get(cardId);
        return (
          card?.itemTypeId === 6 &&
          card.compositionPos !== null &&
          allowedCardPositions.has(card.compositionPos)
        );
      });

      return [[equipmentSlot, { itemId: item.id, cardIds }]];
    }),
  ) as CalculatorEquipmentDraft;
  const weapon = sanitized.weapon?.itemId
    ? itemById.get(sanitized.weapon.itemId)
    : undefined;
  if (!weapon?.equipSlots.includes("leftWeapon")) {
    delete sanitized.shield;
  }
  return sanitized;
}

function cleanDescription(description: string): string {
  return description.replace(/\^[0-9a-fA-F]{6}/g, "").trim();
}

function itemImageUrl(item: CatalogSearchItem): string {
  return `/data/images/items/${item.id}.png`;
}

function monsterImageUrl(monster: CatalogMonster): string {
  return `/data/images/monsters/${monster.id}.png`;
}

function fallbackInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function normalizeStatsForFields(stats: CharacterStats): CharacterStats {
  return STAT_FIELDS.reduce(
    (nextStats, field) => ({
      ...nextStats,
      [field.key]: Math.min(
        field.max,
        Math.max(field.min, nextStats[field.key]),
      ),
    }),
    { ...stats },
  );
}

function isAmmoItem(item: CatalogSearchItem): boolean {
  return (
    item.equipSlots.includes("ammo") ||
    item.itemSubTypeId === AMMO_SUB_TYPE_ID ||
    /\barrow\b|bullet|ammo|cannon ball/i.test(
      `${item.name} ${item.itemType} ${item.aegisName}`,
    )
  );
}

function isBuffConsumable(item: CatalogSearchItem): boolean {
  if (item.category !== "consumables" || isAmmoItem(item)) return false;
  return /potion|booster|almighty|candy|bbq|cocktail|brisket|stew|salad|dish|food|elixir|celermine/i.test(
    `${item.name} ${item.aegisName} ${item.itemType}`,
  );
}

function classToken(name: string): string {
  return name.replace(/\s+/g, "");
}

function broadClassTokens(generation: 3 | 4 | "expanded"): string[] {
  if (generation === 4) return ["Only 4th", "4th"];
  if (generation === 3) return ["Only 3rd Cls", "3rd"];
  return ["Expanded", "Only Expanded"];
}

function itemMatchesClass(item: CatalogSearchItem, classId: number): boolean {
  const selectedClass = CALCULATOR_CLASSES.find((entry) => entry.id === classId);
  if (!selectedClass) return true;

  const usableClass = item.usableClass ?? [];
  const unusableClass = item.unusableClass ?? [];
  const token = classToken(selectedClass.name);
  if (unusableClass.includes(token)) return false;
  if (usableClass.length === 0) return true;

  return [
    token,
    "all",
    "All",
    "Every Job",
    ...broadClassTokens(selectedClass.generation),
  ].some((entry) => usableClass.includes(entry));
}

function sanitizeEquipmentForClass(
  draft: CalculatorEquipmentDraft,
  classId: number,
  catalog: CatalogSearchItem[],
): CalculatorEquipmentDraft {
  const itemById = new Map(catalog.map((item) => [item.id, item]));
  return Object.fromEntries(
    Object.entries(draft).filter(([, selection]) => {
      const item = selection.itemId ? itemById.get(selection.itemId) : undefined;
      return item ? itemMatchesClass(item, classId) : false;
    }),
  ) as CalculatorEquipmentDraft;
}

function ItemPreviewButton({ item }: { item: CatalogSearchItem | undefined }) {
  const [detail, setDetail] = useState<CatalogItemDetail | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  function openPreview(): void {
    if (!item) return;
    if (detail) return;
    void loadCatalogItemDetail(item).then(setDetail).catch(() => setDetail(null));
  }

  function togglePreview(): void {
    if (!item) return;
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) openPreview();
  }

  if (!item) {
    return (
      <button className="preview-eye" disabled type="button">
        👁
      </button>
    );
  }

  return (
    <span className="preview-wrap">
      <button
        aria-expanded={isOpen}
        className="preview-eye"
        onClick={togglePreview}
        type="button"
      >
        👁
      </button>
      {isOpen ? (
        <span className="item-preview-popover" role="tooltip">
          <strong>{item.name}</strong>
          <span>#{item.id} · {item.itemType}</span>
          <span>
            {detail?.description
              ? cleanDescription(detail.description)
              : "กำลังโหลดคำอธิบาย..."}
          </span>
        </span>
      ) : null}
    </span>
  );
}

interface NumericDropdownProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function NumericDropdown({
  label,
  value,
  min,
  max,
  onChange,
}: NumericDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const options = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, index) => min + index),
    [max, min],
  );

  return (
    <div className="numeric-dropdown-field">
      <span>{label}</span>
      <div
        className="numeric-dropdown"
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (
            nextTarget instanceof Node &&
            event.currentTarget.contains(nextTarget)
          ) {
            return;
          }
          setIsOpen(false);
        }}
      >
        <button
          aria-expanded={isOpen}
          className="numeric-dropdown-button"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {value}
        </button>
        {isOpen ? (
          <div className="numeric-dropdown-menu" role="listbox" tabIndex={-1}>
            {options.map((option) => (
              <button
                aria-selected={option === value}
                className={
                  option === value
                    ? "numeric-dropdown-option active"
                    : "numeric-dropdown-option"
                }
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                onMouseDown={(event) => event.preventDefault()}
                role="option"
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function EquipmentBuildPanel() {
  const [catalog, setCatalog] = useState<CatalogSearchItem[]>([]);
  const [monsters, setMonsters] = useState<CatalogMonster[]>([]);
  const [skillCatalog, setSkillCatalog] = useState<CatalogClassSkills[]>([]);
  const [knowledge, setKnowledge] =
    useState<KnowledgeSnapshot>(EMPTY_KNOWLEDGE);
  const [equipment, setEquipment] = useState<CalculatorEquipmentDraft>({});
  const [server, setServer] = useState<ServerId>("chaos");
  const [buildId, setBuildId] = useState("");
  const [buildName, setBuildName] = useState("");
  const [classId, setClassId] = useState(DEFAULT_CLASS_ID);
  const [baseLevel, setBaseLevel] = useState(200);
  const [jobLevel, setJobLevel] = useState(70);
  const [skillId, setSkillId] = useState("");
  const [skillLevel, setSkillLevel] = useState(1);
  const [propertyAtk, setPropertyAtk] =
    useState<AttackElement>("Neutral");
  const [monsterId, setMonsterId] = useState(0);
  const [monsterQuery, setMonsterQuery] = useState("");
  const [stats, setStats] = useState<CharacterStats>({
    ...normalizeStatsForFields(DEFAULT_CHARACTER_STATS),
  });
  const [targetDamageInput, setTargetDamageInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [selectedConsumableIds, setSelectedConsumableIds] = useState<number[]>(
    [],
  );
  const [isSkillPanelOpen, setIsSkillPanelOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadCatalogSearch(),
      loadCatalogMonsters(),
      loadCatalogSkills(),
      loadKnowledgeSnapshot(),
    ])
      .then(([items, monsterRecords, skills, snapshot]) => {
        if (cancelled) return;
        setCatalog(items);
        setMonsters(monsterRecords);
        setSkillCatalog(skills);
        setKnowledge(snapshot);
        setEquipment(
          sanitizeEquipmentDraft(
            parseStoredDraft(localStorage.getItem(STORAGE_KEY)),
            items,
          ),
        );
        const initialSkill = skills
          .find((record) => record.classId === DEFAULT_CLASS_ID)
          ?.skills[0]?.choices[0];
        if (initialSkill) {
          setSkillId(initialSkill.value);
          setSkillLevel(initialSkill.level);
        }
        setIsReady(true);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "โหลด Equipment Build ไม่สำเร็จ",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(equipment));
  }, [equipment, isReady]);

  const itemById = useMemo(
    () => new Map(catalog.map((item) => [item.id, item])),
    [catalog],
  );
  const selectedWeapon = equipment.weapon?.itemId
    ? itemById.get(equipment.weapon.itemId)
    : undefined;
  const canUseShield = selectedWeapon?.equipSlots.includes("leftWeapon") === true;
  const itemsBySlot = useMemo(() => {
    const result = new Map<EquipmentSlot, CatalogSearchItem[]>();
    for (const group of SLOT_GROUPS) {
      for (const definition of group.slots) {
        result.set(
          definition.slot,
          catalog
            .filter(
              (item) =>
                item.equipSlots.includes(definition.slot) &&
                itemMatchesClass(item, classId),
            )
            .sort((left, right) =>
              left.name.localeCompare(right.name, "th"),
            )
        );
      }
    }
    return result;
  }, [catalog, classId]);
  const ammoItems = useMemo(
    () =>
      catalog
        .filter((item) => isAmmoItem(item) && itemMatchesClass(item, classId))
        .sort((left, right) => left.name.localeCompare(right.name, "th")),
    [catalog, classId],
  );
  const buffConsumables = useMemo(
    () =>
      catalog
        .filter(
          (item) => isBuffConsumable(item) && itemMatchesClass(item, classId),
        )
        .sort((left, right) => left.name.localeCompare(right.name, "th"))
        .slice(0, 160),
    [catalog, classId],
  );
  const cardsBySlot = useMemo(() => {
    const result = new Map<EquipmentSlot, CatalogSearchItem[]>();
    for (const slot of EQUIPMENT_SLOTS) {
      const positions = new Set<number>(cardPositionsForSlot(slot));
      result.set(
        slot,
        catalog
          .filter(
            (item) =>
              item.itemTypeId === 6 &&
              item.compositionPos !== null &&
              positions.has(item.compositionPos),
          )
          .sort((left, right) => left.name.localeCompare(right.name, "th")),
      );
    }
    return result;
  }, [catalog]);
  const normalizedMonsterQuery = monsterQuery.trim().toLocaleLowerCase("th");
  const visibleMonsters = useMemo(
    () => {
      const filtered = monsters
        .filter(
          (monster) =>
            !normalizedMonsterQuery ||
            [
              monster.id,
              monster.name,
              monster.dbname,
              monster.spawn,
              monster.stats.raceName,
              monster.stats.elementName,
            ]
              .join(" ")
              .toLocaleLowerCase("th")
              .includes(normalizedMonsterQuery),
        )
        .slice(0, 100);
      const selected = monsters.find((monster) => monster.id === monsterId);
      return selected && !filtered.some((monster) => monster.id === selected.id)
        ? [selected, ...filtered]
        : filtered;
    },
    [monsterId, monsters, normalizedMonsterQuery],
  );
  const classSkills = useMemo(
    () => {
      const choices =
        skillCatalog
        .find((record) => record.classId === classId)
        ?.skills.flatMap((skill) =>
          skill.choices.map((choice) => ({
            ...choice,
            skillName: skill.name,
          })),
        ) ?? [];
      return [
        ...new Map(choices.map((choice) => [choice.value, choice])).values(),
      ];
    },
    [classId, skillCatalog],
  );
  const selectedSkillExists = classSkills.some(
    (choice) => choice.value === skillId,
  );

  const selectedRows = Object.entries(equipment).flatMap(
    ([slot, selection]) => {
      const item = selection.itemId ? itemById.get(selection.itemId) : undefined;
      if (!item) return [];
      return [{ slot: slot as EquipmentSlot, selection, item }];
    },
  );
  const parsedBudget = budgetInput ? parsePriceInput(budgetInput) : null;
  const targetDamage = targetDamageInput
    ? Number(targetDamageInput.replaceAll(",", ""))
    : undefined;
  const selectedMonster = monsters.find((monster) => monster.id === monsterId);

  function resetBuild(): void {
    setBuildId("");
    setBuildName("");
    setEquipment({});
    setClassId(DEFAULT_CLASS_ID);
    const firstSkill = skillCatalog
      .find((record) => record.classId === DEFAULT_CLASS_ID)
      ?.skills[0]?.choices[0];
    setBaseLevel(200);
    setJobLevel(70);
    setSkillId(firstSkill?.value ?? "");
    setSkillLevel(firstSkill?.level ?? 1);
    setPropertyAtk("Neutral");
    setMonsterId(0);
    setMonsterQuery("");
    setStats(normalizeStatsForFields(DEFAULT_CHARACTER_STATS));
    setTargetDamageInput("");
    setBudgetInput("");
    setSelectedConsumableIds([]);
    setIsSkillPanelOpen(false);
    setError("");
    setStatus("");
  }

  function applyClassChange(nextClassId: number): void {
    const firstSkill = skillCatalog
      .find((record) => record.classId === nextClassId)
      ?.skills[0]?.choices[0];
    setClassId(nextClassId);
    setSkillId(firstSkill?.value ?? "");
    setSkillLevel(firstSkill?.level ?? 1);
    setEquipment((current) =>
      sanitizeEquipmentDraft(
        sanitizeEquipmentForClass(current, nextClassId, catalog),
        catalog,
      ),
    );
  }

  function loadBuild(build: SavedBuild): void {
    setBuildId(build.id);
    setBuildName(build.name);
    setClassId(build.classId);
    setBaseLevel(build.baseLevel);
    setJobLevel(build.jobLevel);
    setSkillId(build.skillId);
    setSkillLevel(build.skillLevel);
    setPropertyAtk(build.propertyAtk);
    setMonsterId(build.monsterId);
    setServer(build.server);
    setStats(normalizeStatsForFields(build.stats));
    setEquipment(
      sanitizeEquipmentDraft(
        Object.fromEntries(
          Object.entries(build.equipment).filter(
            (entry): entry is [string, SavedEquipmentSelection] =>
              typeof entry[1] === "object" &&
              entry[1] !== null &&
              !Array.isArray(entry[1]),
          ),
        ),
        catalog,
      ),
    );
    setTargetDamageInput(
      build.targetDamage === undefined ? "" : String(build.targetDamage),
    );
    setBudgetInput(
      build.budgetZeny === undefined ? "" : String(build.budgetZeny),
    );
    setSelectedConsumableIds(build.consumableIds);
    setStatus(`โหลด build: ${build.name}`);
    setError("");
  }

  async function saveCurrentBuild(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const selectedClass = CALCULATOR_CLASSES.find(
      (entry) => entry.id === classId,
    );
    if (!buildName.trim()) {
      setError("กรุณาระบุชื่อ build");
      return;
    }
    if (!selectedClass || !skillId.trim() || monsterId <= 0) {
      setError("กรุณาเลือกอาชีพ ระบุ Skill ID และเลือกมอนสเตอร์");
      return;
    }
    if (
      !Number.isInteger(baseLevel) ||
      baseLevel < 1 ||
      baseLevel > 275 ||
      !Number.isInteger(jobLevel) ||
      jobLevel < 1 ||
      jobLevel > 70 ||
      !Number.isInteger(skillLevel) ||
      skillLevel < 1 ||
      skillLevel > 20
    ) {
      setError("Level, Job Level หรือ Skill Level อยู่นอกช่วงที่รองรับ");
      return;
    }
    if (budgetInput && !parsedBudget) {
      setError("รูปแบบ budget ไม่ถูกต้อง เช่น 500m หรือ 1.2b");
      return;
    }
    if (
      targetDamage !== undefined &&
      (!Number.isFinite(targetDamage) || targetDamage <= 0)
    ) {
      setError("Target damage ต้องเป็นตัวเลขมากกว่า 0");
      return;
    }
    for (const field of STAT_FIELDS) {
      const value = stats[field.key];
      if (
        !Number.isInteger(value) ||
        value < field.min ||
        value > field.max
      ) {
        setError(`${field.label} ต้องอยู่ระหว่าง ${field.min}-${field.max}`);
        return;
      }
    }

    setIsSaving(true);
    setError("");
    const now = new Date().toISOString();
    const existing = knowledge.savedBuilds.find(
      (build) => build.id === buildId,
    );
    const build: SavedBuild = {
      id: existing?.id ?? crypto.randomUUID(),
      name: buildName.trim(),
      classId,
      className: selectedClass.name,
      baseLevel,
      jobLevel,
      skillId: skillId.trim(),
      skillLevel,
      propertyAtk,
      monsterId,
      server,
      equipment,
      stats,
      skillLevels: {
        [skillId.trim()]: skillLevel,
      },
      buffLevels: existing?.buffLevels ?? {},
      consumableIds: selectedConsumableIds,
      targetDamage,
      budgetZeny: parsedBudget?.value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await saveBuild(build);
      setKnowledge(await loadKnowledgeSnapshot());
      setBuildId(build.id);
      setStatus(`บันทึก build: ${build.name}`);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "บันทึก build ไม่สำเร็จ",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeBuild(build: SavedBuild): Promise<void> {
    if (!window.confirm(`ลบ build "${build.name}" หรือไม่?`)) return;
    try {
      await deleteBuild(build.id);
      setKnowledge(await loadKnowledgeSnapshot());
      if (buildId === build.id) resetBuild();
      setStatus(`ลบ build: ${build.name}`);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "ลบ build ไม่สำเร็จ",
      );
    }
  }

  return (
    <section className="equipment-builder">
      <form className="calculator-input panel" onSubmit={saveCurrentBuild}>
        <header className="calculator-input-heading">
          <div>
            <p className="eyebrow">Build Input</p>
            <h2>Character, Skill และ Target</h2>
            <p>
              รายการอาชีพและสกิลสร้างจาก class instances ของ calculator เดิม
              โดยตรง
            </p>
          </div>
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={resetBuild}
              type="button"
            >
              New build
            </button>
            <button
              className="primary-button"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Saving..." : "Save build"}
            </button>
          </div>
        </header>

        <div className="calculator-target-layout">
          <div className="calculator-left-stack">
            <div className="calculator-field-grid">
          <label>
            <span>Build Name</span>
            <input
              onChange={(event) => setBuildName(event.target.value)}
              placeholder="เช่น Cross Impact งบ 1b"
              value={buildName}
            />
          </label>
          <label>
            <span>Job</span>
            <select
              onChange={(event) => applyClassChange(Number(event.target.value))}
              value={classId}
            >
              {CALCULATOR_CLASSES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <NumericDropdown
            label="Base Level"
            max={BASE_LEVEL_MAX}
            min={1}
            onChange={setBaseLevel}
            value={baseLevel}
          />
          <NumericDropdown
            label="Job Level"
            max={JOB_LEVEL_MAX}
            min={1}
            onChange={setJobLevel}
            value={jobLevel}
          />
          <label>
            <span>Offensive Skill</span>
            <select
              disabled={classSkills.length === 0}
              onChange={(event) => {
                const choice = classSkills.find(
                  (entry) => entry.value === event.target.value,
                );
                setSkillId(event.target.value);
                setSkillLevel(choice?.level ?? 1);
              }}
              value={skillId}
            >
              {!selectedSkillExists && skillId ? (
                <option value={skillId}>{skillId}</option>
              ) : null}
              {classSkills.map((choice) => (
                <option
                  key={`${choice.skillName}:${choice.value}`}
                  value={choice.value}
                >
                  {choice.label}
                </option>
              ))}
            </select>
            <small>
              Calculator value: {skillId || "ยังไม่มี skill metadata"}
            </small>
          </label>
          <label>
            <span>Attack Element</span>
            <select
              onChange={(event) =>
                setPropertyAtk(event.target.value as AttackElement)
              }
              value={propertyAtk}
            >
              {ATTACK_ELEMENTS.map((element) => (
                <option key={element} value={element}>
                  {element}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Target Damage</span>
            <input
              inputMode="numeric"
              min="1"
              onChange={(event) => setTargetDamageInput(event.target.value)}
              placeholder="1000000"
              type="number"
              value={targetDamageInput}
            />
          </label>
          <label>
            <span>Budget</span>
            <input
              onChange={(event) => setBudgetInput(event.target.value)}
              placeholder="500m หรือ 1.2b"
              value={budgetInput}
            />
            <small>{parsedBudget?.normalized ?? "ไม่จำกัดงบ"}</small>
          </label>
            </div>
          </div>

          <aside className="calculator-side-stack">
            <section className="side-panel buff-panel">
              <div>
                <p className="eyebrow">Buff Window</p>
                <h2>อาหาร ยา Ammo และบัพ</h2>
              </div>
              <label>
                <span>Ammo</span>
                <div className="select-with-preview">
                  <select
                    onChange={(event) =>
                      setEquipment((current) => {
                        const next = { ...current };
                        const itemId = Number(event.target.value);
                        if (Number.isInteger(itemId) && itemId > 0) {
                          next.ammo = { itemId, cardIds: [] };
                        } else {
                          delete next.ammo;
                        }
                        return next;
                      })
                    }
                    value={equipment.ammo?.itemId ?? ""}
                  >
                    <option value="">ไม่ใช้ Ammo</option>
                    {ammoItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        #{item.id} {item.name}
                      </option>
                    ))}
                  </select>
                  <ItemPreviewButton
                    item={
                      equipment.ammo?.itemId
                        ? itemById.get(equipment.ammo.itemId)
                        : undefined
                    }
                  />
                </div>
              </label>
              <label>
                <span>เพิ่มอาหาร/ยา</span>
                <select
                  onChange={(event) => {
                    const itemId = Number(event.target.value);
                    if (!Number.isInteger(itemId) || itemId <= 0) return;
                    setSelectedConsumableIds((current) =>
                      current.includes(itemId) ? current : [...current, itemId],
                    );
                    event.target.value = "";
                  }}
                  value=""
                >
                  <option value="">เลือก potion, booster, food</option>
                  {buffConsumables.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id} {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="buff-chip-list">
                {selectedConsumableIds.map((itemId) => {
                  const item = itemById.get(itemId);
                  return (
                    <span className="buff-chip" key={itemId}>
                      {item?.name ?? `Item ${itemId}`}
                      <button
                        onClick={() =>
                          setSelectedConsumableIds((current) =>
                            current.filter((entry) => entry !== itemId),
                          )
                        }
                        type="button"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                {selectedConsumableIds.length === 0 ? (
                  <small>ยังไม่ได้เลือกอาหารหรือยา</small>
                ) : null}
              </div>
            </section>

            <section className="side-panel target-panel">
            <div>
              <p className="eyebrow">Target Monster</p>
              <h2>เป้าหมายคำนวณดาเมจ</h2>
            </div>
            <div className="monster-picker">
              <label>
                <span>ค้นหามอนสเตอร์</span>
                <input
                  onChange={(event) => setMonsterQuery(event.target.value)}
                  placeholder="ชื่อ, ID, ธาตุ, เผ่า หรือแผนที่"
                  type="search"
                  value={monsterQuery}
                />
              </label>
              <label>
                <span>Target Monster</span>
                <select
                  onChange={(event) => setMonsterId(Number(event.target.value))}
                  value={monsterId}
                >
                  <option value="0">เลือกมอนสเตอร์</option>
                  {visibleMonsters.map((monster) => (
                    <option key={monster.id} value={monster.id}>
                      #{monster.id} {monster.name} · Lv.{monster.stats.level} ·{" "}
                      {monster.stats.elementName} · {monster.stats.raceName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {selectedMonster ? (
              <div className="monster-card">
                <span className="catalog-thumb monster-thumb">
                  <Image
                    alt={selectedMonster.name}
                    height={58}
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                    src={monsterImageUrl(selectedMonster)}
                    unoptimized
                    width={58}
                  />
                  <span>{fallbackInitials(selectedMonster.name)}</span>
                </span>
                <div>
                  <strong>{selectedMonster.name}</strong>
                  <small>
                    #{selectedMonster.id} · Lv.{selectedMonster.stats.level} ·{" "}
                    {selectedMonster.stats.elementName} ·{" "}
                    {selectedMonster.stats.raceName}
                  </small>
                  <small>
                    HP {selectedMonster.stats.health.toLocaleString("en-US")} ·{" "}
                    {selectedMonster.stats.scaleName}
                  </small>
                </div>
              </div>
            ) : (
              <div className="empty-state">เลือกมอนสเตอร์เพื่อใช้เป็นเป้าดาเมจ</div>
            )}
            <div className="damage-preview">
              <span>Damage engine</span>
              <strong>รอ port สูตรจากเว็บเก่า</strong>
              <small>
                ตอนนี้ UI ส่ง class, skill, stats, equipment, cards และ monster
                พร้อมแล้ว แต่ยังไม่คำนวณเลขปลอม
              </small>
            </div>
            </section>

            <section className="side-panel skill-upgrade-panel">
              <button
                className="skill-toggle-button"
                onClick={() => setIsSkillPanelOpen((current) => !current)}
                type="button"
              >
                <span>
                  <span className="eyebrow">Skill Upgrade</span>
                  <strong>การอัพสกิลและบัพสกิล</strong>
                </span>
                <span>{isSkillPanelOpen ? "ปิด" : "เปิด"}</span>
              </button>
              {isSkillPanelOpen ? (
                <div className="skill-upgrade-body">
                  <label>
                    <span>Selected Skill Level</span>
                    <input
                      max="20"
                      min="1"
                      onChange={(event) =>
                        setSkillLevel(Number(event.target.value))
                      }
                      type="number"
                      value={skillLevel}
                    />
                  </label>
                  <div className="skill-choice-list">
                    {classSkills.slice(0, 80).map((choice) => (
                      <button
                        className={
                          choice.value === skillId
                            ? "skill-choice active"
                            : "skill-choice"
                        }
                        key={`${choice.skillName}:${choice.value}`}
                        onClick={() => {
                          setSkillId(choice.value);
                          setSkillLevel(choice.level);
                        }}
                        type="button"
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                  <small>
                    รายการนี้ดึงจาก skill catalog ของเว็บเก่า และปิดไว้ก่อนเพราะ
                    จำนวนสกิลเยอะ
                  </small>
                </div>
              ) : null}
            </section>
          </aside>
        </div>

        <fieldset className="stat-fieldset">
          <legend>Character Stats</legend>
          <div className="stat-grid">
            {STAT_FIELDS.map((field) => (
              <NumericDropdown
                key={field.key}
                label={field.label}
                max={field.max}
                min={field.min}
                onChange={(value) =>
                  setStats((current) => ({
                    ...current,
                    [field.key]: value,
                  }))
                }
                value={stats[field.key]}
              />
            ))}
          </div>
        </fieldset>

        {status ? <div className="success-banner">{status}</div> : null}
        {error ? <div className="error-banner">{error}</div> : null}
      </form>

      <div className="equipment-toolbar panel">
        <div>
          <p className="eyebrow">Equipment Draft</p>
          <h2>เลือกอุปกรณ์จาก catalog ตามช่องตัวละคร</h2>
          <p>
            Dropdown จะแสดง item ทุกชิ้นที่เข้ากับ slot และแยกการ์ดตามตำแหน่ง
            เหมือนแนว calculator เดิม
          </p>
        </div>
        <label>
          <span>Price Server</span>
          <select
            onChange={(event) => setServer(event.target.value as ServerId)}
            value={server}
          >
            <option value="chaos">Chaos</option>
            <option value="thor">Thor</option>
          </select>
        </label>
        <button
          className="secondary-button"
          onClick={() => setEquipment({})}
          type="button"
        >
          Clear build
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="equipment-summary panel">
        <span>
          Selected <strong>{selectedRows.length}</strong>
        </span>
        <span>
          Cards <strong>
            {selectedRows.reduce(
              (sum, row) =>
                sum +
                (row.selection.cardIds?.filter((cardId) => cardId > 0)
                  .length ?? 0),
              0,
            )}
          </strong>
        </span>
        <span>
          Catalog items <strong>{catalog.length.toLocaleString("en-US")}</strong>
        </span>
        {parsedBudget ? (
          <span>
            Budget note <strong>{formatCompactZeny(parsedBudget.value)}</strong>
          </span>
        ) : null}
      </div>

      {SLOT_GROUPS.map((group) => (
        <section className="equipment-section panel" key={group.title}>
          <header>
            <div>
              <h2>{group.title}</h2>
              <p>{group.description}</p>
            </div>
          </header>
          <div className="equipment-slot-grid">
            {group.slots.map((definition) => {
              if (definition.slot === "shield" && !canUseShield) return null;
              const items = itemsBySlot.get(definition.slot) ?? [];
              const selection = equipment[definition.slot] ?? {};
              const selectedItem = selection.itemId
                ? itemById.get(selection.itemId)
                : undefined;
              const cardCount = selectedItem
                ? Math.min(
                    selectedItem.slots,
                    EQUIPMENT_SLOT_RULES[definition.slot].maxCards,
                  )
                : 0;
              const cards = cardsBySlot.get(definition.slot) ?? [];
              return (
                <div className="equipment-slot" key={definition.slot}>
                  <span>{definition.label}</span>
                  <div className="select-with-preview">
                    <select
                      disabled={!isReady || items.length === 0}
                      onChange={(event) =>
                        setEquipment((current) => {
                          const next = { ...current };
                          const itemId = Number(event.target.value);
                          const nextItem = itemById.get(itemId);
                          if (Number.isInteger(itemId) && itemId > 0) {
                            if (!nextItem || !itemMatchesClass(nextItem, classId)) {
                              return next;
                            }
                            next[definition.slot] = {
                              itemId,
                              cardIds: [],
                            };
                            if (definition.slot === "weapon") {
                              if (!nextItem.equipSlots.includes("leftWeapon")) {
                                delete next.shield;
                              }
                            }
                          } else {
                            delete next[definition.slot];
                            if (definition.slot === "weapon") {
                              delete next.shield;
                            }
                          }
                          return next;
                        })
                      }
                      value={selection.itemId ?? ""}
                    >
                      <option value="">
                        {items.length > 0
                          ? "ไม่สวมใส่"
                          : "ยังไม่มี item สำหรับ slot นี้"}
                      </option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          #{item.id} {item.name}
                        </option>
                      ))}
                    </select>
                    <ItemPreviewButton item={selectedItem} />
                  </div>
                  {selectedItem ? (
                    <div className="selected-item-strip">
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
                      <small>
                        {selectedItem.itemType} · {selectedItem.slots} slots
                      </small>
                    </div>
                  ) : null}
                  {Array.from({ length: cardCount }, (_, index) => {
                    const selectedCardId = selection.cardIds?.[index] ?? 0;
                    const selectedCard = selectedCardId
                      ? itemById.get(selectedCardId)
                      : undefined;
                    return (
                      <div
                        className="select-with-preview card-select-row"
                        key={index}
                      >
                        <select
                          onChange={(event) => {
                            const cardId = Number(event.target.value);
                            setEquipment((current) => {
                              const currentSelection =
                                current[definition.slot] ?? {};
                              const nextCards = [
                                ...(currentSelection.cardIds ?? []),
                              ];
                              if (Number.isInteger(cardId) && cardId > 0) {
                                nextCards[index] = cardId;
                              } else {
                                nextCards[index] = 0;
                              }
                              return {
                                ...current,
                                [definition.slot]: {
                                  ...currentSelection,
                                  cardIds: nextCards,
                                },
                              };
                            });
                          }}
                          value={selectedCardId || ""}
                        >
                          <option value="">ไม่ใส่ Card {index + 1}</option>
                          {cards.map((card) => (
                            <option key={card.id} value={card.id}>
                              #{card.id} {card.name}
                            </option>
                          ))}
                        </select>
                        <ItemPreviewButton item={selectedCard} />
                      </div>
                    );
                  })}
                  <small>
                    {selectedItem
                      ? `${cardCount} card slots · ${server}`
                      : `${items.length} catalog items`}
                  </small>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="panel saved-builds">
        <header>
          <div>
            <p className="eyebrow">Saved Locally</p>
            <h2>{knowledge.savedBuilds.length} builds</h2>
          </div>
        </header>
        <div className="saved-build-list">
          {knowledge.savedBuilds
            .slice()
            .sort((left, right) =>
              right.updatedAt.localeCompare(left.updatedAt),
            )
            .map((build) => (
              <article key={build.id}>
                <div>
                  <strong>{build.name}</strong>
                  <small>
                    {build.className ?? build.classId} · {build.skillId} ·{" "}
                    {build.server}
                  </small>
                </div>
                <div className="saved-build-actions">
                  <button
                    className="secondary-button"
                    onClick={() => loadBuild(build)}
                    type="button"
                  >
                    Load
                  </button>
                  <button
                    className="secondary-button danger-button"
                    onClick={() => void removeBuild(build)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          {knowledge.savedBuilds.length === 0 ? (
            <div className="empty-state">ยังไม่มี Saved Build</div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
