"use client";

import { LoaderCircle, Pencil, Save, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { getMenuDetails } from "@/lib/tree";
import { useMenuStore } from "@/store/menu-store";

export function DetailPanel() {
  const tree = useMenuStore((state) => state.tree);
  const selectedId = useMenuStore((state) => state.selectedId);
  const isMutating = useMenuStore((state) => state.isMutating);
  const actionError = useMenuStore((state) => state.actionError);
  const editMenu = useMenuStore((state) => state.editMenu);
  const clearActionError = useMenuStore((state) => state.clearActionError);
  const details = getMenuDetails(tree, selectedId);

  return (
    <aside aria-labelledby="details-heading" className="rounded-xl border border-slate-100 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Menu details</p>
          <h2 id="details-heading" className="mt-1 text-sm font-semibold text-ink">{details ? "Edit selected menu" : "Select a menu"}</h2>
        </div>
        {details && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-brand">Depth {details.depth}</span>}
      </div>
      {!details ? (
        <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-muted">Choose a menu in the tree to view or edit its details.</p>
      ) : (
        <DetailEditor key={`${details.menu.id}:${details.menu.name}`} details={details} isMutating={isMutating} actionError={actionError} onSave={editMenu} onClearError={clearActionError} />
      )}
    </aside>
  );
}

function DetailEditor({ details, isMutating, actionError, onSave, onClearError }: {
  details: NonNullable<ReturnType<typeof getMenuDetails>>;
  isMutating: boolean;
  actionError: string | null;
  onSave: (id: string, name: string) => Promise<void>;
  onClearError: () => void;
}) {
  const [name, setName] = useState(details.menu.name);
  const [editing, setEditing] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  const cancel = useCallback(() => {
    setName(details.menu.name);
    setValidation(null);
    onClearError();
    setEditing(false);
  }, [details.menu.name, onClearError]);

  useEffect(() => {
    if (!editing) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") cancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, cancel]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setValidation("Name is required.");
    if (trimmed.length > 255) return setValidation("Name must be 255 characters or fewer.");
    setValidation(null);
    try {
      await onSave(details.menu.id, trimmed);
      setEditing(false);
    } catch {
      // The store shows the server message below the form.
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Field label="Menu ID"><div className="field flex min-h-10 items-center break-all px-3 py-2 font-mono text-[10px] text-muted">{details.menu.id}</div></Field>
      <Field label="Depth"><div className="field flex h-10 items-center bg-slate-100 px-3 text-xs text-slate-600">{details.depth}</div></Field>
      <Field label="Parent Data"><div className="field flex h-10 items-center truncate px-3 text-xs text-ink">{details.parent?.name ?? "Root menu"}</div></Field>
      <Field label="Name">
        {editing ? <input autoFocus value={name} onChange={(event) => { setName(event.target.value); setValidation(null); onClearError(); }} maxLength={255} className="field h-10 w-full px-3 text-xs text-ink" aria-label="Menu name" aria-invalid={Boolean(validation || actionError)} /> : <div className="field flex h-10 items-center px-3 text-xs text-ink">{details.menu.name}</div>}
      </Field>
      {editing && (validation || actionError) && <p role="alert" className="text-xs text-red-600">{validation ?? actionError}</p>}
      {editing ? <div className="flex gap-2"><button type="button" onClick={cancel} disabled={isMutating} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand"><X size={14} />Cancel</button><button type="submit" disabled={isMutating || name.trim() === details.menu.name} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 text-xs font-semibold text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{isMutating ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}Save</button></div> : <button type="button" onClick={() => { setName(details.menu.name); setEditing(true); }} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><Pencil size={14} />Edit menu</button>}
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-medium text-muted">{label}</span>{children}</label>;
}
