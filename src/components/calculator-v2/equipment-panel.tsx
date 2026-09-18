import type { CatalogSearchItem } from "@/lib/catalog/types";
import {
  resolveCardSlotCount,
  resolveWeaponCapabilities,
} from "@/lib/equipment/catalog-rules";
import { itemMatchesClass } from "@/lib/equipment/class-compatibility";
import { resolveWeaponState } from "@/lib/equipment/weapon-state";
import { RandomOptionCascade } from "@/components/equipment/random-option-cascade";
import { getLegacyRandomOptionTree } from "@/lib/equipment/random-options";
import {
  EQUIPMENT_SLOT_RULES,
  cardPositionsForSlot,
  type EquipmentSlot,
} from "@/lib/equipment/types";
import type {
  CalculatorV2Data,
  EquipmentSlotDefinition,
  EquipmentSlotSelection,
} from "./types";
import {
  NumericCombobox,
  SearchableCombobox,
  type SearchableOption,
} from "./searchable-controls";
import styles from "./calculator-v2.module.css";

const SLOT_DEFINITIONS: EquipmentSlotDefinition[] = [
  { slot: "weapon", label: "Weapon", group: "main" },
  { slot: "leftWeapon", label: "Left Weapon", group: "main" },
  { slot: "shield", label: "Shield", group: "main" },
  { slot: "ammo", label: "Ammo", group: "main" },
  { slot: "headUpper", label: "Head Upper", group: "main" },
  { slot: "headMiddle", label: "Head Middle", group: "main" },
  { slot: "headLower", label: "Head Lower", group: "main" },
  { slot: "armor", label: "Armor", group: "main" },
  { slot: "garment", label: "Garment", group: "main" },
  { slot: "boot", label: "Boot", group: "main" },
  { slot: "accLeft", label: "Accessory L", group: "main" },
  { slot: "accRight", label: "Accessory R", group: "main" },
  { slot: "pet", label: "Pet", group: "main" },
  { slot: "costumeUpper", label: "Costume Upper", group: "costume" },
  { slot: "costumeMiddle", label: "Costume Middle", group: "costume" },
  { slot: "costumeLower", label: "Costume Lower", group: "costume" },
  { slot: "costumeGarment", label: "Costume Garment", group: "costume" },
  {
    slot: "costumeEnchantUpper",
    label: "Costume Enchant Upper",
    group: "costumeEnchant",
  },
  {
    slot: "costumeEnchantMiddle",
    label: "Costume Enchant Middle",
    group: "costumeEnchant",
  },
  {
    slot: "costumeEnchantLower",
    label: "Costume Enchant Lower",
    group: "costumeEnchant",
  },
  {
    slot: "costumeEnchantGarment",
    label: "Costume Enchant Garment",
    group: "costumeEnchant",
  },
  {
    slot: "costumeEnchantGarment2",
    label: "Costume Enchant Garment 2",
    group: "costumeEnchant",
  },
  {
    slot: "costumeEnchantGarment4",
    label: "Costume Enchant Garment 4",
    group: "costumeEnchant",
  },
  { slot: "shadowWeapon", label: "Shadow Weapon", group: "shadow" },
  { slot: "shadowArmor", label: "Shadow Armor", group: "shadow" },
  { slot: "shadowShield", label: "Shadow Shield", group: "shadow" },
  { slot: "shadowBoot", label: "Shadow Shoes", group: "shadow" },
  { slot: "shadowEarring", label: "Shadow Earring", group: "shadow" },
  { slot: "shadowPendant", label: "Shadow Pendant", group: "shadow" },
];

const RANDOM_OPTION_TREE = getLegacyRandomOptionTree();

const GROUP_LABELS = {
  main: "Main Gear",
  costume: "Costume",
  costumeEnchant: "Costume Enchant",
  shadow: "Shadow Gear",
} as const;

function itemOptionsForSlot(
  items: CatalogSearchItem[],
  slot: EquipmentSlot,
  classId: number,
  ammoSubTypeId: number | null,
) {
  // The off-hand is a weapon capability, not an equipSlots membership.
  const inSlot =
    slot === "leftWeapon"
      ? (item: CatalogSearchItem) =>
          resolveWeaponCapabilities(item).canEquipLeftWeapon
      : (item: CatalogSearchItem) => item.equipSlots.includes(slot);

  return items.filter((item) => {
    if (!inSlot(item)) return false;
    if (slot === "ammo") {
      return ammoSubTypeId === null || item.itemSubTypeId === ammoSubTypeId;
    }
    return itemMatchesClass(item, classId);
  });
}

function cardOptionsForSlot(items: CatalogSearchItem[], slot: EquipmentSlot) {
  const positions = cardPositionsForSlot(slot);
  if (positions.length === 0) return [];
  return items
    .filter((item) => item.compositionPos !== null)
    .filter((item) => positions.some((position) => position === item.compositionPos));
}

function selectedItem(
  items: CatalogSearchItem[],
  selection: EquipmentSlotSelection | undefined,
) {
  return items.find((item) => item.id === selection?.itemId);
}

function catalogItemToOption(item: CatalogSearchItem): SearchableOption {
  return {
    value: String(item.id),
    label: item.name,
    meta: `${item.id} / ${item.itemType}`,
    searchText: item.searchable,
  };
}

interface EquipmentPanelProps {
  classId: number;
  data: CalculatorV2Data;
  equipment: Partial<Record<EquipmentSlot, EquipmentSlotSelection>>;
  onChange: (slot: EquipmentSlot, value: EquipmentSlotSelection) => void;
}

export function EquipmentPanel({
  classId,
  data,
  equipment,
  onChange,
}: EquipmentPanelProps) {
  const weaponItem = data.items.find(
    (item) => item.id === equipment.weapon?.itemId,
  );
  const weaponState = resolveWeaponState({
    classId,
    weapon: weaponItem ?? null,
    hasShield: Boolean(equipment.shield?.itemId),
    hasLeftWeapon: Boolean(equipment.leftWeapon?.itemId),
  });

  function isSlotVisible(slot: EquipmentSlot) {
    if (slot === "shield") return weaponState.showShield;
    if (slot === "leftWeapon") return weaponState.showLeftWeapon;
    if (slot === "ammo") return weaponState.showAmmo;
    return true;
  }

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2>Equipment Interface</h2>
      </header>
      <div className={styles.equipmentBody}>
        {(["main", "costume", "costumeEnchant", "shadow"] as const).map((group) => (
          <section className={styles.equipmentGroup} key={group}>
            <h3>{GROUP_LABELS[group]}</h3>
            <div className={styles.slotGrid}>
              {SLOT_DEFINITIONS.filter(
                (definition) =>
                  definition.group === group && isSlotVisible(definition.slot),
              ).map((definition) => (
                <EquipmentSlotControl
                  ammoSubTypeId={weaponState.ammoSubTypeId}
                  classId={classId}
                  data={data}
                  definition={definition}
                  key={definition.slot}
                  selection={equipment[definition.slot]}
                  onChange={(value) => onChange(definition.slot, value)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function EquipmentSlotControl({
  ammoSubTypeId,
  classId,
  data,
  definition,
  selection,
  onChange,
}: {
  ammoSubTypeId: number | null;
  classId: number;
  data: CalculatorV2Data;
  definition: EquipmentSlotDefinition;
  selection?: EquipmentSlotSelection;
  onChange: (value: EquipmentSlotSelection) => void;
}) {
  const rule = EQUIPMENT_SLOT_RULES[definition.slot];
  const items = itemOptionsForSlot(
    data.items,
    definition.slot,
    classId,
    ammoSubTypeId,
  );
  const cards = cardOptionsForSlot(data.items, definition.slot);
  const item = selectedItem(data.items, selection);
  const canSelectGrade = item?.canGrade === true;
  // Refine follows the item, not the slot: most accessories are not refinable.
  const canRefine = rule.allowsRefine && item?.isRefinable === true;
  const cardCount = item ? resolveCardSlotCount(item, rule.maxCards) : 0;
  const optionGroups = item ? (data.options[item.id]?.groups ?? []) : [];
  const randomOptionCount = item
    ? (data.options[item.id]?.randomOptionCount ?? 0)
    : 0;
  const current: EquipmentSlotSelection = selection ?? {
    refine: 0,
    cardIds: [],
    optionKeys: [],
    randomOptionPaths: [],
  };

  function patch(next: Partial<EquipmentSlotSelection>) {
    onChange({
      ...current,
      ...next,
    });
  }

  return (
    <article className={styles.slotCard}>
      <div className={styles.slotHeading}>
        <span>{definition.label}</span>
        <strong>{item?.itemType ?? "Empty"}</strong>
      </div>
      <label className={styles.compactField}>
        <span>Item</span>
        <SearchableCombobox
          emptyLabel="No item matches"
          options={items.map(catalogItemToOption)}
          placeholder={`Search ${definition.label.toLowerCase()}...`}
          value={current.itemId ? String(current.itemId) : ""}
          onChange={(value) =>
            {
              const nextItem = data.items.find((entry) => entry.id === Number(value));
              patch({
                itemId: value ? Number(value) : undefined,
                grade: nextItem?.canGrade ? current.grade : undefined,
                refine: nextItem?.isRefinable ? current.refine : 0,
                cardIds: [],
                optionKeys: [],
                randomOptionPaths: [],
              });
            }
          }
        />
      </label>
      <div className={styles.slotControls}>
        {canRefine ? (
          <label className={styles.compactField}>
            <span>Refine</span>
            <NumericCombobox
              max={18}
              min={0}
              value={current.refine}
              onChange={(value) => patch({ refine: value })}
            />
          </label>
        ) : null}
        {rule.allowsGrade && canSelectGrade ? (
          <label className={styles.compactField}>
            <span>Grade</span>
            <select
              value={current.grade ?? ""}
              onChange={(event) =>
                patch({
                  grade: event.target.value
                    ? (event.target.value as EquipmentSlotSelection["grade"])
                    : undefined,
                })
              }
            >
              <option value="">-</option>
              <option value="D">D</option>
              <option value="C">C</option>
              <option value="B">B</option>
              <option value="A">A</option>
            </select>
          </label>
        ) : null}
      </div>
      {cardCount > 0 ? (
        <div className={styles.cardGrid}>
          {Array.from({ length: cardCount }, (_, index) => (
            <label
              className={styles.compactField}
              key={`${definition.slot}-card-${index}`}
            >
              <span>Card {index + 1}</span>
              <SearchableCombobox
                emptyLabel="No card matches"
                options={cards.map(catalogItemToOption)}
                placeholder="Search card..."
                value={current.cardIds[index] ? String(current.cardIds[index]) : ""}
                onChange={(value) => {
                  // Clearing a card empties that slot; it must not pull the
                  // following cards forward the way splice() did.
                  const nextCards = [...current.cardIds];
                  nextCards[index] = value ? Number(value) : 0;
                  patch({ cardIds: nextCards });
                }}
              />
            </label>
          ))}
        </div>
      ) : null}
      {optionGroups.length > 0 ? (
        <div className={styles.optionGrid}>
          {optionGroups.map((group) => (
            <label className={styles.compactField} key={group.slot}>
              <span>{group.label}</span>
              <select
                value={current.optionKeys[group.slot] ?? ""}
                onChange={(event) => {
                  const nextOptions = [...current.optionKeys];
                  nextOptions[group.slot] = event.target.value;
                  patch({ optionKeys: nextOptions });
                }}
              >
                <option value="">None</option>
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
      {randomOptionCount > 0 ? (
        <div className={styles.randomOptionGrid}>
          {Array.from({ length: randomOptionCount }, (_, index) => (
            <RandomOptionCascade
              index={index}
              key={`${definition.slot}-option-${index}`}
              path={current.randomOptionPaths[index] ?? []}
              tree={RANDOM_OPTION_TREE}
              onChange={(path) => {
                const nextPaths = [...current.randomOptionPaths];
                nextPaths[index] = path;
                patch({ randomOptionPaths: nextPaths });
              }}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
