"use client";

import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMenuStore } from "@/store/menu-store";
import { getMenuDetails } from "@/lib/tree";

interface AddMenuDialogProps {
  parentId: string | null;
  onClose: () => void;
}

export function AddMenuDialog({ parentId, onClose }: AddMenuDialogProps) {
  const tree = useMenuStore((state) => state.tree);
  const addMenu = useMenuStore((state) => state.addMenu);
  const isMutating = useMenuStore((state) => state.isMutating);
  const actionError = useMenuStore((state) => state.actionError);
  const clearActionError = useMenuStore((state) => state.clearActionError);
  const [name, setName] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const parent = getMenuDetails(tree, parentId)?.menu;

  useDialogKeys(onClose);
  useEffect(() => inputRef.current?.focus(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setValidation("Name is required.");
      return;
    }
    if (trimmed.length > 255) {
      setValidation("Name must be 255 characters or fewer.");
      return;
    }
    setValidation(null);
    try {
      await addMenu(trimmed, parentId ?? undefined);
      onClose();
    } catch {
      // The store exposes the backend message in the dialog.
    }
  }

  return (
    <DialogFrame title={parent ? `Add child to ${parent.name}` : "Add menu"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <p className="text-xs leading-5 text-muted">{parent ? `This menu will be placed under ${parent.name}.` : "Create a new top-level menu."}</p>
        <div>
          <label htmlFor="new-menu-name" className="mb-1.5 block text-xs font-medium text-slate-700">Name</label>
          <input ref={inputRef} id="new-menu-name" value={name} onChange={(event) => { setName(event.target.value); setValidation(null); clearActionError(); }} maxLength={255} className="field h-11 w-full px-3 text-sm" placeholder="Enter menu name" aria-invalid={Boolean(validation || actionError)} aria-describedby={validation || actionError ? "menu-name-error" : undefined} />
          {(validation || actionError) && <p id="menu-name-error" role="alert" className="mt-1.5 text-xs text-red-600">{validation ?? actionError}</p>}
          <p className="mt-1 text-right text-[10px] text-muted">{name.trim().length}/255</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand">Cancel</button>
          <button type="submit" disabled={isMutating} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-xs font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{isMutating && <LoaderCircle size={14} className="animate-spin" />} Create menu</button>
        </div>
      </form>
    </DialogFrame>
  );
}

interface ConfirmDeleteDialogProps {
  menuId: string;
  onClose: () => void;
}

export function ConfirmDeleteDialog({ menuId, onClose }: ConfirmDeleteDialogProps) {
  const tree = useMenuStore((state) => state.tree);
  const removeMenu = useMenuStore((state) => state.removeMenu);
  const isMutating = useMenuStore((state) => state.isMutating);
  const actionError = useMenuStore((state) => state.actionError);
  const menu = getMenuDetails(tree, menuId)?.menu;
  useDialogKeys(onClose);

  async function confirm() {
    try {
      await removeMenu(menuId);
      onClose();
    } catch {
      // Keep the confirmation open so the user can retry.
    }
  }

  return (
    <DialogFrame title="Delete menu?" onClose={onClose}>
      <div className="flex gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={19} /></div>
        <div>
          <p className="text-sm font-semibold text-ink">Delete “{menu?.name ?? "this menu"}”?</p>
          <p className="mt-1 text-xs leading-5 text-muted">This action will also delete every child menu below it. This cannot be undone.</p>
        </div>
      </div>
      {actionError && <p role="alert" className="mt-4 text-xs text-red-600">{actionError}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand">Cancel</button>
        <button type="button" onClick={confirm} disabled={isMutating} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">{isMutating && <LoaderCircle size={14} className="animate-spin" />} Delete menu</button>
      </div>
    </DialogFrame>
  );
}

function DialogFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-[440px] rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-base font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand" aria-label="Close dialog"><X size={17} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function useDialogKeys(onClose: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
}
