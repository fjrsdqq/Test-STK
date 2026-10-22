"use client";

import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useState, type DragEvent } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFilteredTree } from "@/hooks/use-filtered-tree";
import { useMenuStore } from "@/store/menu-store";
import { TreeNode, type DropPosition } from "@/components/tree-node";
import type { Menu } from "@/types/menu";

function findMenu(tree: Menu[], id: string): Menu | undefined {
  for (const menu of tree) {
    if (menu.id === id) return menu;
    const found = findMenu(menu.children, id);
    if (found) return found;
  }
}

interface TreeViewProps {
  onAddRoot: () => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TreeView({ onAddRoot, onAddChild, onDelete }: TreeViewProps) {
  const tree = useMenuStore((state) => state.tree);
  const expandedIds = useMenuStore((state) => state.expandedIds);
  const selectedId = useMenuStore((state) => state.selectedId);
  const searchQuery = useMenuStore((state) => state.searchQuery);
  const setSearch = useMenuStore((state) => state.setSearch);
  const toggleExpand = useMenuStore((state) => state.toggleExpand);
  const expandAll = useMenuStore((state) => state.expandAll);
  const collapseAll = useMenuStore((state) => state.collapseAll);
  const selectMenu = useMenuStore((state) => state.selectMenu);
  const moveMenu = useMenuStore((state) => state.moveMenu);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition } | null>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const filtered = useFilteredTree(tree, debouncedSearch);

  function handleDragStart(id: string, event: DragEvent<HTMLDivElement>) {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDragId(id);
  }

  function handleDragOver(id: string, position: DropPosition, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget({ id, position });
  }

  async function handleDrop(id: string, position: DropPosition, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setDropTarget(null);
    if (!sourceId || sourceId === id) return;
    const source = findMenu(tree, sourceId);
    const target = findMenu(tree, id);
    if (!source || !target) return;

    const parentId = position === "inside" ? target.id : (target.parent_id ?? null);
    let destination = position === "inside" ? undefined : target.position + (position === "after" ? 1 : 0);
    if (position !== "inside" && (source.parent_id ?? null) === parentId && source.position < target.position) destination!--;
    try {
      await moveMenu(sourceId, parentId, destination);
    } catch {
      // The store reports the API failure in its toast.
    }
  }

  return (
    <section aria-labelledby="tree-heading" className="min-w-0 rounded-xl border border-slate-100 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-3">
            <label htmlFor="menu-search" className="text-[11px] font-medium text-muted">Menu</label>
            <button type="button" onClick={onAddRoot} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-brand hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-brand"><span className="text-lg leading-none">+</span> Add menu</button>
          </div>
          <div className="relative max-w-[360px]">
            <Search aria-hidden="true" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input id="menu-search" type="search" value={searchQuery} onChange={(event) => setSearch(event.target.value)} placeholder="Search menus" className="field h-10 w-full pl-9 pr-3 text-xs" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={expandAll} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-slate-800 px-4 text-[11px] font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><ChevronDown size={13} /> Expand All</button>
          <button type="button" onClick={collapseAll} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-4 text-[11px] font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand"><ChevronUp size={13} /> Collapse All</button>
        </div>
      </div>

      {tree.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-brand"><Search size={18} /></div>
          <h2 className="text-sm font-semibold text-ink">No menus yet</h2>
          <p className="mt-1 text-xs text-muted">Create a menu to start building your hierarchy.</p>
          <button type="button" onClick={onAddRoot} className="mt-4 min-h-10 rounded-lg bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Add your first menu</button>
        </div>
      ) : filtered.tree.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-muted">No menus match “{debouncedSearch}”.</div>
      ) : (
        <ul role="tree" aria-label="Menu hierarchy" className="tree-root space-y-0.5 overflow-x-auto px-4 py-3">
          {!debouncedSearch && <li className="px-2 pb-2 text-[11px] text-muted">Drag a menu above or below a row to reorder it, or onto the center to nest it.</li>}
          {filtered.tree.map((menu) => (
            <TreeNode key={menu.id} menu={menu} depth={0} selectedId={selectedId} expandedIds={expandedIds} forcedExpandedIds={filtered.expandedIds} highlight={debouncedSearch} onSelect={selectMenu} onToggle={toggleExpand} onAddChild={onAddChild} onDelete={onDelete} canDrag={!debouncedSearch} dragId={dragId} dropTarget={dropTarget} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} onDragEnd={() => { setDragId(null); setDropTarget(null); }} />
          ))}
        </ul>
      )}
    </section>
  );
}
