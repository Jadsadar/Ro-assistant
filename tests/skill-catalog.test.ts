import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CatalogClassSkills } from "../src/lib/catalog/types";

const skillCatalog = JSON.parse(
  readFileSync("public/data/skills.json", "utf8"),
) as CatalogClassSkills[];

test("static skill catalog covers every legacy calculator class", () => {
  assert.equal(skillCatalog.length, 40);
  assert.equal(
    new Set(skillCatalog.map((record) => record.classId)).size,
    skillCatalog.length,
  );
});

test("skill choices retain calculator values and levels", () => {
  const shadowCross = skillCatalog.find(
    (record) => record.classId === 4254,
  );
  const crossImpact = shadowCross?.skills.find(
    (skill) => skill.name === "Cross Impact",
  );
  const choice = crossImpact?.choices.find(
    (entry) => entry.value === "Cross Impact==5",
  );

  assert.equal(choice?.level, 5);
  assert.match(choice?.label ?? "", /Cross Impact/);
});
