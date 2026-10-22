"use client";

import { useMemo } from "react";
import type { Menu } from "@/types/menu";

interface FilteredTree {
  tree: Menu[];
  expandedIds: Set<string>;
}

function filterNodes(nodes: Menu[], query: string, expandedIds: Set<string>): Menu[] {
  const result: Menu[] = [];
  for (const node of nodes) {
    const children = filterNodes(node.children, query, expandedIds);
    const matches = node.name.toLocaleLowerCase().includes(query);
    if (matches || children.length > 0) {
      if (children.length > 0) expandedIds.add(node.id);
      result.push({ ...node, children });
    }
  }
  return result;
}

export function useFilteredTree(tree: Menu[], query: string): FilteredTree {
  return useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return { tree, expandedIds: new Set<string>() };
    const expandedIds = new Set<string>();
    return { tree: filterNodes(tree, normalized, expandedIds), expandedIds };
  }, [tree, query]);
}
