/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const legacyRoot = path.resolve(
  projectRoot,
  process.env.RO_LEGACY_ROOT || "tong-calc-ro",
);
const legacySourceRoot = path.resolve(legacyRoot, "src");
const outputPath = path.resolve(projectRoot, "public", "data", "skills.json");
const classListPath = path.resolve(
  legacySourceRoot,
  "app",
  "jobs",
  "_class-list.ts",
);

if (!fs.existsSync(classListPath)) {
  if (fs.existsSync(outputPath)) {
    console.warn(
      `Legacy skill source not found at ${legacyRoot}; using committed skills.json.`,
    );
    process.exit(0);
  }
  throw new Error(
    `Legacy skill source not found at ${legacyRoot}, and skills.json is missing.`,
  );
}

const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;

Module._resolveFilename = function resolveFilename(
  request,
  parent,
  isMain,
  options,
) {
  const mappedRequest = request.startsWith("src/")
    ? path.join(legacySourceRoot, request.slice(4))
    : request;
  return originalResolveFilename.call(
    this,
    mappedRequest,
    parent,
    isMain,
    options,
  );
};

Module._load = function load(request, parent, isMain) {
  if (request === "rxjs") {
    return {
      delay: () => (value) => value,
      take: () => (value) => value,
      of: (value) => ({ pipe: () => value }),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      experimentalDecorators: true,
      useDefineForClassFields: false,
    },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

function parseSkillLevel(value, fallback = 1) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return fallback;
  const match = value.match(/==(\d+)$/);
  if (match) return Number(match[1]);
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function cleanBonus(bonus) {
  if (!bonus || typeof bonus !== "object" || Array.isArray(bonus)) {
    return undefined;
  }
  return bonus;
}

function skillChoices(skill) {
  const source =
    Array.isArray(skill.levelList) && skill.levelList.length > 0
      ? skill.levelList
      : Array.isArray(skill.dropdown) && skill.dropdown.length > 0
        ? skill.dropdown
        : [
            {
              label: skill.label || skill.name || skill.value,
              value: skill.value,
            },
          ];

  return source
    .filter((choice) => choice?.value !== undefined && choice?.value !== null)
    .map((choice) => ({
      label: String(choice.label || skill.label || skill.name || choice.value),
      value: String(choice.value),
      level: parseSkillLevel(choice.skillLv ?? choice.value),
      ...(typeof choice.isUse === "boolean" ? { isUse: choice.isUse } : {}),
      ...(cleanBonus(choice.bonus) ? { bonus: cleanBonus(choice.bonus) } : {}),
    }));
}

function skillList(skills) {
  if (!Array.isArray(skills)) return [];
  return skills
    .map((skill) => ({
      name: String(skill.name || skill.label || skill.value),
      label: skill.label ? String(skill.label) : undefined,
      inputType: skill.inputType ? String(skill.inputType) : undefined,
      choices: skillChoices(skill),
    }))
    .filter((skill) => skill.name && skill.choices.length > 0);
}

const { getClassDropdownList } = require(classListPath);
const records = getClassDropdownList().map((entry) => ({
  classId: Number(entry.value),
  className: String(entry.label),
  skills: skillList(entry.instant.atkSkills),
  activeSkills: skillList(entry.instant.activeSkills),
  passiveSkills: skillList(entry.instant.passiveSkills),
}));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(records), "utf8");
console.log(
  `Skill catalog: ${records.length} classes, ${records.reduce(
    (sum, record) =>
      sum +
      record.skills.length +
      record.activeSkills.length +
      record.passiveSkills.length,
    0,
  )} skills generated`,
);
