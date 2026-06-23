import React, { useState } from "react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import logo from "@/imports/image.png";
import { supabase } from "@/lib/supabase";
import { upsertEmployeeProfileFromSignup } from "@/lib/database";
import {
  loginWithRole,
  resolveLoginUser,
  saveAppSession,
  signUpWithRole,
  ROLE_SIGNUP_DEFAULTS,
  type AppRoleId,
} from "@/lib/auth";
import {
  Building2, Users, UserCheck, GitBranch, Star, TrendingUp, Award,
  ChevronLeft, Eye, EyeOff,
} from "lucide-react";

const passwordInputCls =
  "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl pl-4 pr-11 py-3 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";

function PasswordField({
  value,
  onChange,
  placeholder = "••••••••",
  onEnter,
  inputClassName = passwordInputCls,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onEnter?: () => void;
  inputClassName?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        type={visible ? "text" : "password"}
        className={inputClassName}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6b7fa8] hover:text-indigo-300 transition-colors"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

const authRoles = [
  { id: "ceo", label: "CEO / Admin", desc: "Full platform access", icon: Building2, color: "from-indigo-600 to-violet-600" },
  { id: "teamlead", label: "Team Leader", desc: "Team management & approvals", icon: Users, color: "from-indigo-500 to-blue-600" },
  { id: "employee", label: "Employee", desc: "Personal tasks & time tracking", icon: UserCheck, color: "from-violet-600 to-purple-700" },
  { id: "developer", label: "Developer", desc: "Sprint, bugs & code metrics", icon: GitBranch, color: "from-blue-600 to-cyan-600" },
  { id: "designer", label: "Designer", desc: "Projects, revisions & approvals", icon: Star, color: "from-pink-600 to-rose-600" },
  { id: "marketing", label: "Marketing", desc: "Campaigns, leads & ROI", icon: TrendingUp, color: "from-amber-500 to-orange-600" },
  { id: "hr", label: "HR Manager", desc: "People, payroll & hiring", icon: Award, color: "from-emerald-500 to-teal-600" },
];

export function AuthScreen({ onLogin }: { onLogin: (role: string, name: string) => void }) {
  const [step, setStep] = useState<"role" | "login" | "register">("role");
  const [selectedRole, setSelectedRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    employeeId: "",
  });

  const roleMeta = authRoles.find(r => r.id === selectedRole);

  async function ensureEmployeeProfile(input: {
    fullName: string;
    regEmail: string;
    phone: string;
    department: string;
    designation: string;
    employeeId: string;
    appRole: AppRoleId;
  }) {
    const defaults = ROLE_SIGNUP_DEFAULTS[input.appRole];
    const profileId = await upsertEmployeeProfileFromSignup({
      name: input.fullName,
      email: input.regEmail,
      phone: input.phone,
      dept: input.department.trim() || defaults.department,
      role: input.designation.trim() || defaults.designation,
      appRole: input.appRole,
    });
    return profileId;
  }

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError("");

    try {
      const roleHint = selectedRole && selectedRole !== "" ? (selectedRole as AppRoleId) : undefined;
      const { role, name } = await loginWithRole(email, password, { roleHint });
      saveAppSession(role, name);
      onLogin(role, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    const { fullName, email: regEmail, phone, department, designation, employeeId } = registerForm;
    if (!fullName || !regEmail || !password) {
      setError("Full name, email, and password are required.");
      return;
    }

    setLoading(true);
    setError("");

    const appRole = (selectedRole || "employee") as AppRoleId;

    try {
      await ensureEmployeeProfile({
        fullName,
        regEmail,
        phone,
        department,
        designation,
        employeeId,
        appRole,
      });

      let alreadyRegistered = false;
      try {
        await signUpWithRole(regEmail, password, appRole, {
          full_name: fullName,
          phone,
          department: department || ROLE_SIGNUP_DEFAULTS[appRole].department,
          designation: designation || ROLE_SIGNUP_DEFAULTS[appRole].designation,
          employee_id: employeeId,
        });
      } catch (signupErr) {
        const msg = signupErr instanceof Error ? signupErr.message.toLowerCase() : "";
        if (!msg.includes("already") && !msg.includes("registered") && !msg.includes("exists")) {
          throw signupErr;
        }
        alreadyRegistered = true;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { role, name } = await resolveLoginUser(session.user);
        saveAppSession(role, name);
        onLogin(role, name);
      } else {
        try {
          const { role, name } = await loginWithRole(regEmail, password, { roleHint: appRole });
          saveAppSession(role, name);
          onLogin(role, name);
        } catch (loginErr) {
          const msg = loginErr instanceof Error ? loginErr.message : "Login failed";
          if (alreadyRegistered && msg.toLowerCase().includes("invalid login credentials")) {
            throw new Error("This email is already registered. Please sign in instead, or check your password.");
          }
          throw loginErr;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#06091a] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-4xl relative">
        {/* Logo */}
        <div className="text-center mb-10">
          <ImageWithFallback src={logo} alt="Base2Brand" className="h-9 w-auto object-contain mx-auto mb-3" />
          <p className="text-[11px] font-['Geist_Mono'] text-[#6b7fa8] tracking-widest uppercase">Command Center · v2.4</p>
        </div>

        {step === "role" && (
          <div>
            <h1 className="text-2xl font-bold text-white text-center mb-2 font-['Plus_Jakarta_Sans']">Select Your Role</h1>
            <p className="text-sm text-[#6b7fa8] text-center mb-8 font-['Plus_Jakarta_Sans']">Choose your access level to continue</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {authRoles.map(r => (
                <button key={r.id} onClick={() => { setSelectedRole(r.id); setStep("login"); }}
                  className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] hover:border-indigo-500/40 rounded-2xl p-5 text-left transition-all hover:bg-[#111828] group">
                  <div className={`w-10 h-10 bg-gradient-to-br ${r.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                    <r.icon size={18} className="text-white" />
                  </div>
                  <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1">{r.label}</p>
                  <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] leading-relaxed">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "login" && roleMeta && (
          <div className="max-w-md mx-auto">
            <button onClick={() => setStep("role")} className="flex items-center gap-1.5 text-[#6b7fa8] hover:text-white text-xs mb-6 transition-colors font-['Plus_Jakarta_Sans']">
              <ChevronLeft size={14} /> Back to roles
            </button>
            <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-2xl p-8">
              <div className={`w-12 h-12 bg-gradient-to-br ${roleMeta.color} rounded-xl flex items-center justify-center mb-4`}>
                <roleMeta.icon size={22} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1 font-['Plus_Jakarta_Sans']">Sign In</h2>
              <p className="text-xs text-[#6b7fa8] mb-6 font-['Plus_Jakarta_Sans']">Signing in as <span className="text-indigo-400">{roleMeta.label}</span></p>
              {error && (
                <p className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 font-['Plus_Jakarta_Sans']">
                  {error}
                </p>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Work Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@base2brand.com" type="email"
                    className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-3 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']" />
                </div>
                <div>
                  <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Password</label>
                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    onEnter={handleLogin}
                  />
                </div>
                <button onClick={handleLogin} disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all font-['Plus_Jakarta_Sans'] shadow-lg shadow-indigo-600/20">
                  {loading ? "Signing in..." : "Continue →"}
                </button>
                <p className="text-center text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-3">
                  New employee?{" "}
                  <button onClick={() => setStep("register")} className="text-indigo-400 hover:text-indigo-300 transition-colors">Request account access</button>
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "register" && (
          <div className="max-w-lg mx-auto">
            <button onClick={() => setStep(selectedRole ? "login" : "role")} className="flex items-center gap-1.5 text-[#6b7fa8] hover:text-white text-xs mb-6 transition-colors font-['Plus_Jakarta_Sans']">
              <ChevronLeft size={14} /> {selectedRole ? "Back to login" : "Back to roles"}
            </button>
            <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-2xl p-8">
              <div className={`w-12 h-12 bg-gradient-to-br ${roleMeta?.color || "from-emerald-600 to-teal-600"} rounded-xl flex items-center justify-center mb-4`}>
                {roleMeta ? <roleMeta.icon size={20} className="text-white" /> : <UserCheck size={20} className="text-white" />}
              </div>
              <h2 className="text-xl font-bold text-white mb-1 font-['Plus_Jakarta_Sans']">Request Access</h2>
              <p className="text-xs text-[#6b7fa8] mb-2 font-['Plus_Jakarta_Sans']">
                {roleMeta ? (
                  <>Creating account as <span className="text-indigo-400 font-semibold">{roleMeta.label}</span></>
                ) : (
                  "Submit your details to get started"
                )}
              </p>
              <p className="text-xs text-[#6b7fa8] mb-6 font-['Plus_Jakarta_Sans']">
                Account activates immediately after signup — no admin wait required.
              </p>
              {error && (
                <p className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 font-['Plus_Jakarta_Sans']">
                  {error}
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "fullName" as const, label: "Full Name", placeholder: "Your full name", type: "text" },
                  { key: "email" as const, label: "Work Email", placeholder: "you@base2brand.com", type: "email" },
                  { key: "phone" as const, label: "Phone Number", placeholder: "+91 98765 43210", type: "tel" },
                  { key: "department" as const, label: "Department", placeholder: "e.g. Design", type: "text" },
                  { key: "designation" as const, label: "Role / Designation", placeholder: roleMeta?.id === "teamlead" ? "Team Leader" : "e.g. UI Designer", type: "text" },
                  { key: "employeeId" as const, label: "Employee ID (if any)", placeholder: "e.g. E012", type: "text" },
                ].map(f => (
                  <div key={f.label} className={f.label === "Full Name" || f.label === "Role / Designation" ? "col-span-2" : ""}>
                    <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={registerForm[f.key]}
                      onChange={e => setRegisterForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']"
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Password</label>
                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    placeholder="Create a password"
                    inputClassName={`${passwordInputCls} py-2.5`}
                  />
                </div>
              </div>
              <button onClick={handleRegister} disabled={loading}
                className={`w-full mt-6 py-3 bg-gradient-to-r ${roleMeta?.color || "from-emerald-600 to-teal-600"} hover:opacity-90 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all font-['Plus_Jakarta_Sans'] shadow-lg shadow-indigo-600/20`}>
                {loading ? "Creating account..." : roleMeta ? `Create ${roleMeta.label} Account →` : "Submit Access Request →"}
              </button>
              <p className="text-center text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-3">
                {roleMeta?.id === "teamlead"
                  ? "Team Leader access includes Shift Tracker and team approvals."
                  : "You can sign in right after account creation."}
              </p>
            </div>
          </div>
        )}

        {/* OTP step disabled — direct signup/login after register */}
      </div>
    </div>
  );
}

export const roleColorMap: Record<string, string> = {
  ceo: "from-indigo-600 to-violet-600",
  teamlead: "from-indigo-500 to-blue-600",
  employee: "from-violet-600 to-purple-700",
  developer: "from-blue-600 to-cyan-600",
  designer: "from-pink-600 to-rose-600",
  marketing: "from-amber-500 to-orange-600",
  hr: "from-emerald-500 to-teal-600",
};

export const roleLabelMap: Record<string, string> = {
  ceo: "CEO / Admin",
  teamlead: "Team Leader",
  employee: "Employee",
  developer: "Developer",
  designer: "Designer",
  marketing: "Marketing",
  hr: "HR Manager",
};
