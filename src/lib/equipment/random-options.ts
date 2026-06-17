import type { ItemOption } from "@/lib/knowledge/types";

export interface RandomOptionNode {
  label: string;
  value: string;
  children?: RandomOptionNode[];
}

const ELEMENTS = [
  "Neutral",
  "Water",
  "Earth",
  "Fire",
  "Wind",
  "Poison",
  "Holy",
  "Dark",
  "Ghost",
  "Undead",
] as const;

const RACES = [
  "Formless",
  "Undead",
  "Brute",
  "Plant",
  "Insect",
  "Fish",
  "Demon",
  "DemiHuman",
  "Angel",
  "Dragon",
] as const;

function leaves(
  from: number,
  to: number,
  create: (value: number) => RandomOptionNode,
): RandomOptionNode[] {
  return Array.from({ length: to - from + 1 }, (_, index) =>
    create(from + index),
  );
}

function rangedValues(
  label: string,
  key: string,
  from: number,
  to: number,
  scale = 1,
  suffix = "",
  sign = "+",
): RandomOptionNode {
  const rangeSize = to - from > 20 ? 10 : to;
  const ranges: RandomOptionNode[] = [];
  for (let start = from; start <= to; start += rangeSize) {
    const end = Math.min(start + rangeSize - 1, to);
    ranges.push({
      label: `${label} ${start * scale}-${end * scale}${suffix}`,
      value: `${key}_${start}_${end}`,
      children: leaves(start, end, (value) => ({
        label: `${label} ${sign}${value * scale}${suffix}`,
        value: `${key}:${value * scale}`,
      })),
    });
  }

  return {
    label,
    value: key,
    children: ranges.length === 1 ? ranges[0].children : ranges,
  };
}

function statGroup(
  label: string,
  options: ReadonlyArray<readonly [string, string]>,
  to: number,
): RandomOptionNode {
  return {
    label,
    value: label,
    children: options.map(([optionLabel, key]) =>
      rangedValues(optionLabel, key, 1, to),
    ),
  };
}

function damageTargetGroup(
  attackLabel: string,
  attackKey: "p" | "m",
): RandomOptionNode {
  const targetGroups = [
    ["Race", ["All", ...RACES]],
    ["Element", ["All", ...ELEMENTS]],
    ["Size", ["All", "Small", "Medium", "Large"]],
    ["Class", ["All", "Normal", "Boss"]],
  ] as const;

  return {
    label: attackLabel,
    value: attackKey,
    children: targetGroups.map(([targetLabel, targets]) => ({
      label: targetLabel,
      value: `${attackKey}_${targetLabel.toLowerCase()}`,
      children: targets.map((target) => {
        const normalized =
          targetLabel === "Size" && target !== "All"
            ? target[0].toLowerCase()
            : target.toLowerCase();
        return {
          label: target,
          value: `${attackKey}_${targetLabel}_${target}`,
          children: leaves(1, 25, (value) => ({
            label: `${attackKey.toUpperCase()}. ${targetLabel} ${target} +${value}%`,
            value: `${attackKey}_${targetLabel.toLowerCase()}_${normalized}:${value}`,
          })),
        };
      }),
    })),
  };
}

function penetrationGroup(
  label: string,
  key: string,
  targets: readonly string[],
): RandomOptionNode {
  return {
    label,
    value: key,
    children: targets.map((target) => ({
      label: target,
      value: `${key}${target.toLowerCase()}`,
      children: leaves(1, 100, (value) => ({
        label: `${label} ${target} ${value}%`,
        value: `${key}${target.toLowerCase()}:${value}`,
      })),
    })),
  };
}

let cachedTree: RandomOptionNode[] | null = null;

export function getLegacyRandomOptionTree(): RandomOptionNode[] {
  if (cachedTree) return cachedTree;

  const physical = damageTargetGroup("Physical", "p");
  const magical = damageTargetGroup("Magical", "m");
  physical.children?.push({
    label: "Ignore Size Penalty",
    value: "ignore_size_penalty:1",
  });
  magical.children?.push({
    label: "My Magical Element",
    value: "m_my_element",
    children: ["All", ...ELEMENTS].map((element) => ({
      label: element,
      value: `m_my_element_${element.toLowerCase()}`,
      children: leaves(1, 25, (value) => ({
        label: `M. My ${element} +${value}%`,
        value: `m_my_element_${element.toLowerCase()}:${value}`,
      })),
    })),
  });

  physical.children?.push(
    rangedValues("Atk", "atk", 1, 65),
    rangedValues("Atk %", "atkPercent", 1, 30, 1, "%"),
    rangedValues("Long Range", "range", 1, 30, 1, "%"),
    rangedValues("Melee", "melee", 1, 30, 1, "%"),
  );
  magical.children?.push(
    rangedValues("Matk", "matk", 1, 65),
    rangedValues("Matk %", "matkPercent", 1, 30, 1, "%"),
  );

  cachedTree = [
    physical,
    magical,
    penetrationGroup("Physical Penetration Race", "p_pene_race_", [
      "All",
      ...RACES,
    ]),
    penetrationGroup("Physical Penetration Class", "p_pene_class_", [
      "All",
      "Normal",
      "Boss",
    ]),
    penetrationGroup("Magical Penetration Race", "m_pene_race_", [
      "All",
      ...RACES,
    ]),
    penetrationGroup("Magical Penetration Class", "m_pene_class_", [
      "All",
      "Normal",
      "Boss",
    ]),
    rangedValues("CRI Rate", "cri", 1, 30, 1, "%"),
    rangedValues("CRI Damage", "criDmg", 1, 30, 1, "%"),
    rangedValues("ASPD", "aspd", 1, 5),
    rangedValues("ASPD %", "aspdPercent", 1, 30, 1, "%"),
    rangedValues("Delay", "acd", 1, 30, 1, "%", "-"),
    rangedValues("VCT", "vct", 1, 30, 1, "%", "-"),
    rangedValues("HP %", "hpPercent", 1, 20, 1, "%"),
    rangedValues("HP", "hp", 1, 20, 50),
    rangedValues("SP %", "spPercent", 1, 20, 1, "%"),
    rangedValues("SP", "sp", 1, 20, 20),
    statGroup(
      "Base Stat",
      [
        ["All Stat", "allStatus"],
        ["STR", "str"],
        ["AGI", "agi"],
        ["VIT", "vit"],
        ["INT", "int"],
        ["DEX", "dex"],
        ["LUK", "luk"],
      ],
      30,
    ),
    statGroup(
      "Trait Stat",
      [
        ["POW", "pow"],
        ["SPL", "spl"],
        ["STA", "sta"],
        ["WIS", "wis"],
        ["CON", "con"],
        ["CRT", "crt"],
        ["C.RATE", "cRate"],
        ["P.ATK", "pAtk"],
        ["S.MATK", "sMatk"],
      ],
      20,
    ),
  ];

  return cachedTree;
}

export function resolveRandomOptionPath(
  tree: RandomOptionNode[],
  path: string[],
): RandomOptionNode | null {
  let nodes = tree;
  let selected: RandomOptionNode | undefined;
  for (const value of path) {
    selected = nodes.find((node) => node.value === value);
    if (!selected) return null;
    nodes = selected.children ?? [];
  }
  return selected && !selected.children?.length ? selected : null;
}

export function findRandomOptionPath(
  tree: RandomOptionNode[],
  option: Pick<ItemOption, "key" | "value" | "unit">,
): string[] | null {
  const walk = (nodes: RandomOptionNode[], path: string[]): string[] | null => {
    for (const node of nodes) {
      const nextPath = [...path, node.value];
      if (!node.children?.length) {
        const nodeOption = toItemOption(node, option.value ?? 0);
        if (
          nodeOption.key === option.key &&
          nodeOption.value === option.value &&
          nodeOption.unit === option.unit
        ) {
          return nextPath;
        }
      }
      const found = node.children ? walk(node.children, nextPath) : null;
      if (found) return found;
    }
    return null;
  };

  return walk(tree, []);
}

const PERCENT_KEYS = new Set([
  "atkPercent",
  "matkPercent",
  "range",
  "melee",
  "cri",
  "criDmg",
  "aspdPercent",
  "acd",
  "vct",
  "hpPercent",
  "spPercent",
]);

export function toItemOption(
  node: RandomOptionNode,
  slot: number,
): ItemOption {
  const separator = node.value.lastIndexOf(":");
  const key = separator >= 0 ? node.value.slice(0, separator) : node.value;
  const rawValue = separator >= 0 ? node.value.slice(separator + 1) : "";
  const value = rawValue === "" ? undefined : Number(rawValue);
  const isPercent =
    PERCENT_KEYS.has(key) ||
    key.startsWith("p_") ||
    key.startsWith("m_");

  return {
    slot,
    key,
    value: Number.isFinite(value) ? value : undefined,
    unit: isPercent ? "percent" : "flat",
    label: node.label,
  };
}
