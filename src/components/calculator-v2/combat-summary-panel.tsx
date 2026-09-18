import type {
  CalculatorV2Data,
  CalculatorV2Selection,
  SelectedClassView,
} from "./types";
import type { DamageCalculationState } from "@/lib/calculator/damage-engine";
import styles from "./calculator-v2.module.css";

interface CombatSummaryPanelProps {
  calculation: DamageCalculationState;
  data: CalculatorV2Data;
  selectedClass: SelectedClassView;
  selection: CalculatorV2Selection;
}

export function CombatSummaryPanel({
  calculation,
  data,
  selectedClass,
  selection,
}: CombatSummaryPanelProps) {
  const equippedCount = Object.values(selection.equipment).filter(
    (entry) => entry?.itemId,
  ).length;
  const monster = data.monsters.find(
    (entry) => entry.id === selection.monsterId,
  );
  const result = calculation.status === "ready" ? calculation.result : null;
  const damageLabel =
    calculation.status === "loading"
      ? "Calculating..."
      : calculation.status === "error"
        ? "Unavailable"
        : result
          ? `${result.skill.min.toLocaleString()}–${result.skill.max.toLocaleString()}`
          : "Select a skill";

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2>Combat Status</h2>
      </header>
      <div className={styles.panelBody}>
        <div className={styles.damageReadout}>
          <span>Damage Preview</span>
          <strong>{damageLabel}</strong>
          {result ? (
            <small>
              {result.skill.damageType || "Skill"} · {result.skill.element} ·{" "}
              {result.skill.hits.toLocaleString()} hit
            </small>
          ) : null}
        </div>
        <dl className={styles.summaryGrid}>
          <div>
            <dt>Class</dt>
            <dd>{selectedClass.className}</dd>
          </div>
          <div>
            <dt>Skill</dt>
            <dd>{selection.skillId || "-"}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>{monster?.name ?? "-"}</dd>
          </div>
          <div>
            <dt>Equipped</dt>
            <dd>{equippedCount} slots</dd>
          </div>
          <div>
            <dt>Skill DPS</dt>
            <dd>{result ? result.skill.dps.toLocaleString() : "-"}</dd>
          </div>
          <div>
            <dt>Basic Attack</dt>
            <dd>
              {result
                ? `${result.basic.min.toLocaleString()}–${result.basic.max.toLocaleString()}`
                : "-"}
            </dd>
          </div>
          <div>
            <dt>ASPD / Hit</dt>
            <dd>
              {result
                ? `${result.basic.attackSpeed} / ${result.skill.accuracy}%`
                : "-"}
            </dd>
          </div>
          <div>
            <dt>HP / SP</dt>
            <dd>
              {result
                ? `${result.resources.maxHp.toLocaleString()} / ${result.resources.maxSp.toLocaleString()}`
                : "-"}
            </dd>
          </div>
        </dl>
        {calculation.status === "error" ? (
          <p className={styles.calculationError}>{calculation.message}</p>
        ) : null}
        {result?.warnings.map((warning) => (
          <p className={styles.calculationWarning} key={warning}>
            {warning}
          </p>
        ))}
        {result ? (
          <p className={styles.engineLabel}>
            Engine: {result.engine} {result.engineVersion}
          </p>
        ) : null}
      </div>
    </section>
  );
}
