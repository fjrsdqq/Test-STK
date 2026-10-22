export interface Menu {
  id: string;
  name: string;
  parent_id?: string;
  position: number;
  created_at?: string;
  updated_at?: string;
  children: Menu[];
}

export interface CreateMenuPayload {
  name: string;
  parent_id?: string;
}

export interface UpdateMenuPayload {
  name: string;
}

export interface MoveMenuPayload {
  parent_id: string | null;
  position?: number;
}

export interface ReorderMenuPayload {
  position: number;
}

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown[];
  };
}
