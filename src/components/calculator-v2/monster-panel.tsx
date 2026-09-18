import type { CatalogMonster } from "@/lib/catalog/types";
import styles from "./calculator-v2.module.css";

interface MonsterPanelProps {
  monsters: CatalogMonster[];
  selectedMonsterId: number;
  onSelect: (monsterId: number) => void;
}

export function MonsterPanel({
  monsters,
  selectedMonsterId,
  onSelect,
}: MonsterPanelProps) {
  const selectedMonster = monsters.find(
    (monster) => monster.id === selectedMonsterId,
  );

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2>Target Monster</h2>
      </header>
      <div className={styles.panelBody}>
        <label className={styles.field}>
          <span>Monster</span>
          <select
            value={selectedMonsterId}
            onChange={(event) => onSelect(Number(event.target.value))}
          >
            {monsters.map((monster) => (
              <option key={monster.id} value={monster.id}>
                {monster.name}
              </option>
            ))}
          </select>
        </label>
        <dl className={styles.monsterStats}>
          <div>
            <dt>Level</dt>
            <dd>{selectedMonster?.stats.level ?? "-"}</dd>
          </div>
          <div>
            <dt>HP</dt>
            <dd>{selectedMonster?.stats.health.toLocaleString() ?? "-"}</dd>
          </div>
          <div>
            <dt>Element</dt>
            <dd>{selectedMonster?.stats.elementName ?? "-"}</dd>
          </div>
          <div>
            <dt>Race</dt>
            <dd>{selectedMonster?.stats.raceName ?? "-"}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{selectedMonster?.stats.scaleName ?? "-"}</dd>
          </div>
          <div>
            <dt>DEF/MDEF</dt>
            <dd>
              {selectedMonster
                ? `${selectedMonster.stats.defense}/${selectedMonster.stats.magicDefense}`
                : "-"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
