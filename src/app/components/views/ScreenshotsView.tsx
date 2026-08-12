import React, { useState, useEffect, useMemo } from "react";
import { Monitor, Image as ImageIcon, X, Calendar, Search } from "lucide-react";
import { useEmployeeProfiles } from "@/hooks/useSupabaseData";
import {
  fetchEmployeeScreenshots,
  countEmployeeScreenshots,
  localDateYmd,
  EmployeeScreenshot,
} from "@/lib/database";
import { DataEmpty, DataLoading } from "../ui/DataStatus";
import { Avatar } from "../ui";
import { initialsFromName } from "@/lib/database";

export function ScreenshotsView({ employeeId }: { employeeId?: string }) {
  const { data: profiles, loading: pLoading } = useEmployeeProfiles();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(employeeId || null);
  const [screenshots, setScreenshots] = useState<EmployeeScreenshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [date, setDate] = useState<string>(localDateYmd());
  const [dateMode, setDateMode] = useState<"week" | "day">("week");
  const [search, setSearch] = useState("");
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const visibleProfiles = useMemo(() => {
    return profiles.filter(p => p.role !== "CEO" && p.role !== "Admin");
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return visibleProfiles;
    return visibleProfiles.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [visibleProfiles, search]);

  useEffect(() => {
    if (employeeId) {
      setSelectedEmployeeId(employeeId);
    }
  }, [employeeId]);

  useEffect(() => {
    if (!selectedEmployeeId) {
      setScreenshots([]);
      setEmptyHint(null);
      return;
    }
    const profile = profiles.find(p => p.id === selectedEmployeeId);
    if (!profile) return;

    let isMounted = true;
    setLoading(true);
    setEmptyHint(null);
    setFetchError(null);
    const dateArg = dateMode === "day" ? date : undefined;
    const daysBack = dateMode === "week" ? 7 : undefined;
    fetchEmployeeScreenshots(profile.name, profile.id, dateArg, daysBack)
      .then(async (data) => {
        if (!isMounted) return;
        setScreenshots(data);
        if (data.length === 0) {
          const total = await countEmployeeScreenshots(profile.name, profile.id);
          if (!isMounted) return;
          if (total > 0 && dateMode === "day") {
            setEmptyHint(`This employee has ${total} screenshot(s) on other dates. Try "Last 7 days".`);
          } else if (total > 0) {
            setEmptyHint(`${total} screenshot(s) exist in the database but not in this date range.`);
          } else if (total < 0) {
            setEmptyHint("Could not load screenshots from the database. Check the browser console for errors.");
          } else {
            setEmptyHint(
              "No screenshots saved yet. The employee must log in from the desktop app (.exe), stay clocked in, and have Cloudinary configured in .env."
            );
          }
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setScreenshots([]);
        setFetchError(err instanceof Error ? err.message : "Failed to load screenshots");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [selectedEmployeeId, date, dateMode, profiles]);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[600px] gap-6">
      {/* Sidebar for Employee Selection */}
      {!employeeId && (
        <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4">
        <div className="bg-[#111828] border border-[rgba(99,102,241,0.12)] rounded-xl p-4 flex flex-col gap-4 h-full">
          <h3 className="text-white font-semibold font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <UsersIcon size={18} className="text-indigo-400" />
            Employees
          </h3>
          
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {pLoading ? (
              <p className="text-sm text-[#6b7fa8] text-center mt-4">Loading...</p>
            ) : filteredProfiles.length === 0 ? (
              <p className="text-sm text-[#6b7fa8] text-center mt-4">No employees found.</p>
            ) : (
              filteredProfiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedEmployeeId(p.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${selectedEmployeeId === p.id ? "bg-indigo-500/20 border-indigo-500/30 border" : "hover:bg-white/5 border border-transparent"}`}
                >
                  <Avatar src={p.profileImageUrl} initials={initialsFromName(p.name)} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate font-['Plus_Jakarta_Sans'] ${selectedEmployeeId === p.id ? "text-indigo-300" : "text-white"}`}>{p.name}</p>
                    <p className="text-xs text-[#6b7fa8] truncate">{p.dept}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 bg-[#111828] border border-[rgba(99,102,241,0.12)] rounded-xl flex flex-col overflow-hidden relative">
        <div className="p-4 border-b border-[rgba(99,102,241,0.1)] flex flex-wrap items-center justify-between gap-4 bg-[#0d1326]/50">
          <div className="flex items-center gap-3">
            <Monitor size={20} className="text-indigo-400" />
            <div>
              <h2 className="text-white font-semibold font-['Plus_Jakarta_Sans']">Screenshot History</h2>
              <p className="text-xs text-[#6b7fa8] font-['Geist_Mono']">
                {selectedEmployeeId 
                  ? `${profiles.find(p => p.id === selectedEmployeeId)?.name}'s screen captures`
                  : "Select an employee to view"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg overflow-hidden border border-[rgba(99,102,241,0.15)]">
              <button
                type="button"
                onClick={() => setDateMode("week")}
                className={`px-3 py-1.5 text-xs font-['Geist_Mono'] ${dateMode === "week" ? "bg-indigo-500/20 text-indigo-300" : "bg-[#0d1326] text-[#6b7fa8] hover:text-white"}`}
              >
                Last 7 days
              </button>
              <button
                type="button"
                onClick={() => setDateMode("day")}
                className={`px-3 py-1.5 text-xs font-['Geist_Mono'] ${dateMode === "day" ? "bg-indigo-500/20 text-indigo-300" : "bg-[#0d1326] text-[#6b7fa8] hover:text-white"}`}
              >
                One day
              </button>
            </div>
            {dateMode === "day" && (
              <>
                <Calendar size={16} className="text-[#6b7fa8]" />
                <input 
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                />
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!selectedEmployeeId ? (
            <div className="h-full flex items-center justify-center">
              <DataEmpty message="Select an employee from the sidebar to view their screenshots." />
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <DataLoading label="Loading screenshots..." />
            </div>
          ) : screenshots.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
              <DataEmpty message={
                dateMode === "day"
                  ? `No screenshots recorded for ${date}.`
                  : "No screenshots in the last 7 days."
              } />
              {fetchError && (
                <p className="text-sm text-red-400 max-w-md">{fetchError}</p>
              )}
              {emptyHint && (
                <p className="text-sm text-[#6b7fa8] max-w-md">{emptyHint}</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {screenshots.map(s => {
                const time = new Date(s.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={s.id} className="bg-[#0d1326] rounded-xl overflow-hidden border border-[rgba(99,102,241,0.15)] group hover:border-indigo-500/40 transition-colors">
                    <div 
                      className="aspect-video bg-black/50 relative cursor-pointer"
                      onClick={() => setSelectedImage(s.image_url)}
                    >
                      <img 
                        src={s.image_url} 
                        alt={`Screenshot at ${time}`} 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <ImageIcon size={32} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </div>
                    <div className="p-3 bg-[#111828] border-t border-[rgba(99,102,241,0.1)] flex justify-between items-center">
                      <span className="text-sm text-white font-['Geist_Mono']">{time}</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-['Geist_Mono']">Recorded</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox / Image Viewer */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={selectedImage} 
            alt="Full size screenshot" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
            onClick={e => e.stopPropagation()} // prevent closing when clicking the image itself
          />
        </div>
      )}
    </div>
  );
}

// Just a quick icon since lucide doesn't export UsersIcon directly (it's Users)
function UsersIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
