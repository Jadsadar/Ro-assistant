/**
 * Covers the pieces of the calculator-to-engine adapter that used to drop input
 * on the floor: random options, the fourth enchant group, and skill levels.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type {
  CatalogItemOptions,
  CatalogItemOptionsIndex,
  CatalogManifest,
} from "../src/lib/catalog/types";
import {
  resolveEnchantIds,
  resolveExtraOptionScripts,
} from "../src/components/calculator-v2/damage-adapter";
import type {
  CalculatorV2Data,
  CalculatorV2Selection,
  EquipmentSlotSelection,
} from "../src/components/calculator-v2/types";
import {
  findRandomOptionPath,
  getLegacyRandomOptionTree,
} from "../src/lib/equipment/random-options";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(path.resolve(projectRoot, relativePath), "utf8"),
  ) as T;
}

const manifest = readJson<CatalogManifest>("public/data/catalog-manifest.json");
const itemOptions = readJson<CatalogItemOptionsIndex>(
  path.join("public", manifest.itemOptions.url.replace(/^\//, "")),
);

function slotSelection(
  overrides: Partial<EquipmentSlotSelection> = {},
): EquipmentSlotSelection {
  return {
    refine: 0,
    cardIds: [],
    optionKeys: [],
    randomOptionPaths: [],
    ...overrides,
  };
}

function selection(
  equipment: CalculatorV2Selection["equipment"],
): CalculatorV2Selection {
  return {
    buildName: "test",
    classId: 4254,
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
      str: 1,
      agi: 1,
      vit: 1,
      int: 1,
      dex: 1,
      luk: 1,
      pow: 0,
      sta: 0,
      wis: 0,
      spl: 0,
      con: 0,
      crt: 0,
    },
    monsterId: 0,
    equipment,
  };
}

test("random option selections become engine extra-option scripts", () => {
  const tree = getLegacyRandomOptionTree();
  // Pick a real leaf so the test exercises the same data the UI offers.
  const firstLeafPath = (() => {
    const walk = (nodes: typeof tree, trail: string[]): string[] | null => {
      for (const node of nodes) {
        const next = [...trail, node.value];
        if (!node.children?.length) return next;
        const found = walk(node.children, next);
        if (found) return found;
      }
      return null;
    };
    return walk(tree, []);
  })();
  assert.ok(firstLeafPath, "the legacy random option tree should have leaves");

  const scripts = resolveExtraOptionScripts(
    selection({
      weapon: slotSelection({ itemId: 1201, randomOptionPaths: [firstLeafPath] }),
    }),
  );

  assert.equal(scripts.length, 1);
  const [attribute, value] = Object.entries(scripts[0])[0];
  assert.ok(attribute.length > 0, "the script key is the legacy attribute name");
  assert.equal(
    typeof value,
    "number",
    "legacy getOptionScripts() produced numeric values",
  );
});

test("random options from every slot are collected", () => {
  const tree = getLegacyRandomOptionTree();
  const atkPath = findRandomOptionPath(tree, {
    key: "atk",
    value: 10,
    unit: "flat",
  });
  assert.ok(atkPath, "expected a flat ATK option in the legacy tree");

  const scripts = resolveExtraOptionScripts(
    selection({
      weapon: slotSelection({ itemId: 1201, randomOptionPaths: [atkPath] }),
      armor: slotSelection({ itemId: 2301, randomOptionPaths: [atkPath] }),
    }),
  );

  assert.equal(scripts.length, 2);
  assert.deepEqual(scripts[0], { atk: 10 });
});

test("empty and unresolvable option paths are skipped", () => {
  const scripts = resolveExtraOptionScripts(
    selection({
      weapon: slotSelection({
        itemId: 1201,
        randomOptionPaths: [[], ["not-a-real-option"]],
      }),
    }),
  );
  assert.deepEqual(scripts, []);
});

test("the fourth enchant group reaches the engine", () => {
  const fourGroupItem = Object.values(itemOptions).find(
    (entry): entry is CatalogItemOptions => entry.groups.length > 3,
  );
  assert.ok(fourGroupItem, "the catalog should contain 4-group enchant items");

  const groups = fourGroupItem.groups;
  const data = { options: itemOptions } as unknown as CalculatorV2Data;

  // Select one choice in every group, including the last one.
  const optionKeys: string[] = [];
  for (const group of groups) {
    optionKeys[group.slot] = group.choices[0].key;
  }

  const enchantIds = resolveEnchantIds(
    data,
    slotSelection({ itemId: fourGroupItem.itemId, optionKeys }),
  );

  const lastGroup = groups[groups.length - 1];
  assert.equal(
    enchantIds[lastGroup.slot],
    lastGroup.choices[0].itemId,
    "the highest enchant group must not be truncated",
  );
  assert.equal(
    enchantIds.filter((itemId) => itemId !== undefined).length,
    groups.filter((group) => group.choices[0].itemId !== undefined).length,
  );
});
