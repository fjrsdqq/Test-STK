"use client";

import { AlertCircle, Folder, Grid2X2, LoaderCircle, Menu as MenuIcon, RotateCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TreeView } from "@/components/tree-view";
import { DetailPanel } from "@/components/detail-panel";
import { AddMenuDialog, ConfirmDeleteDialog } from "@/components/menu-dialogs";
import { useMenuStore } from "@/store/menu-store";
import { getMenuDetails, getRootMenuId } from "@/lib/tree";

export function MenuApp() {
  const tree = useMenuStore((state) => state.tree);
  const selectedId = useMenuStore((state) => state.selectedId);
  const isLoading = useMenuStore((state) => state.isLoading);
  const error = useMenuStore((state) => state.error);
  const toast = useMenuStore((state) => state.toast);
  const fetchTree = useMenuStore((state) => state.fetchTree);
  const clearToast = useMenuStore((state) => state.clearToast);
  const selectMenu = useMenuStore((state) => state.selectMenu);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const selectedRootId = getRootMenuId(tree, selectedId);

  useEffect(() => { void fetchTree(); }, [fetchTree]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => clearToast(toast.id), 3600);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  const selected = useMemo(() => getMenuDetails(tree, selectedId), [tree, selectedId]);

  return (
    <div className="min-h-screen bg-page p-0 text-ink lg:p-4">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-0 lg:min-h-[calc(100vh-32px)] lg:gap-6">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 px-4 pb-8 pt-3 sm:px-6 lg:px-0 lg:pt-2">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <button type="button" onClick={() => setSidebarOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 focus-visible:outline-2 focus-visible:outline-brand" aria-label="Open navigation"><MenuIcon size={18} /></button>
            <span className="text-sm font-semibold">Menu administration</span>
          </div>

          <header className="mb-5">
            <div className="mb-5 flex items-center gap-2 text-[11px] text-muted"><Folder size={14} className="fill-slate-300 text-slate-300" /><span className="text-slate-300">/</span><span>Menus</span></div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white"><Grid2X2 size={19} fill="currentColor" strokeWidth={2.8} /></div>
              <div><h1 className="text-xl font-bold tracking-tight text-ink">Menus</h1><p className="mt-0.5 text-[11px] text-muted">Manage your menu hierarchy</p></div>
            </div>
          </header>

          {error ? (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Unable to load menus</p><p className="mt-1 text-xs leading-5">{error}</p></div>
              <button type="button" onClick={() => void fetchTree()} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-500"><RotateCw size={13} /> Retry</button>
            </div>
          ) : null}

          {error && tree.length === 0 ? null : isLoading && tree.length === 0 ? <LoadingSkeleton /> : (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <label htmlFor="root-menu" className="shrink-0 text-[10px] text-muted">Menu</label>
                    <select id="root-menu" value={selectedRootId ?? ""} onChange={(event) => selectMenu(event.target.value || null)} className="field h-10 min-w-0 max-w-[300px] flex-1 appearance-none bg-white px-3 pr-9 text-xs text-slate-700" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237b8498' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}>
                      {tree.map((root) => <option key={root.id} value={root.id}>{root.name}</option>)}
                    </select>
                    {tree.length === 0 && <span className="text-xs text-muted">No root menus</span>}
                  </div>
                  {selected && <span className="hidden text-[10px] text-muted sm:inline">Selected: <span className="font-medium text-slate-700">{selected.menu.name}</span></span>}
                </div>
                <TreeView onAddRoot={() => setAddParentId(null)} onAddChild={(id) => setAddParentId(id)} onDelete={(id) => setDeleteId(id)} />
              </div>
              <DetailPanel />
            </div>
          )}
        </main>
      </div>

      {addParentId !== undefined && <AddMenuDialog parentId={addParentId} onClose={() => setAddParentId(undefined)} />}
      {deleteId && <ConfirmDeleteDialog menuId={deleteId} onClose={() => setDeleteId(null)} />}
      {toast && <div role={toast.tone === "error" ? "alert" : "status"} aria-live="polite" className={`fixed bottom-4 right-4 z-[60] flex max-w-[calc(100vw-32px)] items-center gap-3 rounded-xl px-4 py-3 text-xs font-medium text-white shadow-xl ${toast.tone === "success" ? "bg-slate-900" : "bg-red-700"}`}>
        {toast.tone === "error" ? <AlertCircle size={15} /> : <Grid2X2 size={15} />}{toast.message}<button type="button" onClick={() => clearToast(toast.id)} className="ml-1 grid h-7 w-7 place-items-center rounded-md hover:bg-white/10" aria-label="Dismiss notification"><X size={14} /></button>
      </div>}
    </div>
  );
}

function LoadingSkeleton() {
  return <div aria-label="Loading menus" aria-busy="true" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><section className="space-y-4 rounded-xl border border-slate-100 bg-white p-5"><div className="h-9 w-56 animate-pulse rounded-lg bg-slate-100" /><div className="space-y-3 pt-4">{Array.from({ length: 7 }, (_, index) => <div key={index} style={{ marginLeft: `${(index % 4) * 22}px` }} className="h-8 animate-pulse rounded-md bg-slate-100" />)}</div></section><aside className="space-y-4 rounded-xl border border-slate-100 bg-white p-5"><div className="h-4 w-32 animate-pulse rounded bg-slate-100" />{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}<div className="flex items-center gap-2 text-xs text-muted"><LoaderCircle size={14} className="animate-spin" /> Connecting to backend</div></aside></div>;
}
