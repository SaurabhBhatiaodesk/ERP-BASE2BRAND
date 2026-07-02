import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { playCeoCallBeep } from "@/lib/audio";
import type { EmployeeProfile } from "@/lib/database";

type CallEmployeePickerProps = {
  employees: EmployeeProfile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  labelClassName?: string;
  listClassName?: string;
};

export function CallEmployeePicker({
  employees,
  selectedIds,
  onChange,
  labelClassName = "block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']",
  listClassName = "max-h-52 overflow-y-auto rounded-xl border border-[rgba(99,102,241,0.15)] bg-[#131a35] divide-y divide-[rgba(99,102,241,0.08)]",
}: CallEmployeePickerProps) {
  const [search, setSearch] = useState("");

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.dept.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    );
  };

  const selectAll = () =>
    onChange([...new Set([...selectedIds, ...filteredEmployees.map(p => p.id)])]);
  const clearAll = () => onChange([]);

  const selectedProfiles = employees.filter(p => selectedIds.includes(p.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className={labelClassName}>Who to call?</label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-indigo-400 font-['Geist_Mono']">
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            onClick={selectAll}
            className="text-[10px] text-[#6b7fa8] hover:text-white transition-colors"
          >
            All
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-[10px] text-[#6b7fa8] hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8] pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or department..."
          className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-[#6b7fa8] focus:outline-none focus:border-indigo-500/40 font-['Plus_Jakarta_Sans']"
        />
      </div>

      <div className={listClassName}>
        {filteredEmployees.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
            No employees match &quot;{search.trim()}&quot;
          </p>
        ) : (
          filteredEmployees.map(p => {
          const checked = selectedIds.includes(p.id);
          return (
            <label
              key={p.id}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                checked ? "bg-indigo-600/15" : "hover:bg-white/[0.03]"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(p.id)}
                className="rounded border-[rgba(99,102,241,0.35)] bg-[#0d1326] text-indigo-500 focus:ring-indigo-500/40"
              />
              <span className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] flex-1 min-w-0 truncate">
                {p.name}
              </span>
              <span className="text-[10px] text-[#6b7fa8] shrink-0">{p.dept}</span>
            </label>
          );
        })
        )}
      </div>

      {selectedProfiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProfiles.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[10px] text-emerald-300"
            >
              {p.name.split(/\s+/)[0]}
              <span className="text-emerald-400/70">×</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => playCeoCallBeep()}
        className="text-[11px] text-[#6b7fa8] hover:text-emerald-400 transition-colors font-['Geist_Mono']"
      >
        Preview call ring sound
      </button>
    </div>
  );
}

export async function sendCallToEmployees(input: {
  profiles: EmployeeProfile[];
  selectedIds: string[];
  message: string;
  callTitle: string;
  insertNotification: (input: {
    recipientId: string;
    title: string;
    message: string;
    type: string;
  }) => Promise<void>;
  saveQuickAction: (record: {
    type: "call";
    employees: string[];
    message: string;
    phones?: string[];
  }) => Promise<unknown>;
}) {
  const targets = input.profiles.filter(p => input.selectedIds.includes(p.id));
  if (!targets.length) throw new Error("Please select at least one employee.");

  const callMessage = input.message.trim() || "Please come to my cabin";

  await input.saveQuickAction({
    type: "call",
    employees: targets.map(p => p.name),
    message: callMessage,
    phones: targets.map(p => p.phone).filter(Boolean) as string[],
  });

  await Promise.all(
    targets.map(p =>
      input.insertNotification({
        recipientId: p.id,
        title: input.callTitle,
        message: callMessage,
        type: "call",
      })
    )
  );

  return targets.length;
}
