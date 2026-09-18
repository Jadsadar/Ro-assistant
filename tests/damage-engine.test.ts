import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { calculateLegacyDamage } from "../src/generated/legacy-engine.mjs";
import type {
  CatalogHpSpTable,
  CatalogItemDetail,
  CatalogManifest,
  CatalogMonster,
} from "../src/lib/catalog/types";
import type { DamageCalculationInput } from "../src/lib/calculator/damage-engine";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(path.resolve(projectRoot, relativePath), "utf8"),
  ) as T;
}

function publicAsset<T>(url: string): T {
  return readJson<T>(path.join("public", url.replace(/^\//, "")));
}

function createRoyalGuardFixture(): DamageCalculationInput {
  const manifest = readJson<CatalogManifest>(
    "public/data/catalog-manifest.json",
  );
  const weaponAsset = manifest.chunks.find(
    (chunk) => chunk.id === "equipment-weapon",
  );
  if (!weaponAsset) throw new Error("Weapon catalog chunk is missing");

  const pike = publicAsset<CatalogItemDetail[]>(weaponAsset.url).find(
    (item) => item.id === 1408,
  );
  const monster = Object.values(
    publicAsset<Record<string, CatalogMonster>>(manifest.monsters.url),
  ).find((entry) => entry.id === 20531);
  if (!pike || !monster) throw new Error("Golden fixture data is missing");

  return {
    classId: 11,
    baseLevel: 200,
    jobLevel: 70,
    skillValue: "Banishing Point==10",
    attackElement: "Neutral",
    stats: {
      str: 120,
      agi: 90,
      vit: 100,
      int: 1,
      dex: 100,
      luk: 30,
      pow: 0,
      sta: 0,
      wis: 0,
      spl: 0,
      con: 0,
      crt: 0,
    },
    monster,
    items: [pike],
    equipment: {
      weapon: {
        itemId: 1408,
        refine: 0,
        cardIds: [],
        enchantIds: [],
      },
    },
    hpSpTable: publicAsset<CatalogHpSpTable>(manifest.hpSpTable.url),
  };
}

test("legacy parity fixture calculates Banishing Point damage", () => {
  const result = calculateLegacyDamage(createRoyalGuardFixture());

  assert.deepEqual(result.skill, {
    min: 4524,
    max: 4574,
    nonCriticalMin: 0,
    nonCriticalMax: 0,
    dps: 4549,
    hits: 1,
    accuracy: 100,
    damageType: "Range",
    element: "Neutral",
  });
  assert.deepEqual(result.basic, {
    min: 182,
    max: 185,
    criticalMin: 259,
    criticalMax: 259,
    dps: 186,
    accuracy: 100,
    attackSpeed: 165,
    hitsPerSecond: 1,
  });
});

test("weapon refine changes deterministic damage", () => {
  const input = createRoyalGuardFixture();
  const baseline = calculateLegacyDamage(input);
  const refined = calculateLegacyDamage({
    ...input,
    equipment: {
      weapon: {
        ...input.equipment.weapon!,
        refine: 10,
      },
    },
  });

  assert.equal(refined.skill.min, 4672);
  assert.equal(refined.skill.max, 4761);
  assert.ok(refined.skill.min > baseline.skill.min);
});
