import { useEffect, useState } from "react";
import { CreditCard, Download, CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { fetchBillingData, type BillingData, type InvoiceStatus } from "@/lib/database";

function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}

const statusConfig: Record<InvoiceStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  paid: { label: "Paid", color: "#10B981", bg: "rgba(16,185,129,0.12)", icon: CheckCircle },
  pending: { label: "Due Soon", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: Clock },
  overdue: { label: "Overdue", color: "#EF4444", bg: "rgba(239,68,68,0.12)", icon: AlertCircle },
};

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.08)" }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color, transition: "width 0.6s ease" }} />
    </div>
  );
}

export function Billing({ organizationId }: { organizationId?: string }) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchBillingData(organizationId)
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load billing data."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#8891B8", fontSize: 13 }}>Pick a client from the switcher above to view their billing.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={22} color="#8891B8" className="animate-spin" />
        <p style={{ color: "#8891B8", fontSize: 13 }}>Loading billing data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#EF4444", fontSize: 14, fontWeight: 600 }}>Couldn't load billing data</p>
        {error && <p style={{ color: "#8891B8", fontSize: 13, maxWidth: 340 }}>{error}</p>}
      </div>
    );
  }

  const { contract, invoices, totalBilled, totalPaid, totalOutstanding, nextDueLabel, monthlySpend } = data;
  const billedPct = contract && contract.totalValue > 0 ? (totalBilled / contract.totalValue) * 100 : 0;
  const paidPct = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
  const hoursPct = contract && contract.hoursTotal > 0 ? (contract.hoursUsed / contract.hoursTotal) * 100 : 0;
  const hourCategoryColors = ["#7B5CF5", "#4C6EF5", "#06B6D4", "#10B981", "#F59E0B"];
  const maxMonthly = Math.max(...monthlySpend.map(m => m.amount), 1);

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <div>
        <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Billing Center</h1>
        <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>Invoices, payment history, and retainer usage</p>
      </div>

      {!contract && invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <CreditCard size={22} color="#8891B8" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>No contract or invoices set up yet.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Contract Value", value: contract ? `$${contract.totalValue.toLocaleString()}` : "—", sub: "Total engagement value", color: "#7B5CF5" },
              { label: "Total Billed", value: `$${(totalBilled / 1000).toFixed(1)}K`, sub: contract && contract.totalValue > 0 ? `${billedPct.toFixed(0)}% of contract` : "", color: "#4C6EF5" },
              { label: "Outstanding", value: `$${(totalOutstanding / 1000).toFixed(1)}K`, sub: nextDueLabel ? `Due ${nextDueLabel}` : "All settled", color: "#F59E0B" },
              { label: "Hours Remaining", value: contract ? `${(contract.hoursTotal - contract.hoursUsed).toFixed(0)}h` : "—", sub: contract ? `${contract.hoursUsed}h used of ${contract.hoursTotal}h` : "", color: "#10B981" },
            ].map((item) => (
              <GlassCard key={item.label} className="p-5">
                <p style={{ color: item.color, fontSize: 22, fontWeight: 700 }}>{item.value}</p>
                <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 500, marginTop: 2 }}>{item.label}</p>
                <p style={{ color: "#8891B8", fontSize: 11, marginTop: 1 }}>{item.sub}</p>
              </GlassCard>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Budget utilization */}
            <GlassCard className="col-span-2 p-5">
              <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Budget Utilization</p>
              <div className="flex flex-col gap-4">
                {contract && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ color: "#8891B8", fontSize: 12 }}>Billed vs Contract</span>
                      <span style={{ color: "#E2E4F0", fontSize: 12, fontWeight: 600 }}>${totalBilled.toLocaleString()} / ${contract.totalValue.toLocaleString()}</span>
                    </div>
                    <ProgressBar value={billedPct} color="#7B5CF5" />
                  </div>
                )}
                {contract && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ color: "#8891B8", fontSize: 12 }}>Hours Consumed</span>
                      <span style={{ color: "#E2E4F0", fontSize: 12, fontWeight: 600 }}>{contract.hoursUsed}h / {contract.hoursTotal}h</span>
                    </div>
                    <ProgressBar value={hoursPct} color="#10B981" />
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ color: "#8891B8", fontSize: 12 }}>Paid vs Billed</span>
                    <span style={{ color: "#E2E4F0", fontSize: 12, fontWeight: 600 }}>${totalPaid.toLocaleString()} / ${totalBilled.toLocaleString()}</span>
                  </div>
                  <ProgressBar value={paidPct} color="#10B981" />
                </div>
              </div>

              <div className="mt-6" style={{ height: 140 }}>
                <p style={{ color: "#8891B8", fontSize: 12, marginBottom: 8 }}>Monthly Spend</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySpend} barSize={28}>
                    <XAxis dataKey="month" tick={{ fill: "#8891B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={false} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#0D1030", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#E2E4F0", fontSize: 12 }}
                      formatter={(v: number) => [`$${v.toLocaleString()}`, "Amount"]}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {monthlySpend.map((m, i) => (
                        <Cell key={i} fill={m.amount === maxMonthly ? "#F59E0B" : "#7B5CF5"} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Hours breakdown */}
            <GlassCard className="p-5 flex flex-col gap-4">
              <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Retainer Usage</p>
              {contract ? (
                <>
                  <div
                    className="rounded-xl p-4 text-center"
                    style={{ background: "linear-gradient(135deg, rgba(123,92,245,0.15), rgba(76,110,245,0.1))", border: "1px solid rgba(123,92,245,0.2)" }}
                  >
                    <div className="relative w-32 h-32 mx-auto mb-3">
                      <svg width="128" height="128" viewBox="0 0 128 128">
                        <circle cx="64" cy="64" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                        <circle
                          cx="64" cy="64" r="50"
                          fill="none"
                          stroke="url(#hoursGrad)"
                          strokeWidth="10"
                          strokeDasharray={`${(hoursPct / 100) * 314} 314`}
                          strokeLinecap="round"
                          transform="rotate(-90 64 64)"
                        />
                        <defs>
                          <linearGradient id="hoursGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#7B5CF5" />
                            <stop offset="100%" stopColor="#4C6EF5" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>{Math.round(hoursPct)}%</p>
                        <p style={{ color: "#8891B8", fontSize: 10 }}>used</p>
                      </div>
                    </div>
                    <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>{contract.hoursUsed}h Consumed</p>
                    <p style={{ color: "#8891B8", fontSize: 12 }}>{(contract.hoursTotal - contract.hoursUsed).toFixed(0)}h Remaining</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {contract.hourCategories.map((item, i) => (
                      <div key={item.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: hourCategoryColors[i % hourCategoryColors.length] }} />
                          <span style={{ color: "#8891B8", fontSize: 12 }}>{item.category}</span>
                        </div>
                        <span style={{ color: "#E2E4F0", fontSize: 12, fontWeight: 500 }}>{item.hoursUsed}h</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ color: "#8891B8", fontSize: 13 }}>No retainer contract on file.</p>
              )}
            </GlassCard>
          </div>

          {/* Invoices */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Invoice History</p>
              <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: "rgba(123,92,245,0.15)", color: "#C4B5FD", fontSize: 12 }}>
                <Download size={13} />
                Export All
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {invoices.length === 0 && <p style={{ color: "#8891B8", fontSize: 13 }}>No invoices yet.</p>}
              {invoices.map((inv) => {
                const st = statusConfig[inv.status];
                const StatusIcon = st.icon;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center gap-4 rounded-lg p-4"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: st.bg }}>
                      <CreditCard size={16} style={{ color: st.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 600 }}>{inv.invoiceNumber}</p>
                        <span className="rounded-full px-2 py-0.5" style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 600 }}>
                          {st.label}
                        </span>
                      </div>
                      <p style={{ color: "#8891B8", fontSize: 12 }}>{inv.description ?? "—"}</p>
                    </div>
                    <div className="text-right">
                      <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 700 }}>${inv.amount.toLocaleString()}</p>
                      <p style={{ color: "#8891B8", fontSize: 11 }}>Due {inv.dueDateLabel}</p>
                    </div>
                    <div className="flex gap-2">
                      {inv.status !== "paid" && (
                        <button className="rounded-lg px-3 py-1.5" style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)", color: "#fff", fontSize: 12, fontWeight: 600 }}>
                          Pay Now
                        </button>
                      )}
                      <button className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.06)", color: "#8891B8" }}>
                        <Download size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
