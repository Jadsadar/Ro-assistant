/**
 * The weapon / shield / off-hand / ammo state machine, ported from the legacy
 * calculator (ro-calculator.component.ts:376-398 and calculator.ts:309-332).
 *
 * The legacy rules, restated:
 *   - shields are available while no weapon is equipped; once one is, the weapon
 *     type decides (AllowShieldTable)
 *   - ammo is available when the weapon type takes ammo, or when the class always
 *     does (kunai and cannonball classes)
 *   - the off-hand weapon slot opens only for the six dual-wield classes, and only
 *     while the equipped weapon would also allow a shield
 *   - the off-hand and the shield are mutually exclusive in the UI
 *   - anything that becomes unavailable is cleared rather than carried along
 */
import { ITEM_SUB_TYPE_IDS, resolveWeaponCapabilities } from "./catalog-rules";
import { legacyClassToken } from "./class-compatibility";
import type { EquipmentSlot } from "./types";

/** Legacy `AllowLeftWeaponMapper` (constants/allow-left-weapon-mapper.ts). */
export const ALLOW_LEFT_WEAPON_CLASS_TOKENS = new Set<string>([
  "GuillotineCross",
  "ShadowCross",
  "Oboro",
  "Shiranui",
  "Kagerou",
  "Shinkiro",
]);

/** Legacy `ClassAmmoMapper` (constants/weapon-ammo-mapper.ts). */
export const CLASS_AMMO_SUB_TYPE_ID: Record<string, number> = {
  Oboro: ITEM_SUB_TYPE_IDS.kunai,
  Shinkiro: ITEM_SUB_TYPE_IDS.kunai,
  Kagerou: ITEM_SUB_TYPE_IDS.kunai,
  Shiranui: ITEM_SUB_TYPE_IDS.kunai,
  Mechanic: ITEM_SUB_TYPE_IDS.cannonball,
  Meister: ITEM_SUB_TYPE_IDS.cannonball,
  Genetic: ITEM_SUB_TYPE_IDS.cannonball,
  Biolo: ITEM_SUB_TYPE_IDS.cannonball,
};

export interface WeaponStateInput {
  classId: number;
  /** The item currently in the main hand, if any. */
  weapon?: { itemTypeId: number; itemSubTypeId: number } | null;
  /** Whether a shield is currently equipped, which hides the off-hand slot. */
  hasShield?: boolean;
  /** Whether an off-hand weapon is currently equipped, which hides the shield. */
  hasLeftWeapon?: boolean;
}

export interface WeaponState {
  /** The weapon rule alone: does this weapon type leave the shield slot open. */
  allowsShield: boolean;
  /** The class rule alone: may this class ever dual wield. */
  classAllowsLeftWeapon: boolean;
  /** Whether the shield control should be rendered right now. */
  showShield: boolean;
  /** Whether the off-hand control should be rendered right now. */
  showLeftWeapon: boolean;
  showAmmo: boolean;
  ammoSubTypeId: number | null;
  twoHanded: boolean;
}

export function resolveWeaponState({
  classId,
  weapon,
  hasShield = false,
  hasLeftWeapon = false,
}: WeaponStateInput): WeaponState {
  const classToken = legacyClassToken(classId) ?? "";
  const capabilities = weapon ? resolveWeaponCapabilities(weapon) : null;

  // domain/weapon.ts:204 — with no weapon equipped the shield stays available.
  const allowsShield = capabilities ? capabilities.allowsShield : true;
  const classAllowsLeftWeapon = ALLOW_LEFT_WEAPON_CLASS_TOKENS.has(classToken);

  const classAmmoSubTypeId = CLASS_AMMO_SUB_TYPE_ID[classToken] ?? null;
  const showAmmo = Boolean(capabilities?.allowsAmmo) || classAmmoSubTypeId !== null;
  const ammoSubTypeId =
    capabilities?.ammoSubTypeId ?? classAmmoSubTypeId ?? null;

  // ro-calculator.component.ts:392 — the off-hand rides on the shield rule.
  const showLeftWeapon =
    classAllowsLeftWeapon && allowsShield && Boolean(weapon) && !hasShield;

  return {
    allowsShield,
    classAllowsLeftWeapon,
    showShield: allowsShield && !hasLeftWeapon,
    showLeftWeapon,
    ammoSubTypeId,
    showAmmo,
    twoHanded: capabilities?.twoHanded ?? false,
  };
}

/**
 * Clears the weapon-dependent slots that the current state no longer offers, so a
 * state loaded from a saved build or produced by a weapon swap cannot smuggle an
 * impossible combination into the damage engine.
 */
export function sanitizeWeaponRelatedSlots<
  TSelection extends { itemId?: number },
>(
  equipment: Partial<Record<EquipmentSlot, TSelection>>,
  classId: number,
  itemById: Map<number, { itemTypeId: number; itemSubTypeId: number; name?: string }>,
): {
  equipment: Partial<Record<EquipmentSlot, TSelection>>;
  removed: Array<{ slot: EquipmentSlot; itemId: number; name: string }>;
} {
  const next = { ...equipment };
  const removed: Array<{ slot: EquipmentSlot; itemId: number; name: string }> =
    [];

  const weaponId = next.weapon?.itemId;
  const weapon = weaponId ? (itemById.get(weaponId) ?? null) : null;

  const drop = (slot: EquipmentSlot) => {
    const itemId = next[slot]?.itemId;
    if (!itemId) return;
    removed.push({
      slot,
      itemId,
      name: itemById.get(itemId)?.name ?? String(itemId),
    });
    delete next[slot];
  };

  const state = resolveWeaponState({ classId, weapon });

  if (!state.allowsShield) drop("shield");
  // A shield wins over the off-hand: the legacy template hid the off-hand
  // whenever a shield was present.
  if (!state.classAllowsLeftWeapon || !state.allowsShield || !weapon) {
    drop("leftWeapon");
  } else if (next.shield?.itemId) {
    drop("leftWeapon");
  }

  if (!state.showAmmo) {
    drop("ammo");
  } else {
    const ammoId = next.ammo?.itemId;
    const ammo = ammoId ? itemById.get(ammoId) : undefined;
    if (
      ammo &&
      state.ammoSubTypeId !== null &&
      ammo.itemSubTypeId !== state.ammoSubTypeId
    ) {
      drop("ammo");
    }
  }

  // An off-hand item must still satisfy the dagger/one-hand-sword rule.
  const leftWeaponId = next.leftWeapon?.itemId;
  const leftWeapon = leftWeaponId ? itemById.get(leftWeaponId) : undefined;
  if (leftWeapon && !resolveWeaponCapabilities(leftWeapon).canEquipLeftWeapon) {
    drop("leftWeapon");
  }

  return { equipment: next, removed };
}
