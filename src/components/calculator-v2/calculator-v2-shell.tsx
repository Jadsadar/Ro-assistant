"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadCatalogHpSpTable,
  loadCatalogItemOptions,
  loadCatalogMonsters,
  loadCatalogSearch,
  loadCatalogSkills,
} from "@/lib/catalog/client";
import {
  calculateDamage,
  type DamageCalculationState,
} from "@/lib/calculator/damage-engine";
import { DEFAULT_CHARACTER_STATS } from "@/lib/calculator/metadata";
import { sanitizeEquipmentForClass } from "@/lib/equipment/class-compatibility";
import { sanitizeWeaponRelatedSlots } from "@/lib/equipment/weapon-state";
import {
  BASE_STAT_KEYS,
  TRAIT_STAT_KEYS,
  type CharacterStatKey,
  type EquipmentSlot,
} from "@/lib/equipment/types";
import type { CalculatorV2Data, CalculatorV2Selection } from "./types";
import { createDamageCalculationInput } from "./damage-adapter";
import { CharacterPanel } from "./character-panel";
import { CombatSummaryPanel } from "./combat-summary-panel";
import { EquipmentPanel } from "./equipment-panel";
import { MonsterPanel } from "./monster-panel";
import { SkillPanel } from "./skill-panel";
import styles from "./calculator-v2.module.css";

const EMPTY_DATA: CalculatorV2Data = {
  classes: [],
  items: [],
  options: {},
  monsters: [],
  hpSpTable: [],
};

const DEFAULT_SELECTION: CalculatorV2Selection = {
  buildName: "Current Build",
  classId: 0,
  baseLevel: 250,
  jobLevel: 50,
  skillId: "",
  skillLevel: 1,
  activeSkillKey: "",
  skillSelections: {},
  activeSkillLevels: {},
  passiveSkillLevels: {},
  attackElement: "Neutral",
  activeBuffs: [],
  stats: {
    ...DEFAULT_CHARACTER_STATS,
    str: 99,
    agi: 120,
    dex: 80,
    luk: 50,
  },
  monsterId: 0,
  equipment: {},
};

/** Explains which slots were cleared, so the change is visible instead of silent. */
function describeRemoved(
  removed: Array<{ slot: string; name: string }>,
): string | null {
  if (removed.length === 0) return null;
  const names = removed.map((entry) => `${entry.slot}: ${entry.name}`);
  return `ถอดอุปกรณ์ที่ใช้ร่วมกันไม่ได้ออก ${removed.length} ชิ้น (${names.join(", ")})`;
}

function getSkillKey(skill: { name: string; label?: string }) {
  return `${skill.name}::${skill.label ?? ""}`;
}

function getFirstSkillSelection(data: CalculatorV2Data, classId: number) {
  const selectedClass = data.classes.find((entry) => entry.classId === classId);
  const firstSkill = selectedClass?.skills[0];
  const firstChoice = firstSkill?.choices[0];
  const activeSkillKey = firstSkill ? getSkillKey(firstSkill) : "";
  return {
    activeSkillKey,
    skillId: firstChoice?.value ?? "",
    skillLevel: firstChoice?.level ?? 1,
    skillSelections:
      activeSkillKey && firstChoice
        ? { [activeSkillKey]: firstChoice.value }
        : {},
  };
}

export function CalculatorV2Shell() {
  const [data, setData] = useState<CalculatorV2Data>(EMPTY_DATA);
  const [selection, setSelection] =
    useState<CalculatorV2Selection>(DEFAULT_SELECTION);
  const [damageState, setDamageState] = useState<DamageCalculationState>({
    status: "idle",
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [classes, items, options, monsters, hpSpTable] = await Promise.all([
          loadCatalogSkills(),
          loadCatalogSearch(),
          loadCatalogItemOptions(),
          loadCatalogMonsters(),
          loadCatalogHpSpTable(),
        ]);
        if (!isMounted) return;

        const nextData = { classes, items, options, monsters, hpSpTable };
        const firstClassId = classes[0]?.classId ?? 0;
        const firstMonsterId = monsters[0]?.id ?? 0;
        const firstSkill = getFirstSkillSelection(nextData, firstClassId);
        setData(nextData);
        setSelection((current) => ({
          ...current,
          classId: current.classId || firstClassId,
          monsterId: current.monsterId || firstMonsterId,
          skillId: current.skillId || firstSkill.skillId,
          skillLevel: current.skillId
            ? current.skillLevel
            : firstSkill.skillLevel,
          activeSkillKey: current.activeSkillKey || firstSkill.activeSkillKey,
          skillSelections: current.skillId
            ? current.skillSelections
            : firstSkill.skillSelections,
        }));
        setError(null);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Load failed");
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function runCalculation() {
      await Promise.resolve();
      if (
        !selection.classId ||
        !selection.skillId ||
        !selection.monsterId ||
        data.hpSpTable.length === 0
      ) {
        if (isCurrent) setDamageState({ status: "idle" });
        return;
      }

      if (isCurrent) setDamageState({ status: "loading" });
      try {
        const input = await createDamageCalculationInput(data, selection);
        const result = await calculateDamage(input);
        if (isCurrent) setDamageState({ status: "ready", result });
      } catch (reason: unknown) {
        if (!isCurrent) return;
        setDamageState({
          status: "error",
          message:
            reason instanceof Error ? reason.message : "คำนวณดาเมจไม่สำเร็จ",
        });
      }
    }

    void runCalculation();
    return () => {
      isCurrent = false;
    };
  }, [data, selection]);

  const selectedClass = useMemo(() => {
    const classEntry = data.classes.find(
      (entry) => entry.classId === selection.classId,
    );
    return {
      className: classEntry?.className ?? "No class",
      skills: classEntry?.skills ?? [],
      activeSkills: classEntry?.activeSkills ?? [],
      passiveSkills: classEntry?.passiveSkills ?? [],
    };
  }, [data.classes, selection.classId]);

  function updateSelection(patch: Partial<CalculatorV2Selection>) {
    setSelection((current) => ({ ...current, ...patch }));
  }

  function updateStat(key: CharacterStatKey, value: number) {
    setSelection((current) => ({
      ...current,
      stats: {
        ...current.stats,
        [key]: value,
      },
    }));
  }

  const itemById = useMemo(
    () => new Map(data.items.map((item) => [item.id, item])),
    [data.items],
  );

  function updateEquipment(
    slot: EquipmentSlot,
    value: CalculatorV2Selection["equipment"][EquipmentSlot],
  ) {
    // A weapon swap can invalidate the shield, off-hand or ammo already chosen.
    const sanitized = sanitizeWeaponRelatedSlots(
      { ...selection.equipment, [slot]: value },
      selection.classId,
      itemById,
    );
    setNotice(describeRemoved(sanitized.removed));
    setSelection((current) => ({ ...current, equipment: sanitized.equipment }));
  }

  function selectClass(classId: number) {
    const firstSkill = getFirstSkillSelection(data, classId);
    const byClass = sanitizeEquipmentForClass(
      selection.equipment,
      classId,
      itemById,
    );
    const byWeapon = sanitizeWeaponRelatedSlots(
      byClass.equipment as CalculatorV2Selection["equipment"],
      classId,
      itemById,
    );
    setNotice(describeRemoved([...byClass.removed, ...byWeapon.removed]));
    setSelection((current) => ({
      ...current,
      classId,
      skillId: firstSkill.skillId,
      skillLevel: firstSkill.skillLevel,
      activeSkillKey: firstSkill.activeSkillKey,
      skillSelections: firstSkill.skillSelections,
      // Active/passive levels are keyed by the previous class's skill names.
      activeSkillLevels: {},
      passiveSkillLevels: {},
      equipment: byWeapon.equipment,
    }));
  }

  return (
    <div className={styles.shell}>
      {error ? <div className={styles.errorBanner}>{error}</div> : null}
      {notice ? (
        <div className={styles.noticeBanner} role="status">
          {notice}
        </div>
      ) : null}

      <main className={styles.dashboard}>
        <CharacterPanel
          baseStatKeys={BASE_STAT_KEYS}
          classOptions={data.classes}
          selection={selection}
          traitStatKeys={TRAIT_STAT_KEYS}
          onSelectClass={selectClass}
          onUpdate={updateSelection}
          onUpdateStat={updateStat}
        />
        <EquipmentPanel
          classId={selection.classId}
          data={data}
          equipment={selection.equipment}
          onChange={updateEquipment}
        />
        <aside className={styles.sideStack}>
          <SkillPanel
            selectedClass={selectedClass}
            selection={selection}
            onUpdate={updateSelection}
          />
          <MonsterPanel
            monsters={data.monsters}
            selectedMonsterId={selection.monsterId}
            onSelect={(monsterId) => updateSelection({ monsterId })}
          />
          <CombatSummaryPanel
            calculation={damageState}
            data={data}
            selectedClass={selectedClass}
            selection={selection}
          />
        </aside>
      </main>
    </div>
  );
}
