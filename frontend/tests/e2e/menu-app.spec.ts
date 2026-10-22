import { expect, test, type Route } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Menu } from "../../src/types/menu";

const rootId = "00000000-0000-4000-8000-000000000001";
const childId = "00000000-0000-4000-8000-000000000002";
const deepId = "00000000-0000-4000-8000-000000000003";

function initialTree(): Menu[] {
  return [{
    id: rootId,
    name: "Systems",
    position: 0,
    children: [{
      id: childId,
      name: "Administration",
      parent_id: rootId,
      position: 0,
      children: [{
        id: deepId,
        name: "User Registration",
        parent_id: childId,
        position: 0,
        children: [],
      }],
    }],
  }, { id: "00000000-0000-4000-8000-000000000004", name: "Reports", position: 1, children: [] }];
}

let menus: Menu[];
let nextId: number;
let failRequests: boolean;
let listDelayMs: number;

function findMenu(items: Menu[], id: string): Menu | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const found = findMenu(item.children, id);
    if (found) return found;
  }
}

function removeMenu(items: Menu[], id: string): boolean {
  const index = items.findIndex((item) => item.id === id);
  if (index >= 0) {
    items.splice(index, 1);
    return true;
  }
  return items.some((item) => removeMenu(item.children, id));
}

function takeMenu(items: Menu[], id: string): Menu | undefined {
  const index = items.findIndex((item) => item.id === id);
  if (index >= 0) return items.splice(index, 1)[0];
  for (const item of items) {
    const found = takeMenu(item.children, id);
    if (found) return found;
  }
}

function setPositions(items: Menu[], parentId?: string) {
  items.forEach((item, position) => {
    item.position = position;
    if (parentId) item.parent_id = parentId;
    else delete item.parent_id;
    setPositions(item.children, item.id);
  });
}

async function mockMenuApi(route: Route) {
  if (failRequests) {
    await route.abort("failed");
    return;
  }

  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace(/^.*\/api/, "");
  const method = request.method();

  if (method === "GET" && path === "/menus") {
    if (listDelayMs) await new Promise((resolve) => setTimeout(resolve, listDelayMs));
    await route.fulfill({ json: menus });
    return;
  }
  if (method === "POST" && path === "/menus") {
    const body = request.postDataJSON() as { name: string; parent_id?: string };
    const created: Menu = {
      id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
      name: body.name,
      parent_id: body.parent_id,
      position: body.parent_id ? (findMenu(menus, body.parent_id)?.children.length ?? 0) : menus.length,
      children: [],
    };
    if (body.parent_id) findMenu(menus, body.parent_id)?.children.push(created);
    else menus.push(created);
    await route.fulfill({ status: 201, json: created });
    return;
  }

  const match = path.match(/^\/menus\/([^/]+)$/);
  const moveMatch = path.match(/^\/menus\/([^/]+)\/move$/);
  if (moveMatch && method === "PATCH") {
    const source = takeMenu(menus, moveMatch[1]);
    const body = request.postDataJSON() as { parent_id: string | null; position?: number };
    const siblings = body.parent_id ? findMenu(menus, body.parent_id)?.children : menus;
    if (!source || !siblings) {
      await route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "menu not found", details: [] } } });
      return;
    }
    source.parent_id = body.parent_id ?? undefined;
    const at = Math.max(0, Math.min(body.position ?? siblings.length, siblings.length));
    siblings.splice(at, 0, source);
    setPositions(menus);
    await route.fulfill({ json: source });
    return;
  }
  if (match && method === "PUT") {
    const menu = findMenu(menus, match[1]);
    if (!menu) {
      await route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "menu not found", details: [] } } });
      return;
    }
    menu.name = (request.postDataJSON() as { name: string }).name;
    await route.fulfill({ json: menu });
    return;
  }
  if (match && method === "DELETE") {
    removeMenu(menus, match[1]);
    await route.fulfill({ status: 204, body: "" });
    return;
  }

  await route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "route not found", details: [] } } });
}

test.beforeEach(async ({ page }) => {
  menus = initialTree();
  nextId = 10;
  failRequests = false;
  listDelayMs = 0;
  await page.route("**/api/menus**", mockMenuApi);
});

test("shows initial loading, nested tree, expansion and deep search", async ({ page }) => {
  listDelayMs = 500;
  await page.goto("/");
  await expect(page.getByLabel("Loading menus")).toBeVisible();
  await expect(page.getByRole("treeitem", { name: /Systems/ })).toBeVisible();
  await expect(page.getByText("User Registration")).toBeVisible();

  await page.getByRole("button", { name: "Collapse All" }).click();
  await expect(page.getByText("User Registration")).toBeHidden();
  await page.getByRole("button", { name: "Expand All" }).click();
  await expect(page.getByText("User Registration")).toBeVisible();

  await page.getByRole("searchbox", { name: "Menu" }).fill("user registration");
  await expect(page.locator("mark")).toHaveText("User Registration");
  await expect(page.getByRole("tree").getByRole("button", { name: "Systems", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Menu" }).fill("no-such-menu");
  await expect(page.getByText(/No menus match/)).toBeVisible();
  await page.getByRole("searchbox", { name: "Menu" }).fill("");
  await expect(page.getByRole("tree").getByRole("button", { name: "Systems", exact: true })).toBeVisible();
});

test("creates a root and child, validates names, and shows mutation loading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("tree")).toBeVisible();

  await page.getByRole("button", { name: "Add menu", exact: false }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByLabel("Name");
  await expect(input).toHaveAttribute("maxlength", "255");
  await input.fill("   ");
  await dialog.getByRole("button", { name: "Create menu" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Name is required.");
  await expect(dialog.getByRole("button", { name: "Create menu" })).toBeEnabled();
  await input.fill("New root");
  listDelayMs = 400;
  await dialog.getByRole("button", { name: "Create menu" }).click();
  await expect(dialog.getByRole("button", { name: "Create menu" })).toBeDisabled();
  await expect(page.getByRole("tree").getByRole("button", { name: "New root", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add child to New root" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("New child");
  await page.getByRole("dialog").getByRole("button", { name: "Create menu" }).click();
  await expect(page.getByRole("tree").getByRole("button", { name: "New child", exact: true })).toBeVisible();
});

test("edits with cancel and Escape, then confirms cascade deletion", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit Administration" }).click();
  await page.getByRole("button", { name: "Edit menu" }).click();
  const nameInput = page.getByRole("textbox", { name: "Menu name" });
  await expect(nameInput).toHaveValue("Administration");
  await nameInput.fill("Discarded");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("tree").getByRole("button", { name: "Administration", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit Administration" }).click();
  await page.getByRole("button", { name: "Edit menu" }).click();
  await page.getByRole("textbox", { name: "Menu name" }).fill("Discarded with Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("textbox", { name: "Menu name" })).toHaveCount(0);
  await expect(page.getByRole("tree").getByRole("button", { name: "Administration", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit Administration" }).click();
  await page.getByRole("button", { name: "Edit menu" }).click();
  await page.getByRole("textbox", { name: "Menu name" }).fill("Admin Updated");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("tree").getByRole("button", { name: "Admin Updated", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Delete Systems" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("delete every child menu below it");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("User Registration", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete Systems" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete menu" }).click();
  await expect(page.getByRole("tree").getByRole("button", { name: "Reports", exact: true })).toBeVisible();
  await expect(page.getByText("User Registration", { exact: true })).toHaveCount(0);
});

test("moves a menu into another parent with drag and drop", async ({ page }) => {
  await page.goto("/");
  const source = page.getByRole("treeitem", { name: /Administration/ }).locator(":scope > .tree-row");
  const target = page.getByRole("treeitem", { name: /Reports/ }).locator(":scope > .tree-row");
  await source.dragTo(target);
  await expect(page.getByRole("treeitem", { name: /Reports/ }).getByRole("button", { name: "Administration", exact: true })).toBeVisible();
  await expect(page.getByText("Urutan menu berhasil diperbarui")).toBeVisible();
});

test("shows an error and Retry when the API is unreachable", async ({ page }) => {
  failRequests = true;
  await page.goto("/");
  await expect(page.locator("div[role=alert]").filter({ hasText: "Unable to load menus" })).toBeVisible();
  failRequests = false;
  await page.getByRole("button", { name: /Retry/ }).click();
  await expect(page.getByRole("tree")).toBeVisible();

  failRequests = true;
  await page.getByRole("button", { name: "Add menu", exact: false }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Offline menu");
  await page.getByRole("dialog").getByRole("button", { name: "Create menu" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Backend tidak dapat dihubungi");
});

test("keeps the 360px layout within the viewport and supports keyboard toggles", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const focusStyle = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return { outlineWidth: Number.parseFloat(style.outlineWidth), outlineStyle: style.outlineStyle };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(focusStyle.outlineWidth).toBeGreaterThan(0);

  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    expect(widths.document, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(widths.viewport);
  }

  await page.setViewportSize({ width: 360, height: 900 });
  await page.getByRole("button", { name: "Collapse Systems" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Administration", { exact: true })).toBeHidden();

  await page.getByRole("button", { name: "Add menu", exact: false }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Add menu", exact: false }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("captures desktop and mobile screenshots for the submission", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("tree")).toBeVisible();
  const screenshotDir = resolve(process.cwd(), "../docs/screenshots");
  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: resolve(screenshotDir, "menu-tree-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(screenshotDir, "menu-tree-mobile.png"), fullPage: true });
});
