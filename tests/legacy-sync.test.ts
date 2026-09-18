import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  parseArguments,
  selectLatestStableTag,
} = require("../scripts/sync-legacy.cjs") as {
  parseArguments: (
    args: string[],
    environment?: Record<string, string>,
  ) => {
    ref: string;
    repository: string;
    dryRun: boolean;
    offline: boolean;
  };
  selectLatestStableTag: (tags: string[]) => string | null;
};

test("legacy sync selects the newest stable release tag", () => {
  assert.equal(
    selectLatestStableTag([
      "3.2.9",
      "3.10.0-beta.1",
      "v3.9.0",
      "3.10.0",
      "not-a-release",
    ]),
    "3.10.0",
  );
});

test("legacy sync accepts an explicit ref without enabling unsafe modes", () => {
  const options = parseArguments(
    ["--ref", "3.2.28", "--offline", "--dry-run"],
    {},
  );

  assert.equal(options.ref, "3.2.28");
  assert.equal(options.offline, true);
  assert.equal(options.dryRun, true);
});
