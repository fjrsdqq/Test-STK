"use client";

import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { DragEvent, ReactNode } from "react";
import type { Menu } from "@/types/menu";

export type DropPosition = "before" | "inside" | "after";

interface TreeNodeProps {
  menu: Menu;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  forcedExpandedIds: Set<string>;
  highlight: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
  canDrag: boolean;
  dragId: string | null;
  dropTarget: { id: string; position: DropPosition } | null;
  onDragStart: (id: string, event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (id: string, position: DropPosition, event: DragEvent<HTMLDivElement>) => void;
  onDrop: (id: string, position: DropPosition, event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return <>{name}</>;
  const lowerName = name.toLocaleLowerCase();
  const lowerQuery = normalizedQuery.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lowerName.indexOf(lowerQuery);
  while (index >= 0) {
    if (index > cursor) parts.push(name.slice(cursor, index));
    parts.push(<mark key={`${index}-${cursor}`} className="rounded bg-amber-100 px-0.5 text-inherit">{name.slice(index, index + normalizedQuery.length)}</mark>);
    cursor = index + normalizedQuery.length;
    index = lowerName.indexOf(lowerQuery, cursor);
  }
  if (cursor < name.length) parts.push(name.slice(cursor));
  return <>{parts}</>;
}

export function TreeNode({ menu, depth, selectedId, expandedIds, forcedExpandedIds, highlight, onSelect, onToggle, onAddChild, onDelete, canDrag, dragId, dropTarget, onDragStart, onDragOver, onDrop, onDragEnd }: TreeNodeProps) {
  const hasChildren = menu.children.length > 0;
  const expanded = forcedExpandedIds.has(menu.id) || expandedIds.has(menu.id);
  const selected = selectedId === menu.id;

  return (
    <li aria-expanded={hasChildren ? expanded : undefined} aria-level={depth + 1} aria-selected={selected} role="treeitem" className="list-none">
      <div
        draggable={canDrag}
        onDragStart={(event) => onDragStart(menu.id, event)}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientY - rect.top) / rect.height;
          onDragOver(menu.id, ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside", event);
        }}
        onDrop={(event) => onDrop(menu.id, dropTarget?.id === menu.id ? dropTarget.position : "inside", event)}
        className={`tree-row group relative flex min-h-10 items-center rounded-md pr-1 ${selected ? "bg-brand/7" : "hover:bg-slate-50"} ${dragId === menu.id ? "opacity-40" : ""} ${dropTarget?.id === menu.id && dropTarget.position === "inside" ? "bg-blue-100 ring-2 ring-inset ring-brand" : ""} ${dropTarget?.id === menu.id && dropTarget.position === "before" ? "before:absolute before:inset-x-0 before:top-0 before:border-t-2 before:border-brand" : ""} ${dropTarget?.id === menu.id && dropTarget.position === "after" ? "after:absolute after:inset-x-0 after:bottom-0 after:border-b-2 after:border-brand" : ""}`}
      >
        <button
          type="button"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-600 focus-visible:outline-2 focus-visible:outline-brand"
          onClick={() => hasChildren && onToggle(menu.id)}
          aria-label={hasChildren ? `${expanded ? "Collapse" : "Expand"} ${menu.name}` : `${menu.name} has no children`}
          aria-expanded={hasChildren ? expanded : undefined}
          disabled={!hasChildren}
        >
          {hasChildren ? (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span className="h-1 w-1 rounded-full bg-slate-300" />}
        </button>
        <button type="button" onClick={() => onSelect(menu.id)} title={canDrag ? "Drag to reorder or drop in the center to nest" : undefined} className={`min-w-0 flex-1 truncate py-3 text-left text-[12px] leading-4 focus-visible:outline-2 focus-visible:outline-brand ${selected ? "font-semibold text-brand-ink" : "text-slate-700"}`}>
          <HighlightedName name={menu.name} query={highlight} />
        </button>
        <div className="ml-1 flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button type="button" onClick={() => onAddChild(menu.id)} className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white shadow-sm hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:h-8 sm:w-8" aria-label={`Add child to ${menu.name}`} title="Add child"><Plus size={14} /></button>
          <button type="button" onClick={() => onSelect(menu.id)} className="grid h-10 w-10 place-items-center rounded-md text-slate-500 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-brand sm:h-8 sm:w-8" aria-label={`Edit ${menu.name}`} title="Edit"><Pencil size={13} /></button>
          <button type="button" onClick={() => onDelete(menu.id)} className="grid h-10 w-10 place-items-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500 sm:h-8 sm:w-8" aria-label={`Delete ${menu.name}`} title="Delete"><Trash2 size={14} /></button>
        </div>
      </div>
      {hasChildren && expanded && (
        <ul role="group" className="tree-children ml-4 border-l border-tree-line pl-2">
          {menu.children.map((child) => (
            <TreeNode key={child.id} menu={child} depth={depth + 1} selectedId={selectedId} expandedIds={expandedIds} forcedExpandedIds={forcedExpandedIds} highlight={highlight} onSelect={onSelect} onToggle={onToggle} onAddChild={onAddChild} onDelete={onDelete} canDrag={canDrag} dragId={dragId} dropTarget={dropTarget} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd} />
          ))}
        </ul>
      )}
    </li>
  );
}
