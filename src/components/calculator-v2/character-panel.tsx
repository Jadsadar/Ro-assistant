import { useState } from "react";
import type { CatalogClassSkills } from "@/lib/catalog/types";
import { ATTACK_ELEMENTS } from "@/lib/calculator/metadata";
import type { CharacterStatKey } from "@/lib/equipment/types";
import { BuffWindowPanel } from "./buff-window-panel";
import { NumericCombobox } from "./searchable-controls";
import type { CalculatorV2Selection } from "./types";
import styles from "./calculator-v2.module.css";

interface CharacterPanelProps {
  baseStatKeys: readonly CharacterStatKey[];
  traitStatKeys: readonly CharacterStatKey[];
  classOptions: CatalogClassSkills[];
  selection: CalculatorV2Selection;
  onSelectClass: (classId: number) => void;
  onUpdate: (patch: Partial<CalculatorV2Selection>) => void;
  onUpdateStat: (key: CharacterStatKey, value: number) => void;
}

function StatColumn({
  keys,
  title,
  selection,
  max,
  onUpdateStat,
}: {
  keys: readonly CharacterStatKey[];
  title: string;
  selection: CalculatorV2Selection;
  max: number;
  onUpdateStat: (key: CharacterStatKey, value: number) => void;
}) {
  return (
    <div className={styles.statColumn}>
      <h3>{title}</h3>
      {keys.map((key) => (
        <label className={styles.statRow} key={key}>
          <span>{key.toUpperCase()}</span>
          <NumericCombobox
            max={max}
            min={0}
            value={selection.stats[key]}
            onChange={(value) => onUpdateStat(key, value)}
          />
          <strong>+0</strong>
        </label>
      ))}
    </div>
  );
}

export function CharacterPanel({
  baseStatKeys,
  traitStatKeys,
  classOptions,
  selection,
  onSelectClass,
  onUpdate,
  onUpdateStat,
}: CharacterPanelProps) {
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);

  return (
    <div className={styles.sideStack}>
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <h2>Set</h2>
        </header>
        <div className={styles.panelBody}>
          <label className={styles.field}>
            <span>Set Name</span>
            <input
              value={selection.buildName}
              onChange={(event) => onUpdate({ buildName: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span>Class Selection</span>
            <select
              value={selection.classId}
              onChange={(event) => onSelectClass(Number(event.target.value))}
            >
              {classOptions.map((classOption) => (
                <option key={classOption.classId} value={classOption.classId}>
                  {classOption.className}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Attack Element</span>
            <select
              value={selection.attackElement}
              onChange={(event) =>
                onUpdate({
                  attackElement: event.target
                    .value as CalculatorV2Selection["attackElement"],
                })
              }
            >
              {ATTACK_ELEMENTS.map((element) => (
                <option key={element} value={element}>
                  {element}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.levelGrid}>
            <label className={styles.field}>
              <span>Base Lvl</span>
              <NumericCombobox
                max={260}
                min={1}
                value={selection.baseLevel}
                onChange={(value) => onUpdate({ baseLevel: value })}
              />
            </label>
            <label className={styles.field}>
              <span>Job Lvl</span>
              <NumericCombobox
                max={70}
                min={1}
                value={selection.jobLevel}
                onChange={(value) => onUpdate({ jobLevel: value })}
              />
            </label>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <h2>Stats</h2>
          <button
            aria-expanded={!isStatsCollapsed}
            aria-label={isStatsCollapsed ? "Expand Stats" : "Collapse Stats"}
            className={styles.collapseButton}
            title={isStatsCollapsed ? "Expand Stats" : "Collapse Stats"}
            type="button"
            onClick={() => setIsStatsCollapsed((current) => !current)}
          >
            <span
              className={
                isStatsCollapsed
                  ? styles.collapseArrowDown
                  : styles.collapseArrowUp
              }
            />
          </button>
        </header>
        {!isStatsCollapsed ? (
          <div className={styles.panelBody}>
            <div className={`${styles.statsGrid} ${styles.statsPanelGrid}`}>
              <StatColumn
                keys={baseStatKeys}
                max={130}
                selection={selection}
                title="Base Stats"
                onUpdateStat={onUpdateStat}
              />
              <StatColumn
                keys={traitStatKeys}
                max={110}
                selection={selection}
                title="Trait Stats"
                onUpdateStat={onUpdateStat}
              />
            </div>
          </div>
        ) : null}
      </section>

      <BuffWindowPanel
        activeBuffs={selection.activeBuffs}
        onChange={(activeBuffs) => onUpdate({ activeBuffs })}
      />
    </div>
  );
}
