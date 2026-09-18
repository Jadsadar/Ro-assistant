/**
 * Validation that runs between the calculator state and the damage engine.
 *
 * The UI already filters most of these cases, but state can also arrive from a
 * saved build, an imported JSON file or a bug, and the adapter used to trust it
 * verbatim. Anything that reaches the engine has passed through here.
 */
import type { CatalogItemOptionsIndex, CatalogSearchItem } from "@/lib/catalog/types";
import {
  ITEM_TYPE_IDS,
  resolveCardSlotCount,
  resolveWeaponCapabilities,
} from "@/lib/equipment/catalog-rules";
import { itemMatchesClass } from "@/lib/equipment/class-compatibility";
import { resolveWeaponState } from "@/lib/equipment/weapon-state";
import {
  EQUIPMENT_SLOT_RULES,
  ITEM_GRADES,
  cardPositionsForSlot,
  type EquipmentSlot,
} from "@/lib/equipment/types";

export const MAX_REFINE = 18;

export interface ValidationIssue {
  slot?: EquipmentSlot;
  code: string;
  message: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidatableSelection {
  itemId?: number;
  refine: number;
  grade?: string;
  cardIds: number[];
  optionKeys: string[];
}

export interface ValidateSelectionInput {
  classId: number;
  equipment: Partial<Record<EquipmentSlot, ValidatableSelection>>;
  items: CatalogSearchItem[];
  options: CatalogItemOptionsIndex;
}

export function validateCalculatorSelection({
  classId,
  equipment,
  items,
  options,
}: ValidateSelectionInput): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const itemById = new Map(items.map((item) => [item.id, item]));

  const fail = (slot: EquipmentSlot, code: string, message: string) =>
    errors.push({ slot, code, message });

  const weapon = equipment.weapon?.itemId
    ? itemById.get(equipment.weapon.itemId)
    : undefined;
  const weaponState = resolveWeaponState({
    classId,
    weapon: weapon ?? null,
    hasShield: Boolean(equipment.shield?.itemId),
    hasLeftWeapon: Boolean(equipment.leftWeapon?.itemId),
  });

  for (const [slotKey, selection] of Object.entries(equipment)) {
    const slot = slotKey as EquipmentSlot;
    if (!selection?.itemId) continue;

    const item = itemById.get(selection.itemId);
    if (!item) {
      fail(slot, "unknown-item", `${slot}: ไม่พบไอเทม ${selection.itemId} ใน catalog`);
      continue;
    }

    // The off-hand is a weapon capability rather than an equipSlots membership.
    const belongsInSlot =
      slot === "leftWeapon"
        ? resolveWeaponCapabilities(item).canEquipLeftWeapon
        : item.equipSlots.includes(slot);
    if (!belongsInSlot) {
      fail(slot, "wrong-slot", `${slot}: ${item.name} ใส่ในช่องนี้ไม่ได้`);
    }

    if (slot !== "ammo" && !itemMatchesClass(item, classId)) {
      fail(slot, "class-mismatch", `${slot}: อาชีพนี้ใช้ ${item.name} ไม่ได้`);
    }

    const rule = EQUIPMENT_SLOT_RULES[slot];

    if (selection.refine > 0) {
      if (!rule.allowsRefine || !item.isRefinable) {
        fail(slot, "refine-not-allowed", `${slot}: ${item.name} ตีบวกไม่ได้`);
      } else if (selection.refine > MAX_REFINE || selection.refine < 0) {
        fail(
          slot,
          "refine-out-of-range",
          `${slot}: refine ต้องอยู่ระหว่าง 0-${MAX_REFINE}`,
        );
      }
    }

    if (selection.grade) {
      if (!rule.allowsGrade || !item.canGrade) {
        fail(slot, "grade-not-allowed", `${slot}: ${item.name} ใส่ grade ไม่ได้`);
      } else if (!ITEM_GRADES.some((grade) => grade === selection.grade)) {
        fail(slot, "grade-unknown", `${slot}: grade ${selection.grade} ไม่ถูกต้อง`);
      }
    }

    const cardIds = selection.cardIds.filter(Boolean);
    const maxCards = resolveCardSlotCount(item, rule.maxCards);
    if (cardIds.length > maxCards) {
      fail(
        slot,
        "too-many-cards",
        `${slot}: ${item.name} มี ${maxCards} ช่องการ์ด แต่ใส่มา ${cardIds.length}`,
      );
    }

    const positions = cardPositionsForSlot(slot);
    for (const cardId of cardIds) {
      const card = itemById.get(cardId);
      if (!card) {
        fail(slot, "unknown-card", `${slot}: ไม่พบการ์ด ${cardId} ใน catalog`);
        continue;
      }
      if (card.itemTypeId !== ITEM_TYPE_IDS.card) {
        fail(slot, "not-a-card", `${slot}: ${card.name} ไม่ใช่การ์ด`);
        continue;
      }
      if (!positions.some((position) => position === card.compositionPos)) {
        fail(
          slot,
          "card-wrong-position",
          `${slot}: ${card.name} ใส่ในช่องนี้ไม่ได้`,
        );
      }
    }

    const groups = options[item.id]?.groups ?? [];
    selection.optionKeys.forEach((optionKey, groupSlot) => {
      if (!optionKey) return;
      const group = groups.find((entry) => entry.slot === groupSlot);
      if (!group) {
        fail(
          slot,
          "enchant-unknown-group",
          `${slot}: ${item.name} ไม่มี enchant ช่องที่ ${groupSlot}`,
        );
        return;
      }
      if (!group.choices.some((choice) => choice.key === optionKey)) {
        fail(
          slot,
          "enchant-not-in-group",
          `${slot}: enchant ${optionKey} ไม่อยู่ในกลุ่ม ${group.label}`,
        );
      }
    });
  }

  // Weapon-relative slots.
  if (equipment.shield?.itemId && !weaponState.allowsShield) {
    fail("shield", "shield-not-allowed", "อาวุธชิ้นนี้ถือโล่ไม่ได้");
  }
  if (equipment.leftWeapon?.itemId) {
    if (!weaponState.classAllowsLeftWeapon) {
      fail("leftWeapon", "left-weapon-class", "อาชีพนี้ใช้อาวุธมือซ้ายไม่ได้");
    }
    if (equipment.shield?.itemId) {
      fail(
        "leftWeapon",
        "shield-and-left-weapon",
        "ใส่โล่กับอาวุธมือซ้ายพร้อมกันไม่ได้",
      );
    }
    if (!equipment.weapon?.itemId) {
      fail("leftWeapon", "left-weapon-without-weapon", "ต้องเลือกอาวุธหลักก่อน");
    }
  }
  if (equipment.ammo?.itemId) {
    const ammo = itemById.get(equipment.ammo.itemId);
    if (!weaponState.showAmmo) {
      fail("ammo", "ammo-not-allowed", "อาวุธหรืออาชีพนี้ไม่ใช้กระสุน");
    } else if (
      ammo &&
      weaponState.ammoSubTypeId !== null &&
      ammo.itemSubTypeId !== weaponState.ammoSubTypeId
    ) {
      fail("ammo", "ammo-wrong-type", `${ammo.name} ใช้กับอาวุธนี้ไม่ได้`);
    }
  }

  if (!equipment.weapon?.itemId) {
    warnings.push({
      slot: "weapon",
      code: "no-weapon",
      message: "ยังไม่ได้เลือกอาวุธหลัก ผลดาเมจจะคิดจากมือเปล่า",
    });
  }

  return { errors, warnings };
}
