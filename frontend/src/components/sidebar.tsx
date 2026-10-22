"use client";

import { Boxes, Folder, LayoutGrid, Menu as MenuIcon, Users, X } from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { label: "Systems", icon: Folder },
  { label: "System Code", icon: LayoutGrid },
  { label: "Properties", icon: Boxes },
  { label: "Menus", icon: LayoutGrid },
  { label: "API List", icon: LayoutGrid },
  { label: "Users & Groups", icon: Users },
  { label: "Competition", icon: Folder },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col rounded-r-[20px] bg-brand px-3 py-4 text-white shadow-xl transition-transform lg:static lg:z-auto lg:h-[calc(100vh-32px)] lg:w-[196px] lg:shrink-0 lg:translate-x-0 lg:rounded-[16px] lg:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-12 items-center justify-between px-3">
          <div className="flex items-center gap-2.5">
            <div aria-hidden="true" className="grid grid-cols-3 gap-[2px]">
              {Array.from({ length: 9 }, (_, index) => <span key={index} className="h-[5px] w-[5px] rounded-full bg-white" />)}
            </div>
            <span className="max-w-[96px] text-[9px] font-semibold leading-[1.05] tracking-wide">Teknologi Kinerja Terintegrasi</span>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg text-white/85 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white lg:hidden" onClick={onClose} aria-label="Close navigation"><X size={17} /></button>
          <MenuIcon className="hidden lg:block" size={14} aria-hidden="true" />
        </div>

        <nav aria-label="Main navigation" className="mt-5 space-y-1">
          {navItems.filter((item) => item.label).map(({ label, icon: Icon }) => {
            const active = label === "Menus";
            return (
              <button key={label} aria-current={active ? "page" : undefined} className={`flex min-h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${active ? "bg-white font-semibold text-slate-800 shadow-sm" : "text-white/95 hover:bg-white/10"}`}>
                <Icon size={15} strokeWidth={2.1} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
