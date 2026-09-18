/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Builds the legacy Angular calculator into `public/legacy-calculator/` so the
 * `/calculator-v3` route can host the real page rather than a reimplementation.
 *
 * The output is the same application that runs at the upstream site: same
 * templates, same PrimeNG components, same stylesheet, same fixed 1500px grid.
 * The only addition is `ro-assistant-chat.js`, which appends the "Chat with AI"
 * accordion tab after "Item Descriptions" and leaves every legacy tab untouched.
 *
 * Requires the legacy project's dependencies:
 *   cd tong-calc-ro && npm install --legacy-peer-deps
 */
const { execFileSync } = require("node:child_process");
const {
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} = require("node:fs");
const { relative, resolve, sep } = require("node:path");

const projectRoot = resolve(__dirname, "..");
const legacyRoot = resolve(projectRoot, process.env.RO_LEGACY_ROOT ?? "tong-calc-ro");
const outputRoot = resolve(projectRoot, "public", "legacy-calculator");
const injectorSource = resolve(__dirname, "legacy-page", "ro-assistant-chat.js");
const injectorName = "ro-assistant-chat.js";
const baseHref = "/legacy-calculator/";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(resolve(legacyRoot, "angular.json"))) {
  fail(`Legacy project not found at ${legacyRoot}`);
}

if (!existsSync(resolve(legacyRoot, "node_modules", "@angular", "cli"))) {
  fail(
    "Legacy dependencies are not installed. Run:\n" +
      `  cd ${legacyRoot} && npm install --legacy-peer-deps`,
  );
}

console.log("Building legacy calculator...");
// Invoke the CLI entry point directly. Spawning `npx.cmd` fails with EINVAL on
// current Node for Windows unless a shell is used, and a shell would reintroduce
// the path rewriting that corrupts `--base-href`.
const angularCli = resolve(legacyRoot, "node_modules", "@angular", "cli", "bin", "ng.js");
execFileSync(
  process.execPath,
  [
    angularCli,
    "build",
    // The CLI resolves --output-path against the workspace root, so an absolute
    // path would be appended to it rather than used as-is.
    "--output-path",
    relative(legacyRoot, outputRoot).split(sep).join("/"),
    "--base-href",
    baseHref,
    "--output-hashing",
    "all",
  ],
  { cwd: legacyRoot, stdio: "inherit" },
);

const indexPath = resolve(outputRoot, "index.html");
if (!existsSync(indexPath)) fail("Build produced no index.html");

// The Angular build resolves `<base href>` itself; a shell that rewrites POSIX
// paths (Git Bash) can mangle it, which in turn breaks the theme stylesheet.
const html = readFileSync(indexPath, "utf8");
const baseMatch = html.match(/<base href="([^"]*)">/);
if (!baseMatch || baseMatch[1] !== baseHref) {
  fail(
    `Unexpected <base href> in the build output: ${baseMatch ? baseMatch[1] : "missing"}.\n` +
      "Run this script from PowerShell or with MSYS_NO_PATHCONV=1.",
  );
}

const themePath = resolve(
  outputRoot,
  "assets/layout/styles/theme/vela-green/theme.css",
);
if (!existsSync(themePath)) {
  fail("The PrimeNG theme stylesheet was not copied into the build output.");
}

copyFileSync(injectorSource, resolve(outputRoot, injectorName));

if (!html.includes(injectorName)) {
  writeFileSync(
    indexPath,
    html.replace(
      "</body>",
      `  <script src="${injectorName}" defer></script>\n</body>`,
    ),
    "utf8",
  );
}

console.log(`Legacy calculator ready at ${outputRoot}`);
console.log(`  base href     ${baseHref}`);
console.log(`  chat injector ${injectorName}`);
