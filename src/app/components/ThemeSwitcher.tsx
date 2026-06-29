import { useState, useEffect } from "react";
import { Palette, Check } from "lucide-react";

const ACCENT_THEMES = [
  { id: "indigo", name: "Indigo", color: "#6366f1" },
  { id: "emerald", name: "Emerald", color: "#10b981" },
  { id: "rose", name: "Rose", color: "#f43f5e" },
  { id: "amber", name: "Amber", color: "#f59e0b" },
  { id: "blue", name: "Ocean", color: "#3b82f6" },
  { id: "purple", name: "Purple", color: "#a855f7" }
];

const BG_THEMES = [
  { id: "dark", name: "Midnight (Default)", bg: "#0d1326", text: "#a8b5d1" },
  { id: "navy", name: "Deep Navy", bg: "#020617", text: "#94a3b8" },
  { id: "forest", name: "Dark Forest", bg: "#022c22", text: "#a7f3d0" },
  { id: "graphite", name: "Graphite", bg: "#09090b", text: "#a1a1aa" },
  { id: "oceanic", name: "Oceanic", bg: "#042f2e", text: "#bae6fd" },
  { id: "espresso", name: "Espresso", bg: "#2e1008", text: "#fed7aa" },
  { id: "cosmic", name: "Cosmic Ruby", bg: "#2e0219", text: "#fecdd3" },
  { id: "plum", name: "Royal Plum", bg: "#1e1b4b", text: "#ddd6fe" }
];

export function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [accent, setAccent] = useState("indigo");
  const [bgTheme, setBgTheme] = useState("dark");

  useEffect(() => {
    const savedAccent = localStorage.getItem("app-accent-theme") || "indigo";
    const savedBg = localStorage.getItem("app-bg-theme") || "dark";
    setAccent(savedAccent);
    setBgTheme(savedBg);
    applyTheme(savedAccent, savedBg);
  }, []);

  const applyTheme = (accentId: string, bgId: string) => {
    const html = document.documentElement;
    // Remove old classes
    html.className = html.className.replace(/accent-theme-\w+|bg-theme-\w+/g, "").trim();
    // Add new classes
    html.classList.add(`accent-theme-${accentId}`);
    html.classList.add(`bg-theme-${bgId}`);
    
    localStorage.setItem("app-accent-theme", accentId);
    localStorage.setItem("app-bg-theme", bgId);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl bg-[#131a35] border border-[rgba(99,102,241,0.15)] text-[#a8b5d1] hover:text-white transition-colors flex items-center justify-center theme-bg-surface theme-border theme-text"
        title="Theme Settings"
      >
        <Palette className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl shadow-2xl z-50 p-5 theme-bg-card theme-border">
            
            <h3 className="text-sm font-medium text-white mb-3 theme-text-heading">Background Theme</h3>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {BG_THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setBgTheme(t.id);
                    applyTheme(accent, t.id);
                  }}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-xs text-left transition-all ${bgTheme === t.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-[rgba(99,102,241,0.15)] hover:border-indigo-500/40'}`}
                  style={{ 
                    borderColor: bgTheme === t.id ? 'var(--color-indigo-500)' : undefined,
                    backgroundColor: bgTheme === t.id ? 'color-mix(in srgb, var(--color-indigo-500) 10%, transparent)' : undefined
                  }}
                >
                  <div className="w-4 h-4 rounded-full border border-white/20" style={{ background: t.bg }} />
                  <span className="text-white theme-text-heading truncate">{t.name}</span>
                </button>
              ))}
            </div>

            <h3 className="text-sm font-medium text-white mb-3 theme-text-heading">Accent Color</h3>
            <div className="grid grid-cols-3 gap-3">
              {ACCENT_THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setAccent(t.id);
                    applyTheme(t.id, bgTheme);
                  }}
                  className="relative group flex flex-col items-center gap-1.5"
                >
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg`}
                    style={{ backgroundColor: t.color }}
                  >
                    {accent === t.id && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-[10px] text-[#a8b5d1] theme-text font-medium">{t.name}</span>
                </button>
              ))}
            </div>
            
          </div>
        </>
      )}
    </div>
  );
}
