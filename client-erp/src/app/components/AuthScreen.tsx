import { useState } from "react";
import { Loader2, Lock, Mail } from "lucide-react";
import { signIn } from "@/lib/database";

function GlassCard({ children, className = "", style = {} }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        background: "rgba(13,16,48,0.7)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const fieldWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "10px 14px",
};

const fieldInputStyle: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#E2E4F0",
  fontSize: 13,
};

/** No self-service sign-up — client accounts are provisioned by the agency (see people table). */
export function AuthScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await signIn(email.trim(), password);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="size-full flex items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #07091A 0%, #0B0D24 50%, #070B1C 100%)",
        minHeight: "100vh",
      }}
    >
      <div
        className="fixed pointer-events-none"
        style={{
          top: -200, left: "20%", width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(123,92,245,0.06) 0%, transparent 70%)",
        }}
      />

      <GlassCard className="p-8 relative" style={{ width: 380 }}>
        <div className="flex flex-col items-center gap-2 mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)" }}
          >
            <span style={{ color: "#fff", fontSize: 22 }}>✦</span>
          </div>
          <p style={{ color: "#E2E4F0", fontSize: 18, fontWeight: 700 }}>Client Portal</p>
          <p style={{ color: "#8891B8", fontSize: 12 }}>Sign in to your Base2Brand project dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div style={fieldWrapStyle}>
            <Mail size={15} color="#8891B8" />
            <input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={fieldInputStyle}
            />
          </div>
          <div style={fieldWrapStyle}>
            <Lock size={15} color="#8891B8" />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={fieldInputStyle}
            />
          </div>

          {error && (
            <p style={{ color: "#EF4444", fontSize: 12, lineHeight: 1.5 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-lg mt-2"
            style={{
              background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              padding: "11px 0",
              opacity: submitting ? 0.7 : 1,
              border: "none",
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{ color: "#5C6491", fontSize: 11, textAlign: "center", marginTop: 20 }}>
          Don't have access? Contact your Base2Brand project manager.
        </p>
      </GlassCard>
    </div>
  );
}
