/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DEFAULT_REPOSITORY = "https://github.com/turugrura/tong-calc-ro.git";
const REQUIRED_SOURCE_PATHS = [
  "src/assets/demo/data/item.json",
  "src/assets/demo/data/monster.json",
  "src/assets/demo/data/hp_sp_table.json",
  "src/app/jobs/_class-list.ts",
  "src/app/constants/enchant_item/_enchant_table.ts",
  "src/app/constants/extra-option-table.ts",
];

const projectRoot = path.resolve(__dirname, "..");

function requireArgument(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function parseArguments(args, environment = process.env) {
  const options = {
    root: path.resolve(
      projectRoot,
      environment.RO_LEGACY_ROOT || "tong-calc-ro",
    ),
    repository: environment.RO_LEGACY_REPO || DEFAULT_REPOSITORY,
    ref: environment.RO_LEGACY_REF || "latest",
    dryRun: false,
    offline: false,
    status: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--root") {
      options.root = path.resolve(
        projectRoot,
        requireArgument(args, index, argument),
      );
      index += 1;
    } else if (argument === "--repo") {
      options.repository = requireArgument(args, index, argument);
      index += 1;
    } else if (argument === "--ref") {
      options.ref = requireArgument(args, index, argument);
      index += 1;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--offline") {
      options.offline = true;
    } else if (argument === "--status") {
      options.status = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  return options;
}

function run(command, args, { cwd = projectRoot, inherit = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      `${command} ${args.join(" ")} failed${detail ? `:\n${detail}` : ""}`,
    );
  }

  return (result.stdout || "").trim();
}

function tryRun(command, args, options) {
  try {
    return run(command, args, options);
  } catch {
    return null;
  }
}

function git(root, args, options) {
  return run("git", ["-C", root, ...args], options);
}

function tryGit(root, args) {
  return tryRun("git", ["-C", root, ...args]);
}

function parseStableReleaseTag(tag) {
  const match = tag.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    tag: tag.trim(),
    version: match.slice(1).map(Number),
  };
}

function selectLatestStableTag(tags) {
  const releases = tags
    .map(parseStableReleaseTag)
    .filter(Boolean)
    .sort((left, right) => {
      for (let index = 0; index < 3; index += 1) {
        const difference = right.version[index] - left.version[index];
        if (difference !== 0) return difference;
      }
      return right.tag.localeCompare(left.tag);
    });
  return releases[0]?.tag ?? null;
}

function listTags(root) {
  const output = git(root, ["tag", "--list"]);
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function resolveTarget(root, requestedRef) {
  let ref = requestedRef;
  if (ref === "latest") {
    ref = selectLatestStableTag(listTags(root));
    if (!ref) {
      console.warn("No stable release tag found; falling back to origin/main.");
      ref = "origin/main";
    }
  }

  const candidates = ref.startsWith("refs/")
    ? [ref]
    : ref.startsWith("origin/")
      ? [`refs/remotes/${ref}`, ref]
      : [`refs/tags/${ref}`, `refs/remotes/origin/${ref}`, ref];

  for (const candidate of candidates) {
    const commit = tryGit(root, [
      "rev-parse",
      "--verify",
      `${candidate}^{commit}`,
    ]);
    if (commit) {
      return { requestedRef, resolvedRef: candidate, commit };
    }
  }

  throw new Error(
    `Cannot resolve legacy ref "${requestedRef}". Run without --offline to fetch tags first.`,
  );
}

function getRepositoryState(root) {
  const commit = git(root, ["rev-parse", "HEAD"]);
  const exactTag = tryGit(root, ["describe", "--tags", "--exact-match", "HEAD"]);
  const branch = tryGit(root, ["symbolic-ref", "--short", "-q", "HEAD"]);
  const origin = tryGit(root, ["remote", "get-url", "origin"]);
  const trackedChanges = git(root, [
    "status",
    "--porcelain",
    "--untracked-files=no",
  ]);
  const status = git(root, ["status", "--porcelain", "--untracked-files=normal"]);
  const untrackedCount = status
    ? status.split(/\r?\n/).filter((line) => line.startsWith("??")).length
    : 0;

  return {
    commit,
    ref: exactTag || branch || "detached",
    origin,
    trackedChanges,
    untrackedCount,
  };
}

function validateLegacySource(root) {
  const missing = REQUIRED_SOURCE_PATHS.filter(
    (relativePath) => !fs.existsSync(path.resolve(root, relativePath)),
  );
  if (missing.length > 0) {
    throw new Error(
      `Legacy checkout is missing required sources:\n${missing
        .map((entry) => `- ${entry}`)
        .join("\n")}`,
    );
  }
}

function isEmptyDirectory(directory) {
  return fs.existsSync(directory) && fs.readdirSync(directory).length === 0;
}

function ensureRepository(options) {
  const gitDirectory = path.resolve(options.root, ".git");
  if (fs.existsSync(gitDirectory)) return;

  if (fs.existsSync(options.root) && !isEmptyDirectory(options.root)) {
    throw new Error(
      `Legacy root exists but is not a Git repository: ${options.root}`,
    );
  }

  if (options.dryRun) {
    console.log(`Would clone ${options.repository} into ${options.root}`);
    return;
  }

  fs.mkdirSync(path.dirname(options.root), { recursive: true });
  console.log(`Cloning ${options.repository}...`);
  run("git", ["clone", options.repository, options.root], { inherit: true });
}

function printStatus(options) {
  if (!fs.existsSync(path.resolve(options.root, ".git"))) {
    console.log(`Legacy repository not found: ${options.root}`);
    return;
  }

  const state = getRepositoryState(options.root);
  const latestTag = selectLatestStableTag(listTags(options.root));
  console.log(`Root: ${options.root}`);
  console.log(`Origin: ${state.origin || "(none)"}`);
  console.log(`Current ref: ${state.ref}`);
  console.log(`Current commit: ${state.commit}`);
  console.log(`Latest local release tag: ${latestTag || "(none)"}`);
  console.log(`Tracked changes: ${state.trackedChanges ? "yes" : "no"}`);
  console.log(`Untracked entries: ${state.untrackedCount}`);
}

function printHelp() {
  console.log(`Usage: node scripts/sync-legacy.cjs [options]

Options:
  --ref <latest|tag|branch|commit>  Target ref (default: latest stable tag)
  --root <path>                    Legacy checkout path
  --repo <url>                     Repository URL used when cloning
  --offline                        Do not fetch before resolving the ref
  --dry-run                        Show the target without checkout
  --status                         Show local legacy source status
  -h, --help                       Show this help

Environment:
  RO_LEGACY_ROOT, RO_LEGACY_REPO, RO_LEGACY_REF`);
}

function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.help) {
    printHelp();
    return;
  }
  if (options.status) {
    printStatus(options);
    return;
  }

  ensureRepository(options);
  if (options.dryRun && !fs.existsSync(path.resolve(options.root, ".git"))) {
    return;
  }

  const before = getRepositoryState(options.root);
  if (before.trackedChanges) {
    throw new Error(
      `Refusing to update ${options.root} because it has tracked changes:\n${before.trackedChanges}`,
    );
  }

  if (!options.offline) {
    if (!before.origin) {
      throw new Error("Legacy repository has no origin remote.");
    }
    console.log(`Fetching tags from ${before.origin}...`);
    git(options.root, ["fetch", "--prune", "--tags", "origin"], {
      inherit: true,
    });
  }

  const target = resolveTarget(options.root, options.ref);
  console.log(`Current: ${before.ref} (${before.commit.slice(0, 12)})`);
  console.log(
    `Target: ${target.resolvedRef} (${target.commit.slice(0, 12)})`,
  );

  if (options.dryRun) {
    console.log("Dry run only; checkout was not changed.");
    return;
  }

  if (before.commit !== target.commit) {
    git(options.root, ["checkout", "--detach", target.commit], {
      inherit: true,
    });
  }

  validateLegacySource(options.root);
  const after = getRepositoryState(options.root);
  console.log(
    `Legacy source ready at ${after.ref} (${after.commit.slice(0, 12)}).`,
  );
  if (after.untrackedCount > 0) {
    console.log(`Preserved ${after.untrackedCount} untracked entries.`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArguments,
  parseStableReleaseTag,
  resolveTarget,
  selectLatestStableTag,
};
