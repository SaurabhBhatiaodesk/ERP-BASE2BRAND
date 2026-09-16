import { useEffect, useMemo, useState } from "react";
import { Search, Download, Eye, Share2, FileText, Image, Code, BarChart2, Book, File, Loader2 } from "lucide-react";
import { fetchDocuments, type DocumentCategory, type DocumentItem } from "@/lib/database";

function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}

const categoryLabels: Record<DocumentCategory, string> = {
  contracts: "Contracts",
  invoices: "Invoices",
  design: "Design Files",
  reports: "Reports",
  meetings: "Meeting Notes",
  brand: "Brand Assets",
};

const categoryStyle: Record<DocumentCategory, { icon: React.ElementType; color: string }> = {
  contracts: { icon: FileText, color: "#7B5CF5" },
  invoices: { icon: File, color: "#8891B8" },
  design: { icon: Image, color: "#4C6EF5" },
  reports: { icon: BarChart2, color: "#10B981" },
  meetings: { icon: FileText, color: "#F59E0B" },
  brand: { icon: Book, color: "#F47B52" },
};

export function Documents({ organizationId }: { organizationId?: string }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<DocumentCategory | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!organizationId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchDocuments(organizationId)
      .then(result => { if (!cancelled) setDocuments(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load documents."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  const categories = useMemo(() => {
    const counts: Partial<Record<DocumentCategory, number>> = {};
    for (const doc of documents) counts[doc.category] = (counts[doc.category] ?? 0) + 1;
    return (Object.keys(categoryLabels) as DocumentCategory[])
      .filter(cat => (counts[cat] ?? 0) > 0)
      .map(cat => ({ id: cat, label: categoryLabels[cat], count: counts[cat] ?? 0 }));
  }, [documents]);

  const filtered = documents.filter(d => {
    const matchCat = category === "all" || d.category === category;
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#8891B8", fontSize: 13 }}>Pick a client from the switcher above to view their documents.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Document Vault</h1>
          <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>Contracts, designs, reports, and project files</p>
        </div>
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", width: 240 }}
        >
          <Search size={14} color="#8891B8" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="bg-transparent outline-none flex-1"
            style={{ color: "#E2E4F0", fontSize: 12 }}
          />
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={22} color="#8891B8" className="animate-spin" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>Loading documents...</p>
        </div>
      )}

      {!loading && error && <p style={{ color: "#EF4444", fontSize: 13 }}>{error}</p>}

      {!loading && !error && (
        <>
          {categories.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCategory("all")}
                className="rounded-lg px-3 py-1.5 flex items-center gap-2 transition-all"
                style={{
                  background: category === "all" ? "rgba(123,92,245,0.2)" : "rgba(255,255,255,0.04)",
                  border: category === "all" ? "1px solid rgba(123,92,245,0.4)" : "1px solid rgba(255,255,255,0.08)",
                  color: category === "all" ? "#C4B5FD" : "#8891B8",
                  fontSize: 12,
                }}
              >
                All Files
                <span className="rounded-full px-1.5" style={{ background: "rgba(255,255,255,0.1)", fontSize: 10, color: "#8891B8" }}>{documents.length}</span>
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className="rounded-lg px-3 py-1.5 flex items-center gap-2 transition-all"
                  style={{
                    background: category === cat.id ? "rgba(123,92,245,0.2)" : "rgba(255,255,255,0.04)",
                    border: category === cat.id ? "1px solid rgba(123,92,245,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: category === cat.id ? "#C4B5FD" : "#8891B8",
                    fontSize: 12,
                  }}
                >
                  {cat.label}
                  <span className="rounded-full px-1.5" style={{ background: "rgba(255,255,255,0.1)", fontSize: 10, color: "#8891B8" }}>{cat.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            {filtered.map((doc) => {
              const { icon: Icon, color } = categoryStyle[doc.category];
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 rounded-xl p-4 transition-all cursor-pointer"
                  style={{ background: "rgba(13,16,48,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(13,16,48,0.9)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(123,92,245,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(13,16,48,0.6)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
                  }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 500 }}>{doc.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {doc.fileType && <span style={{ color: "#8891B8", fontSize: 11 }}>{doc.fileType.toUpperCase()}</span>}
                      <span style={{ color: "#8891B8", fontSize: 11 }}>{doc.fileSizeLabel}</span>
                      <span style={{ color: "#8891B8", fontSize: 11 }}>{doc.dateLabel}</span>
                      {doc.version && <span className="rounded px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.06)", color: "#8891B8", fontSize: 10 }}>{doc.version}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={doc.fileUrl ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#8891B8", opacity: doc.fileUrl ? 1 : 0.4, pointerEvents: doc.fileUrl ? "auto" : "none" }}
                    >
                      <Eye size={13} />
                    </a>
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", color: "#8891B8" }}>
                      <Share2 size={13} />
                    </button>
                    <a
                      href={doc.fileUrl ?? undefined}
                      download
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(123,92,245,0.15)", color: "#C4B5FD", opacity: doc.fileUrl ? 1 : 0.4, pointerEvents: doc.fileUrl ? "auto" : "none" }}
                    >
                      <Download size={13} />
                    </a>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <p style={{ color: "#8891B8", fontSize: 14 }}>No documents found</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
