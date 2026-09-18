import type { CatalogSkill } from "@/lib/catalog/types";
import type { CalculatorV2Selection, SelectedClassView } from "./types";
import styles from "./calculator-v2.module.css";

interface SkillPanelProps {
  selectedClass: SelectedClassView;
  selection: CalculatorV2Selection;
  onUpdate: (patch: Partial<CalculatorV2Selection>) => void;
}

function skillKey(skill: SelectedClassView["skills"][number]) {
  return `${skill.name}::${skill.label ?? ""}`;
}

export function SkillPanel({
  selectedClass,
  selection,
  onUpdate,
}: SkillPanelProps) {
  const activeSkillCount = selectedClass.skills.length;

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2>Skill Matrix</h2>
        <span className={styles.panelBadge}>{activeSkillCount} skills</span>
      </header>
      <div className={styles.panelBody}>
        <div className={styles.skillMatrixList}>
          {selectedClass.skills.map((skill) => {
            const key = skillKey(skill);
            const selectedChoice =
              skill.choices.find(
                (choice) => choice.value === selection.skillSelections[key],
              ) ??
              skill.choices[0];
            const isSelected = selection.activeSkillKey === key;

            return (
              <div
                className={isSelected ? styles.skillMatrixActive : undefined}
                key={`${skill.name}-${skill.label ?? ""}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    selectedChoice &&
                    onUpdate({
                      skillId: selectedChoice.value,
                      skillLevel: selectedChoice.level,
                      activeSkillKey: key,
                      skillSelections: {
                        ...selection.skillSelections,
                        [key]: selectedChoice.value,
                      },
                    })
                  }
                >
                  <span>{skill.label ?? skill.name}</span>
                  {isSelected ? <strong>ACTIVE</strong> : null}
                </button>
                <select
                  value={selectedChoice?.value ?? ""}
                  onChange={(event) => {
                    const selected = skill.choices.find(
                      (choice) => choice.value === event.target.value,
                    );
                    if (!selected) return;
                    const nextSelections = {
                      ...selection.skillSelections,
                      [key]: selected.value,
                    };
                    if (!isSelected) {
                      onUpdate({ skillSelections: nextSelections });
                      return;
                    }
                    onUpdate({
                      skillId: selected.value,
                      skillLevel: selected.level,
                      activeSkillKey: key,
                      skillSelections: nextSelections,
                    });
                  }}
                >
                  {skill.choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <SkillLevelGroup
          heading="Active Buffs"
          levels={selection.activeSkillLevels}
          skills={selectedClass.activeSkills}
          onChange={(activeSkillLevels) => onUpdate({ activeSkillLevels })}
        />
        <SkillLevelGroup
          heading="Passive Skills"
          levels={selection.passiveSkillLevels}
          skills={selectedClass.passiveSkills}
          onChange={(passiveSkillLevels) => onUpdate({ passiveSkillLevels })}
        />
      </div>
    </section>
  );
}

/**
 * Active and passive skills reach the engine as `{ [skill.name]: level }`, which
 * is what `valuesForSkills()` in the engine wrapper reads.
 */
function SkillLevelGroup({
  heading,
  levels,
  skills,
  onChange,
}: {
  heading: string;
  levels: Record<string, number>;
  skills: CatalogSkill[];
  onChange: (levels: Record<string, number>) => void;
}) {
  if (skills.length === 0) return null;

  return (
    <div className={styles.skillLevelGroup}>
      <h3>{heading}</h3>
      <div className={styles.skillLevelList}>
        {skills.map((skill) => (
          <label className={styles.compactField} key={skill.name}>
            <span>{skill.label ?? skill.name}</span>
            <select
              value={String(levels[skill.name] ?? 0)}
              onChange={(event) =>
                onChange({
                  ...levels,
                  [skill.name]: Number(event.target.value) || 0,
                })
              }
            >
              {skill.choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
