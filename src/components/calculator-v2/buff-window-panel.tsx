"use client";

import { useState } from "react";
import styles from "./calculator-v2.module.css";

const BUFF_GROUPS = [
  {
    title: "Boosters",
    buffs: [
      "Arunafeltz Desert Sandwich",
      "Full SwingK",
      "Mana +",
      "HP Increase Potion(Large)",
      "Greater Agimat of Ancient Spirit",
      "Battle Pill",
      "Suprem Battle Pill",
      "Red Booster",
      "Almighty",
      "Abrasive",
      "Blessing Of Tyr",
      "Power Booster",
      "Unlimited Drink",
      "Red Herb Activator",
      "Blue Herb Activator",
      "Force Booster",
    ],
  },
  {
    title: "Stats",
    buffs: [
      "Str 10",
      "Str 20",
      "Str 15",
      "Agi 10",
      "Agi 20",
      "Agi 15",
      "Vit 10",
      "Vit 20",
      "Vit 15",
      "Int 10",
      "Int 20",
      "Int 15",
      "Dex 10",
      "Dex 20",
      "Dex 15",
      "Luk 10",
      "Luk 20",
      "Luk 15",
    ],
  },
  {
    title: "ASPD",
    buffs: [
      "Concentration Potion",
      "Awakening Potion",
      "Berserk Potion",
      "Enrich Celermine",
      "ASPD Potion",
    ],
  },
] as const;

interface BuffWindowPanelProps {
  activeBuffs: string[];
  onChange: (activeBuffs: string[]) => void;
}

export function BuffWindowPanel({
  activeBuffs,
  onChange,
}: BuffWindowPanelProps) {
  const activeBuffSet = new Set(activeBuffs);
  const [isCollapsed, setIsCollapsed] = useState(false);

  function toggleBuff(name: string) {
    const next = new Set(activeBuffSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange([...next]);
  }

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2>Consumable</h2>
        <div className={styles.panelHeaderActions}>
          <span className={styles.panelBadge}>{activeBuffSet.size} active</span>
          <button
            aria-expanded={!isCollapsed}
            aria-label={
              isCollapsed
                ? "Expand Buff / Consumable"
                : "Collapse Buff / Consumable"
            }
            className={styles.collapseButton}
            title={
              isCollapsed
                ? "Expand Buff / Consumable"
                : "Collapse Buff / Consumable"
            }
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
          >
            <span
              className={
                isCollapsed
                  ? styles.collapseArrowDown
                  : styles.collapseArrowUp
              }
            />
          </button>
        </div>
      </header>
      {!isCollapsed ? (
        <div className={styles.panelBody}>
          <div className={styles.buffToolbar}>
            <button
              type="button"
              onClick={() =>
                onChange(BUFF_GROUPS.flatMap((group) => [...group.buffs]))
              }
            >
              All
            </button>
            <button type="button" onClick={() => onChange([])}>
              Clear
            </button>
          </div>

          <div className={styles.buffGroups}>
            {BUFF_GROUPS.map((group) => (
              <section className={styles.buffGroup} key={group.title}>
                <h3>{group.title}</h3>
                <div className={styles.buffGrid}>
                  {group.buffs.map((buff) => {
                    const isActive = activeBuffSet.has(buff);
                    return (
                      <button
                        className={isActive ? styles.buffActive : undefined}
                        key={buff}
                        type="button"
                        onClick={() => toggleBuff(buff)}
                      >
                        <span className={styles.buffIcon} aria-hidden="true" />
                        <span>{buff}</span>
                        {isActive ? <strong>ON</strong> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
