import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  minWidth?: number;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  className = "",
  minWidth = 180,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`} style={{ minWidth }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-[#1a2e2a] border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-[#e2e8f7] outline-none focus:border-emerald-500/50 font-['Plus_Jakarta_Sans'] cursor-pointer"
      >
        <span className="truncate text-left">{selected?.label || placeholder}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#6b7fa8] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-lg border border-emerald-500/25 bg-[#0d1326] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-emerald-500/15">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-[#1a2e2a] border border-emerald-500/20 rounded-md pl-8 pr-2 py-1.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-emerald-500/50 font-['Plus_Jakarta_Sans']"
                onKeyDown={e => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && filtered[0]) pick(filtered[0].value);
                }}
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1 custom-scrollbar">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No matches</li>
            ) : (
              filtered.map(option => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => pick(option.value)}
                    className={`w-full text-left px-3 py-2 text-sm font-['Plus_Jakarta_Sans'] transition-colors ${
                      option.value === value
                        ? "bg-emerald-600/25 text-emerald-200"
                        : "text-[#e2e8f7] hover:bg-emerald-500/10"
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
