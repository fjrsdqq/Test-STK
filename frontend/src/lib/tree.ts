import type { Menu } from "@/types/menu";

export interface MenuDetails {
  menu: Menu;
  depth: number;
  parent: Menu | null;
}

export function getMenuDetails(tree: Menu[], id: string | null, depth = 0, parent: Menu | null = null): MenuDetails | null {
  if (!id) return null;
  for (const menu of tree) {
    if (menu.id === id) return { menu, depth, parent };
    const child = getMenuDetails(menu.children, id, depth + 1, menu);
    if (child) return child;
  }
  return null;
}

export function getRootMenuId(tree: Menu[], id: string | null): string | null {
  if (!id) return null;
  for (const menu of tree) {
    if (menu.id === id) return menu.id;
    const found = getRootMenuId(menu.children, id);
    if (found) return menu.id;
  }
  return null;
}
