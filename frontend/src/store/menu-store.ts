"use client";

import { create } from "zustand";
import {
  ApiError,
  createMenu as apiCreateMenu,
  deleteMenu as apiDeleteMenu,
  listMenus,
  moveMenu as apiMoveMenu,
  updateMenu as apiUpdateMenu,
} from "@/lib/api/menu-api";
import type { Menu } from "@/types/menu";

interface MenuStore {
  tree: Menu[];
  expandedIds: Set<string>;
  selectedId: string | null;
  searchQuery: string;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  actionError: string | null;
  toast: { id: number; message: string; tone: "success" | "error" } | null;
  fetchTree: () => Promise<void>;
  addMenu: (name: string, parentId?: string) => Promise<void>;
  editMenu: (id: string, name: string) => Promise<void>;
  removeMenu: (id: string) => Promise<void>;
  moveMenu: (id: string, parentId: string | null, position?: number) => Promise<void>;
  toggleExpand: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  selectMenu: (id: string | null) => void;
  setSearch: (query: string) => void;
  clearToast: (id: number) => void;
  clearActionError: () => void;
}

function collectExpandedIds(nodes: Menu[], result = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.children.length > 0) result.add(node.id);
    collectExpandedIds(node.children, result);
  }
  return result;
}

function findMenu(nodes: Menu[], id: string): Menu | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findMenu(node.children, id);
    if (found) return found;
  }
  return null;
}

function collectIds(nodes: Menu[], ids = new Set<string>()): Set<string> {
  for (const node of nodes) {
    ids.add(node.id);
    collectIds(node.children, ids);
  }
  return ids;
}

function pathToMenu(nodes: Menu[], id: string, path: string[] = []): string[] {
  for (const node of nodes) {
    const nextPath = [...path, node.id];
    if (node.id === id) return nextPath;
    const childPath = pathToMenu(node.children, id, nextPath);
    if (childPath.length > 0) return childPath;
  }
  return [];
}

function failureMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Terjadi kesalahan. Silakan coba lagi.";
}

function notify(message: string, tone: "success" | "error"): MenuStore["toast"] {
  return { id: Date.now(), message, tone };
}

export const useMenuStore = create<MenuStore>((set, get) => ({
  tree: [],
  expandedIds: new Set<string>(),
  selectedId: null,
  searchQuery: "",
  isLoading: false,
  isMutating: false,
  error: null,
  actionError: null,
  toast: null,

  fetchTree: async () => {
    const wasEmpty = get().tree.length === 0;
    set({ isLoading: true, error: null });
    try {
      const tree = await listMenus();
      const ids = collectIds(tree);
      const currentSelection = get().selectedId;
      const selectedId = currentSelection && ids.has(currentSelection) ? currentSelection : (tree[0]?.id ?? null);
      const expandedIds = wasEmpty ? collectExpandedIds(tree) : new Set([...get().expandedIds].filter((id) => ids.has(id)));
      set({ tree, selectedId, expandedIds, isLoading: false, error: null });
    } catch (error) {
      set({ isLoading: false, error: failureMessage(error) });
    }
  },

  addMenu: async (name, parentId) => {
    set({ isMutating: true, actionError: null });
    try {
      const created = await apiCreateMenu({ name, ...(parentId ? { parent_id: parentId } : {}) });
      await get().fetchTree();
      const expandedIds = new Set(get().expandedIds);
      if (parentId) {
        for (const ancestorId of pathToMenu(get().tree, parentId)) expandedIds.add(ancestorId);
      }
      set({ selectedId: created.id, expandedIds, isMutating: false, actionError: null, toast: notify("Menu berhasil ditambahkan", "success") });
    } catch (error) {
      const message = failureMessage(error);
      set({ isMutating: false, actionError: message, toast: notify(message, "error") });
      throw error;
    }
  },

  editMenu: async (id, name) => {
    set({ isMutating: true, actionError: null });
    try {
      await apiUpdateMenu(id, { name });
      await get().fetchTree();
      set({ selectedId: id, isMutating: false, actionError: null, toast: notify("Nama menu berhasil diperbarui", "success") });
    } catch (error) {
      const message = failureMessage(error);
      set({ isMutating: false, actionError: message, toast: notify(message, "error") });
      throw error;
    }
  },

  removeMenu: async (id) => {
    const menu = findMenu(get().tree, id);
    const currentSelection = get().selectedId;
    const selectedWasDeleted = Boolean(menu && currentSelection && collectIds([menu]).has(currentSelection));
    set({ isMutating: true, actionError: null });
    try {
      await apiDeleteMenu(id);
      await get().fetchTree();
      if (selectedWasDeleted) set({ selectedId: menu?.parent_id ?? get().tree[0]?.id ?? null });
      set({ isMutating: false, actionError: null, toast: notify("Menu dan semua turunannya berhasil dihapus", "success") });
    } catch (error) {
      const message = failureMessage(error);
      set({ isMutating: false, actionError: message, toast: notify(message, "error") });
      throw error;
    }
  },

  moveMenu: async (id, parentId, position) => {
    set({ isMutating: true, actionError: null });
    try {
      await apiMoveMenu(id, { parent_id: parentId, ...(position === undefined ? {} : { position }) });
      await get().fetchTree();
      const expandedIds = new Set(get().expandedIds);
      if (parentId) {
        for (const ancestorId of pathToMenu(get().tree, parentId)) expandedIds.add(ancestorId);
      }
      set({ selectedId: id, expandedIds, isMutating: false, actionError: null, toast: notify("Urutan menu berhasil diperbarui", "success") });
    } catch (error) {
      const message = failureMessage(error);
      set({ isMutating: false, actionError: message, toast: notify(message, "error") });
      throw error;
    }
  },

  toggleExpand: (id) => {
    const expandedIds = new Set(get().expandedIds);
    if (expandedIds.has(id)) expandedIds.delete(id);
    else expandedIds.add(id);
    set({ expandedIds });
  },
  expandAll: () => set({ expandedIds: collectExpandedIds(get().tree) }),
  collapseAll: () => set({ expandedIds: new Set<string>() }),
  selectMenu: (id) => set({ selectedId: id, actionError: null }),
  setSearch: (searchQuery) => set({ searchQuery }),
  clearToast: (id) => {
    if (get().toast?.id === id) set({ toast: null });
  },
  clearActionError: () => set({ actionError: null }),
}));
