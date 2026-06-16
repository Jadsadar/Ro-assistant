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
  if (typeof value !== "string") return fallback;
  const match = value.match(/==(\d+)$/);
  return match ? Number(match[1]) : fallback;
}

function skillChoices(skill) {
  if (Array.isArray(skill.levelList) && skill.levelList.length > 0) {
    return skill.levelList
      .filter((choice) => typeof choice?.value === "string")
      .map((choice) => ({
        label: String(choice.label || skill.label),
        value: choice.value,
        level: parseSkillLevel(choice.value),
      }));
  }

  return [
    {
      label: String(skill.label || skill.name || skill.value),
      value: String(skill.value),
      level: parseSkillLevel(skill.value),
    },
  ];
}

const { getClassDropdownList } = require(classListPath);
const records = getClassDropdownList().map((entry) => ({
  classId: Number(entry.value),
  className: String(entry.label),
  skills: entry.instant.atkSkills.map((skill) => ({
    name: String(skill.name),
    choices: skillChoices(skill),
  })),
}));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(records), "utf8");
console.log(
  `Skill catalog: ${records.length} classes, ${records.reduce(
    (sum, record) => sum + record.skills.length,
    0,
  )} skills generated`,
);
