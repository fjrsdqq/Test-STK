import type {
  ApiErrorPayload,
  CreateMenuPayload,
  Menu,
  MoveMenuPayload,
  ReorderMenuPayload,
  UpdateMenuPayload,
} from "@/types/menu";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: readonly unknown[];

  constructor(status: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api").replace(/\/+$/, "");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseApiError(value: unknown, status: number): ApiError {
  const payload = value as ApiErrorPayload;
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
  const code = typeof error?.code === "string" ? error.code : "REQUEST_FAILED";
  const message = typeof error?.message === "string" ? error.message : "Permintaan gagal. Coba lagi.";
  const details = Array.isArray(error?.details) ? error.details : [];
  return new ApiError(status, code, message, details);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body) headers.set("Content-Type", "application/json");
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Backend tidak dapat dihubungi. Periksa server lalu coba lagi.");
  }

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw parseApiError(body, response.status);
  return body as T;
}

export function listMenus(): Promise<Menu[]> {
  return request<Menu[]>("/menus");
}

export function getMenu(id: string): Promise<Menu> {
  return request<Menu>(`/menus/${encodeURIComponent(id)}`);
}

export function createMenu(payload: CreateMenuPayload): Promise<Menu> {
  return request<Menu>("/menus", { method: "POST", body: JSON.stringify(payload) });
}

export function updateMenu(id: string, payload: UpdateMenuPayload): Promise<Menu> {
  return request<Menu>(`/menus/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deleteMenu(id: string): Promise<void> {
  return request<void>(`/menus/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function moveMenu(id: string, payload: MoveMenuPayload): Promise<Menu> {
  return request<Menu>(`/menus/${encodeURIComponent(id)}/move`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function reorderMenu(id: string, payload: ReorderMenuPayload): Promise<Menu> {
  return request<Menu>(`/menus/${encodeURIComponent(id)}/reorder`, { method: "PATCH", body: JSON.stringify(payload) });
}
