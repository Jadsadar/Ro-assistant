/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const esbuild = require("esbuild");

const projectRoot = path.resolve(__dirname, "..");
const legacyRoot = path.resolve(
  projectRoot,
  process.env.RO_LEGACY_ROOT || "tong-calc-ro",
);
const legacySourceRoot = path.resolve(legacyRoot, "src");
const calculatorPath = path.resolve(
  legacySourceRoot,
  "app/layout/pages/ro-calculator/calculator.ts",
);
const outputPath = path.resolve(
  projectRoot,
  "src/generated/legacy-engine.mjs",
);

if (!fs.existsSync(calculatorPath)) {
  if (fs.existsSync(outputPath)) {
    console.warn(
      `Legacy calculator source not found at ${legacyRoot}; using committed generated engine.`,
    );
    process.exit(0);
  }
  throw new Error(
    `Legacy calculator source not found at ${legacyRoot}, and generated engine is missing.`,
  );
}

function readGitLabel() {
  try {
    const commit = execFileSync("git", ["-C", legacyRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    let ref = "detached";
    try {
      ref = execFileSync(
        "git",
        ["-C", legacyRoot, "describe", "--tags", "--exact-match", "HEAD"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      ).trim();
    } catch {
      // Detached non-release commits are identified by their hash.
    }
    return `${ref}@${commit}`;
  } catch {
    return "unknown";
  }
}

function resolveLegacyModule(request) {
  const basePath = path.resolve(legacySourceRoot, request);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    path.resolve(basePath, "index.ts"),
    path.resolve(basePath, "index.tsx"),
    path.resolve(basePath, "index.js"),
  ];
  const resolved = candidates.find(
    (candidate) =>
      fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
  if (!resolved) {
    throw new Error(`Cannot resolve legacy module: src/${request}`);
  }
  return resolved;
}

const legacyGitLabel = readGitLabel();

const entrySource = String.raw`
import { Calculator } from "./tong-calc-ro/src/app/layout/pages/ro-calculator/calculator.ts";
import { getClassDropdownList } from "./tong-calc-ro/src/app/jobs/_class-list.ts";
import { createMainModel } from "./tong-calc-ro/src/app/utils/create-main-model.ts";

const ENGINE_VERSION = ${JSON.stringify(legacyGitLabel)};
const STAT_KEYS = [
  "str", "agi", "vit", "int", "dex", "luk",
  "pow", "sta", "wis", "spl", "con", "crt",
];
const BASE_STAT_KEYS = new Set(["str", "agi", "vit", "int", "dex", "luk"]);
const MULTI_CARD_SLOTS = new Set(["weapon", "leftWeapon"]);

function asInteger(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function relationCardKey(slot, index) {
  return MULTI_CARD_SLOTS.has(slot)
    ? slot + "Card" + (index + 1)
    : slot + "Card";
}

function addEquipmentToModel(model, equipment) {
  for (const [slot, selection] of Object.entries(equipment || {})) {
    if (!selection || !selection.itemId) continue;
    model[slot] = asInteger(selection.itemId);
    model[slot + "Refine"] = asInteger(selection.refine);
    if (selection.grade) model[slot + "Grade"] = selection.grade;

    for (const [index, itemId] of (selection.cardIds || []).entries()) {
      if (!itemId) continue;
      if (!MULTI_CARD_SLOTS.has(slot) && index > 0) break;
      model[relationCardKey(slot, index)] = asInteger(itemId);
    }

    for (const [index, itemId] of (selection.enchantIds || []).entries()) {
      if (!itemId) continue;
      model[slot + "Enchant" + index] = asInteger(itemId);
    }
  }
}

function valuesForSkills(skills, values) {
  return skills.map((skill) => asInteger(values?.[skill.name], 0));
}

function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

export function calculateLegacyDamage(input) {
  const classEntry = getClassDropdownList().find(
    (entry) => Number(entry.value) === Number(input.classId),
  );
  if (!classEntry) {
    throw new Error("Unsupported class ID: " + input.classId);
  }

  const character = classEntry.instant;
  const skill = character.atkSkills.find(
    (entry) =>
      entry.value === input.skillValue ||
      (Array.isArray(entry.values) && entry.values.includes(input.skillValue)),
  );
  if (!skill) {
    throw new Error(
      "Unsupported skill for " + classEntry.label + ": " + input.skillValue,
    );
  }

  const activeSkillIds = valuesForSkills(
    character.activeSkills,
    input.activeSkillValues,
  );
  const passiveSkillIds = valuesForSkills(
    character.passiveSkills,
    input.passiveSkillValues,
  );
  const {
    equipAtks,
    masteryAtks,
    activeSkillNames,
    learnedSkillMap,
  } = character
    .setLearnSkills({ activeSkillIds, passiveSkillIds })
    .getSkillBonusAndName();

  const model = createMainModel();
  model.class = asInteger(input.classId);
  model.level = asInteger(input.baseLevel, 1);
  model.jobLevel = asInteger(input.jobLevel, 1);
  model.selectedAtkSkill = input.skillValue;
  model.propertyAtk = input.attackElement || "Neutral";
  model.activeSkills = activeSkillIds;
  model.passiveSkills = passiveSkillIds;
  for (const key of STAT_KEYS) {
    model[key] = asInteger(input.stats?.[key], BASE_STAT_KEYS.has(key) ? 1 : 0);
  }
  addEquipmentToModel(model, input.equipment);

  const items = Object.fromEntries(
    (input.items || []).map((item) => [Number(item.id), item]),
  );
  const consumableItemIds = input.consumableItemIds || [];
  const usedSupremeBattlePill = consumableItemIds.includes(12792);
  const effectiveConsumableItemIds = consumableItemIds.filter(
    (itemId) => !usedSupremeBattlePill || itemId !== 12791,
  );
  const consumableBonuses = effectiveConsumableItemIds
    .map((itemId) => items[itemId]?.script)
    .filter(Boolean);
  const aspdPotion = [657, 656, 645].find((itemId) =>
    consumableItemIds.includes(itemId),
  );
  model.consumables = [...effectiveConsumableItemIds];
  model.aspdPotions = consumableItemIds.filter((itemId) => itemId === 12684);
  const warnings = [];
  const missingItemIds = new Set();
  for (const selection of Object.values(input.equipment || {})) {
    if (!selection) continue;
    for (const itemId of [
      selection.itemId,
      ...(selection.cardIds || []),
      ...(selection.enchantIds || []),
    ]) {
      if (itemId && !items[itemId]) missingItemIds.add(itemId);
    }
  }
  if (missingItemIds.size > 0) {
    warnings.push(
      "Missing item details: " + [...missingItemIds].sort((a, b) => a - b).join(", "),
    );
  }
  if (!input.equipment?.weapon?.itemId) {
    warnings.push("No weapon selected; weapon ATK and weapon-type bonuses are zero.");
  }

  const calculator = new Calculator();
  calculator
    .setMasterItems(items)
    .setHpSpTable(input.hpSpTable || [])
    .setClass(character)
    .loadItemFromModel(model)
    .setMonster(input.monster)
    .setEquipAtkSkillAtk(equipAtks)
    .setBuffBonus({ masteryAtk: {}, equipAtk: {} })
    .setMasterySkillAtk(masteryAtks)
    .setConsumables(consumableBonuses)
    .setAspdPotion(aspdPotion)
    .setExtraOptions(input.extraOptionScripts || [])
    .setUsedSkillNames(activeSkillNames)
    .setLearnedSkills(learnedSkillMap)
    .setOffensiveSkill(input.skillValue)
    .prepareAllItemBonus()
    .calcAllAtk()
    .setSelectedChances([])
    .calcAllDefs()
    .calculateHpSp({ isUseHpL: consumableItemIds.includes(12424) })
    .calculateAllDamages(input.skillValue);

  const summary = calculator.getTotalSummary();
  const damage = summary.dmg || {};
  const calc = summary.calc || {};
  const calcSkill = summary.calcSkill || {};

  return {
    engine: "tong-calc-ro",
    engineVersion: ENGINE_VERSION,
    className: String(classEntry.label),
    skillName: String(skill.label || skill.name),
    targetName: String(input.monster?.name || ""),
    basic: {
      min: finiteOrZero(damage.basicMinDamage),
      max: finiteOrZero(damage.basicMaxDamage),
      criticalMin: finiteOrZero(damage.criMinDamage),
      criticalMax: finiteOrZero(damage.criMaxDamage),
      dps: finiteOrZero(damage.basicDps),
      accuracy: finiteOrZero(damage.accuracy),
      attackSpeed: finiteOrZero(calc.totalAspd),
      hitsPerSecond: finiteOrZero(calc.hitPerSecs),
    },
    skill: {
      min: finiteOrZero(damage.skillMinDamage),
      max: finiteOrZero(damage.skillMaxDamage),
      nonCriticalMin: finiteOrZero(damage.skillMinDamageNoCri),
      nonCriticalMax: finiteOrZero(damage.skillMaxDamageNoCri),
      dps: finiteOrZero(damage.skillDps),
      hits: finiteOrZero(damage.skillTotalHit),
      accuracy: finiteOrZero(damage.skillAccuracy),
      damageType: String(damage.dmgType || calcSkill.dmgType || ""),
      element: String(damage.skillPropertyAtk || calcSkill.propertySkill || ""),
    },
    defense: {
      def: finiteOrZero(calc.def),
      softDef: finiteOrZero(calc.softDef),
      mdef: finiteOrZero(calc.mdef),
      softMdef: finiteOrZero(calc.softMdef),
      res: finiteOrZero(calc.res),
      mres: finiteOrZero(calc.mres),
    },
    resources: {
      maxHp: finiteOrZero(calc.maxHp),
      maxSp: finiteOrZero(calc.maxSp),
    },
    warnings,
  };
}
`;

const rxjsStub = String.raw`
export const delay = () => (value) => value;
export const take = () => (value) => value;
export const of = (value) => ({ pipe: () => value });
`;

async function buildEngine() {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await esbuild.build({
    stdin: {
      contents: entrySource,
      loader: "ts",
      resolveDir: projectRoot,
      sourcefile: "legacy-engine-entry.ts",
    },
    outfile: outputPath,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "none",
    treeShaking: true,
    banner: {
      js: `// Generated from tong-calc-ro ${legacyGitLabel}; do not edit manually.`,
    },
    plugins: [
      {
        name: "legacy-paths",
        setup(build) {
          build.onResolve({ filter: /^src\// }, (args) => ({
            path: resolveLegacyModule(args.path.slice(4)),
          }));
          build.onResolve({ filter: /^rxjs$/ }, () => ({
            path: "rxjs-stub",
            namespace: "legacy-stub",
          }));
          build.onLoad(
            { filter: /^rxjs-stub$/, namespace: "legacy-stub" },
            () => ({ contents: rxjsStub, loader: "js" }),
          );
        },
      },
    ],
  });

  const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`Legacy damage engine: ${sizeKb} KB generated`);
}

buildEngine().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
