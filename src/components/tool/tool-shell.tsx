"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadCatalogHpSpTable,
  loadCatalogItemOptions,
  loadCatalogMonsters,
  loadCatalogSearch,
  loadCatalogSkills,
} from "@/lib/catalog/client";
import { CALCULATOR_CLASSES, DEFAULT_CHARACTER_STATS } from "@/lib/calculator/metadata";
import {
  BASE_STAT_KEYS,
  EQUIPMENT_SLOTS,
  TRAIT_STAT_KEYS,
  type CharacterStatKey,
  type EquipmentSlot,
} from "@/lib/equipment/types";
import { searchItems, type ItemSearchSort } from "@/lib/tools/item-search";
import {
  evaluateSlotCandidates,
  type SlotEvaluation,
  type SlotSort,
} from "@/lib/tools/slot-evaluator";
import { createDamageCalculationInput } from "@/components/calculator-v2/damage-adapter";
import type {
  CalculatorV2Data,
  CalculatorV2Selection,
} from "@/components/calculator-v2/types";
import type { CatalogSearchItem } from "@/lib/catalog/types";
import styles from "./tool.module.css";

const EMPTY_DATA: CalculatorV2Data = {
  classes: [],
  items: [],
  options: {},
  monsters: [],
  hpSpTable: [],
};

/**
 * Slots worth optimising. The costume-enchant slots are excluded because they
 * hold enchants rather than gear, which this tool does not rank yet.
 */
const TARGET_SLOTS: EquipmentSlot[] = EQUIPMENT_SLOTS.filter(
  (slot) => !slot.startsWith("costumeEnchant") && slot !== "ammo",
);

const SLOT_SORTS: Array<{ value: SlotSort; label: string }> = [
  { value: "skillMax", label: "ดาเมจสกิลสูงสุด" },
  { value: "delta", label: "ส่วนต่างจากช่องว่าง" },
  { value: "skillDps", label: "DPS สกิล" },
  { value: "basicDps", label: "DPS โจมตีปกติ" },
];

const SEARCH_SORTS: Array<{ value: ItemSearchSort; label: string }> = [
  { value: "name", label: "ชื่อ" },
  { value: "requiredLevel", label: "เลเวลที่ต้องใช้" },
  { value: "cardSlots", label: "ช่องการ์ด" },
];

const STAT_KEYS: CharacterStatKey[] = [...BASE_STAT_KEYS, ...TRAIT_STAT_KEYS];

function number(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ToolShell() {
  const [data, setData] = useState<CalculatorV2Data>(EMPTY_DATA);
  const [dataError, setDataError] = useState<string | null>(null);

  const [classId, setClassId] = useState(4254);
  const [skillId, setSkillId] = useState("");
  const [monsterId, setMonsterId] = useState(0);
  const [baseLevel, setBaseLevel] = useState(250);
  const [jobLevel, setJobLevel] = useState(50);
  const [stats, setStats] = useState({
    ...DEFAULT_CHARACTER_STATS,
    str: 120,
    agi: 120,
    vit: 90,
    dex: 100,
    luk: 50,
  });

  const [slot, setSlot] = useState<EquipmentSlot>("weapon");
  const [keyword, setKeyword] = useState("");
  const [maxRequiredLevel, setMaxRequiredLevel] = useState(250);
  const [minCardSlots, setMinCardSlots] = useState(0);
  const [refine, setRefine] = useState(10);
  const [searchSort, setSearchSort] = useState<ItemSearchSort>("name");
  const [slotSort, setSlotSort] = useState<SlotSort>("skillMax");
  const [limit, setLimit] = useState(200);

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [evaluation, setEvaluation] = useState<SlotEvaluation | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadCatalogSkills(),
      loadCatalogSearch(),
      loadCatalogItemOptions(),
      loadCatalogMonsters(),
      loadCatalogHpSpTable(),
    ])
      .then(([classes, items, options, monsters, hpSpTable]) => {
        if (!active) return;
        setData({ classes, items, options, monsters, hpSpTable });
        if (monsters.length > 0) setMonsterId(monsters[0].id);
      })
      .catch((reason: unknown) => {
        if (active) {
          setDataError(
            reason instanceof Error ? reason.message : "โหลด catalog ไม่สำเร็จ",
          );
        }
      });
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, []);

  const skillChoices = useMemo(() => {
    const selected = data.classes.find((entry) => entry.classId === classId);
    return (selected?.skills ?? []).flatMap((skill) =>
      skill.choices.map((choice) => ({
        value: choice.value,
        label: `${skill.name} · ${choice.label}`,
      })),
    );
  }, [data.classes, classId]);

  // Derived rather than synced into state: a skill left over from the previous
  // class would be rejected by the engine, and the first one is the sane
  // fallback until the user picks another.
  const effectiveSkillId = skillChoices.some((choice) => choice.value === skillId)
    ? skillId
    : (skillChoices[0]?.value ?? "");

  const search = useMemo(() => {
    if (data.items.length === 0) return null;
    return searchItems(data.items, {
      slot,
      classId,
      keyword: keyword.trim() || undefined,
      maxRequiredLevel,
      minCardSlots: minCardSlots > 0 ? minCardSlots : undefined,
      sort: searchSort,
      limit,
    });
  }, [
    data.items,
    slot,
    classId,
    keyword,
    maxRequiredLevel,
    minCardSlots,
    searchSort,
    limit,
  ]);

  const baseSelection = useMemo((): CalculatorV2Selection => {
    return {
      buildName: "Tool baseline",
      classId,
      baseLevel,
      jobLevel,
      skillId: effectiveSkillId,
      skillLevel: 1,
      activeSkillKey: "",
      skillSelections: {},
      activeSkillLevels: {},
      passiveSkillLevels: {},
      attackElement: "Neutral",
      activeBuffs: [],
      stats,
      monsterId,
      equipment: {},
    };
  }, [classId, baseLevel, jobLevel, effectiveSkillId, stats, monsterId]);

  const buildInput = useCallback(
    async (item: CatalogSearchItem | null, appliedRefine: number) =>
      createDamageCalculationInput(data, {
        ...baseSelection,
        equipment: item
          ? {
              [slot]: {
                itemId: item.id,
                refine: appliedRefine,
                cardIds: [],
                optionKeys: [],
                randomOptionPaths: [],
              },
            }
          : {},
      }),
    [data, baseSelection, slot],
  );

  async function run() {
    if (!search || search.items.length === 0) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunError(null);
    setEvaluation(null);
    setProgress({ done: 0, total: search.items.length });

    try {
      const result = await evaluateSlotCandidates({
        candidates: search.items,
        slot,
        buildInput,
        refine,
        sort: slotSort,
        onProgress: (done, total) => setProgress({ done, total }),
        signal: controller.signal,
      });
      setEvaluation(result);
    } catch (reason: unknown) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setRunError(reason instanceof Error ? reason.message : "ประเมินไม่สำเร็จ");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setProgress(null);
    }
  }

  const isRunning = progress !== null;
  const monsterName =
    data.monsters.find((entry) => entry.id === monsterId)?.name ?? "";

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Tool harness</p>
          <h1>Item Finder</h1>
        </div>
        <p>
          หน้าสำหรับกดทดสอบ tool ค้นหาไอเทมด้วยตัวเองก่อนต่อให้โมเดลเรียก
          ตัวเลขทุกตัวมาจาก engine เดียวกับ Calculator ไม่ได้ประมาณค่าเอง
        </p>
      </header>

      {dataError ? <p className={styles.error}>{dataError}</p> : null}

      <section className="panel">
        <h2 className={styles.sectionTitle}>1 · ตั้งค่า build</h2>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>อาชีพ</span>
            <select
              value={classId}
              onChange={(event) => setClassId(number(event.target.value, classId))}
            >
              {CALCULATOR_CLASSES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>สกิล</span>
            <select
              value={effectiveSkillId}
              onChange={(event) => setSkillId(event.target.value)}
            >
              {skillChoices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>เป้าหมาย ({data.monsters.length} ตัว)</span>
            <select
              value={monsterId}
              onChange={(event) =>
                setMonsterId(number(event.target.value, monsterId))
              }
            >
              {data.monsters.map((monster) => (
                <option key={monster.id} value={monster.id}>
                  {monster.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Base level</span>
            <input
              type="number"
              value={baseLevel}
              onChange={(event) =>
                setBaseLevel(number(event.target.value, baseLevel))
              }
            />
          </label>

          <label className={styles.field}>
            <span>Job level</span>
            <input
              type="number"
              value={jobLevel}
              onChange={(event) =>
                setJobLevel(number(event.target.value, jobLevel))
              }
            />
          </label>
        </div>

        <div className={styles.statGrid}>
          {STAT_KEYS.map((key) => (
            <label className={styles.statField} key={key}>
              <span>{key.toUpperCase()}</span>
              <input
                type="number"
                value={stats[key]}
                onChange={(event) =>
                  setStats((current) => ({
                    ...current,
                    [key]: number(event.target.value, current[key]),
                  }))
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className={styles.sectionTitle}>2 · กรองไอเทม (ไม่เรียก engine)</h2>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>ช่องอุปกรณ์</span>
            <select
              value={slot}
              onChange={(event) => setSlot(event.target.value as EquipmentSlot)}
            >
              {TARGET_SLOTS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>คำค้น</span>
            <input
              placeholder="เช่น shadow katar"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span>เลเวลสูงสุดที่ใช้ได้</span>
            <input
              type="number"
              value={maxRequiredLevel}
              onChange={(event) =>
                setMaxRequiredLevel(number(event.target.value, maxRequiredLevel))
              }
            />
          </label>

          <label className={styles.field}>
            <span>ช่องการ์ดขั้นต่ำ</span>
            <input
              type="number"
              min={0}
              value={minCardSlots}
              onChange={(event) =>
                setMinCardSlots(number(event.target.value, minCardSlots))
              }
            />
          </label>

          <label className={styles.field}>
            <span>เรียงผลค้นหา</span>
            <select
              value={searchSort}
              onChange={(event) =>
                setSearchSort(event.target.value as ItemSearchSort)
              }
            >
              {SEARCH_SORTS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>ประเมินสูงสุด</span>
            <input
              type="number"
              min={1}
              value={limit}
              onChange={(event) => setLimit(number(event.target.value, limit))}
            />
          </label>
        </div>

        <p className={styles.summary}>
          {search
            ? `พบ ${search.matched.toLocaleString()} ชิ้น · จะประเมิน ${search.items.length.toLocaleString()} ชิ้น · ต้องโหลด chunk: ${search.categories.join(", ") || "-"}`
            : "กำลังโหลด catalog…"}
        </p>
      </section>

      <section className="panel">
        <h2 className={styles.sectionTitle}>3 · ประเมินด้วย engine จริง</h2>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Refine ที่ใช้ประเมิน</span>
            <input
              type="number"
              min={0}
              max={20}
              value={refine}
              onChange={(event) => setRefine(number(event.target.value, refine))}
            />
          </label>

          <label className={styles.field}>
            <span>เรียงผลลัพธ์</span>
            <select
              value={slotSort}
              onChange={(event) => setSlotSort(event.target.value as SlotSort)}
            >
              {SLOT_SORTS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.run}
            disabled={isRunning || !search || search.items.length === 0}
            type="button"
            onClick={() => void run()}
          >
            {isRunning ? "กำลังประเมิน…" : "ค้นหาและจัดอันดับ"}
          </button>
          {isRunning ? (
            <button
              className={styles.stop}
              type="button"
              onClick={() => abortRef.current?.abort()}
            >
              หยุด
            </button>
          ) : null}
          {progress ? (
            <span className={styles.progress}>
              {progress.done}/{progress.total}
            </span>
          ) : null}
        </div>

        {runError ? <p className={styles.error}>{runError}</p> : null}
      </section>

      {evaluation ? (
        <section className="panel">
          <h2 className={styles.sectionTitle}>
            ผลลัพธ์ · {monsterName || "เป้าหมาย"}
          </h2>

          <div className={styles.stats}>
            <span>
              ประเมินสำเร็จ <strong>{evaluation.stats.evaluated}</strong> /{" "}
              {evaluation.stats.candidates}
            </span>
            <span>
              เวลารวม <strong>{evaluation.stats.elapsedMs.toFixed(0)} ms</strong>
            </span>
            <span>
              เฉลี่ย{" "}
              <strong>{evaluation.stats.msPerCandidate.toFixed(2)} ms</strong>/ชิ้น
            </span>
            <span>
              ฐาน (ช่องว่าง){" "}
              <strong>
                {evaluation.baseline
                  ? evaluation.baseline.skill.max.toLocaleString()
                  : "คำนวณไม่ได้"}
              </strong>
            </span>
          </div>

          {evaluation.scores.length === 0 ? (
            <p className={styles.summary}>ไม่มีไอเทมที่ประเมินสำเร็จ</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ไอเทม</th>
                    <th>+</th>
                    <th>สกิล min–max</th>
                    <th>DPS สกิล</th>
                    <th>DPS ปกติ</th>
                    <th>Δ สกิลสูงสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluation.scores.map((score, index) => (
                    <tr key={score.item.id}>
                      <td>{index + 1}</td>
                      <td>
                        {score.item.name}
                        <small> #{score.item.id}</small>
                      </td>
                      <td>{score.refine}</td>
                      <td>
                        {score.skillMin.toLocaleString()}–
                        {score.skillMax.toLocaleString()}
                      </td>
                      <td>{Math.round(score.skillDps).toLocaleString()}</td>
                      <td>{Math.round(score.basicDps).toLocaleString()}</td>
                      <td
                        className={
                          score.deltaSkillMax >= 0 ? styles.gain : styles.loss
                        }
                      >
                        {score.deltaSkillMax >= 0 ? "+" : ""}
                        {score.deltaSkillMax.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {evaluation.failures.length > 0 ? (
            <details className={styles.failures}>
              <summary>
                ประเมินไม่ได้ {evaluation.failures.length} ชิ้น
              </summary>
              <ul>
                {evaluation.failures.slice(0, 20).map((failure) => (
                  <li key={failure.item.id}>
                    {failure.item.name} — {failure.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
