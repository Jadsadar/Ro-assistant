import assert from "node:assert/strict";
import test from "node:test";
import {
  getLegacyRandomOptionTree,
  resolveRandomOptionPath,
  toItemOption,
} from "../src/lib/equipment/random-options";

function findPath(value: string): string[] {
  const walk = (
    nodes: ReturnType<typeof getLegacyRandomOptionTree>,
    path: string[],
  ): string[] | null => {
    for (const node of nodes) {
      const nextPath = [...path, node.value];
      if (node.value === value) return nextPath;
      const found = node.children ? walk(node.children, nextPath) : null;
      if (found) return found;
    }
    return null;
  };

  const path = walk(getLegacyRandomOptionTree(), []);
  assert.ok(path, `Missing legacy option ${value}`);
  return path;
}

test("legacy random option tree retains calculator values", () => {
  const tree = getLegacyRandomOptionTree();
  const range = resolveRandomOptionPath(tree, findPath("range:5"));
  const penetration = resolveRandomOptionPath(
    tree,
    findPath("p_pene_race_demon:10"),
  );

  assert.equal(range?.label, "Long Range +5%");
  assert.equal(penetration?.label, "Physical Penetration Race Demon 10%");
});

test("legacy random options become structured calculator options", () => {
  const tree = getLegacyRandomOptionTree();
  const node = resolveRandomOptionPath(tree, findPath("range:5"));
  assert.ok(node);
  assert.deepEqual(toItemOption(node, 2), {
    slot: 2,
    key: "range",
    value: 5,
    unit: "percent",
    label: "Long Range +5%",
  });
});
