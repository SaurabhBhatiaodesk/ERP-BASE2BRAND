import React, { useEffect, useState } from "react";
import { ShieldCheck, Save, DollarSign, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  fetchPortalSettings,
  updatePortalSettings,
  CLIENT_PORTAL_MODULES,
  type PortalSettings,
} from "@/lib/database";
import { DataError, DataLoading } from "../ui/DataStatus";

const cardCls = "bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl";
const btnPrimary =
  "flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-900/30 font-['Plus_Jakarta_Sans'] disabled:opacity-50";

export function ClientPortalControlView() {
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [visibleModules, setVisibleModules] = useState<Set<string>>(new Set());
  const [showFinancials, setShowFinancials] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchPortalSettings();
      setSettings(result);
      setVisibleModules(new Set(result.visibleModules));
      setShowFinancials(result.showFinancials);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load client portal settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const toggleModule = (id: string) => {
    setVisibleModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updatePortalSettings({
        visibleModules: Array.from(visibleModules),
        showFinancials,
      });
      setSettings(result);
      toast.success("Client portal settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DataLoading label="Loading client portal settings..." />;
  if (error) return <DataError message={error} />;

  const dirty =
    !!settings &&
    (JSON.stringify(Array.from(visibleModules).sort()) !== JSON.stringify([...settings.visibleModules].sort()) ||
      showFinancials !== settings.showFinancials);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-400" /> Client Portal Control
          </h2>
          <p className="text-sm text-[#6b7fa8] mt-1 font-['Plus_Jakarta_Sans']">
            Controls what every client sees in the client-erp web app — applies to all clients.
          </p>
        </div>
        <button
          onClick={() => void load()}
          title="Reload current settings"
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-[#6b7fa8] hover:text-white rounded-lg hover:bg-white/[0.03] transition-colors"
        >
          <RefreshCw size={13} /> Reload
        </button>
      </div>

      <div className={`${cardCls} p-6`}>
        <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1">Visible Modules</h3>
        <p className="text-xs text-[#6b7fa8] mb-4 font-['Plus_Jakarta_Sans']">
          Unchecked modules disappear from every client's sidebar — and can't be opened directly either.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CLIENT_PORTAL_MODULES.map(m => (
            <label
              key={m.id}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[#131a35] rounded-xl cursor-pointer hover:bg-[#161d3f] transition-colors"
            >
              <input
                type="checkbox"
                checked={visibleModules.has(m.id)}
                onChange={() => toggleModule(m.id)}
                className="accent-indigo-500"
              />
              <span className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={`${cardCls} p-6`}>
        <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1 flex items-center gap-2">
          <DollarSign size={15} className="text-amber-400" /> Financial Figures
        </h3>
        <p className="text-xs text-[#6b7fa8] mb-4 font-['Plus_Jakarta_Sans']">
          When off, budget/revenue amounts are hidden from Analytics, Projects, and Command Center — clients still see project progress and status.
        </p>
        <label className="flex items-center gap-2.5 px-3 py-2.5 bg-[#131a35] rounded-xl cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={showFinancials}
            onChange={() => setShowFinancials(v => !v)}
            className="accent-indigo-500"
          />
          <span className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans']">Show budget/revenue figures to clients</span>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">
          {settings?.updatedAt ? `Last saved ${new Date(settings.updatedAt).toLocaleString()}` : ""}
        </p>
        <button className={btnPrimary} onClick={handleSave} disabled={saving || !dirty}>
          <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
