"use client";

import {
  resolveRandomOptionPath,
  type RandomOptionNode,
} from "@/lib/equipment/random-options";

interface RandomOptionCascadeProps {
  index: number;
  path: string[];
  tree: RandomOptionNode[];
  onChange: (path: string[]) => void;
}

export function RandomOptionCascade({
  index,
  path,
  tree,
  onChange,
}: RandomOptionCascadeProps) {
  const levels: Array<{
    nodes: RandomOptionNode[];
    selected: string;
  }> = [];
  let nodes = tree;
  let depth = 0;

  while (nodes.length > 0) {
    const selected = path[depth] ?? "";
    levels.push({ nodes, selected });
    if (!selected) break;
    const selectedNode = nodes.find((node) => node.value === selected);
    if (!selectedNode?.children?.length) break;
    nodes = selectedNode.children;
    depth += 1;
  }

  return (
    <fieldset className="option-cascade">
      <legend>Random Option {index + 1}</legend>
      {levels.map((level, levelIndex) => (
        <select
          aria-label={`Random Option ${index + 1} level ${levelIndex + 1}`}
          key={levelIndex}
          onChange={(event) => {
            const nextPath = path.slice(0, levelIndex);
            if (event.target.value) nextPath.push(event.target.value);
            onChange(nextPath);
          }}
          value={level.selected}
        >
          <option value="">
            {levelIndex === 0 ? "Select option type" : "Select detail"}
          </option>
          {level.nodes.map((node) => (
            <option key={node.value} value={node.value}>
              {node.label}
            </option>
          ))}
        </select>
      ))}
      <small>
        {resolveRandomOptionPath(tree, path)?.label ??
          "Select until the final option value"}
      </small>
    </fieldset>
  );
}
