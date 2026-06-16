import type { CharacterStats } from "@/lib/equipment/types";

export interface CalculatorClass {
  id: number;
  name: string;
  generation: 3 | 4 | "expanded";
}

export const CALCULATOR_CLASSES: CalculatorClass[] = [
  { id: 11, name: "Royal Guard", generation: 3 },
  { id: 4258, name: "Imperial Guard", generation: 4 },
  { id: 12, name: "Rune Knight", generation: 3 },
  { id: 4252, name: "Dragon Knight", generation: 4 },
  { id: 7, name: "Arch Bishop", generation: 3 },
  { id: 4256, name: "Cardinal", generation: 4 },
  { id: 13, name: "Sura", generation: 3 },
  { id: 4262, name: "Inquisitor", generation: 4 },
  { id: 2, name: "Ranger", generation: 3 },
  { id: 4257, name: "Windhawk", generation: 4 },
  { id: 21, name: "Minstrel", generation: 3 },
  { id: 4263, name: "Troubadour", generation: 4 },
  { id: 22, name: "Wanderer", generation: 3 },
  { id: 4264, name: "Trouvere", generation: 4 },
  { id: 5, name: "Guillotine Cross", generation: 3 },
  { id: 4254, name: "Shadow Cross", generation: 4 },
  { id: 4, name: "Shadow Chaser", generation: 3 },
  { id: 4260, name: "Abyss Chaser", generation: 4 },
  { id: 6, name: "Warlock", generation: 3 },
  { id: 4255, name: "Arch Mage", generation: 4 },
  { id: 8, name: "Sorcerer", generation: 3 },
  { id: 4261, name: "Elemental Master", generation: 4 },
  { id: 10, name: "Mechanic", generation: 3 },
  { id: 4253, name: "Meister", generation: 4 },
  { id: 9, name: "Genetic", generation: 3 },
  { id: 4259, name: "Biolo", generation: 4 },
  { id: 33, name: "Star Emperor", generation: "expanded" },
  { id: 4302, name: "Sky Emperor", generation: 4 },
  { id: 3, name: "Soul Reaper", generation: "expanded" },
  { id: 4303, name: "Soul Ascetic", generation: 4 },
  { id: 18, name: "Kagerou", generation: "expanded" },
  { id: 4304, name: "Shinkiro", generation: 4 },
  { id: 17, name: "Oboro", generation: "expanded" },
  { id: 4305, name: "Shiranui", generation: 4 },
  { id: 1, name: "Rebellion", generation: "expanded" },
  { id: 4306, name: "Night Watch", generation: 4 },
  { id: 30, name: "Super Novice", generation: "expanded" },
  { id: 4307, name: "Hyper Novice", generation: 4 },
  { id: 31, name: "Doram", generation: "expanded" },
  { id: 4308, name: "Spirit Handler", generation: 4 },
];

export const ATTACK_ELEMENTS = [
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

export type AttackElement = (typeof ATTACK_ELEMENTS)[number];

export const DEFAULT_CHARACTER_STATS: CharacterStats = {
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
};
