import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchEmployeeProfileByEmail, upsertEmployeeProfileFromSignup, type EmployeeProfile } from "@/lib/database";

const ROLE_KEY = "b2b_app_role";
const NAME_KEY = "b2b_app_name";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type AuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error_description?: string;
  msg?: string;
  message?: string;
};

export type AppRoleId =
  | "ceo"
  | "teamlead"
  | "employee"
  | "developer"
  | "designer"
  | "marketing"
  | "hr";

export const APP_ROLE_OPTIONS: { id: AppRoleId; label: string }[] = [
  { id: "ceo", label: "CEO / Admin" },
  { id: "teamlead", label: "Team Leader" },
  { id: "employee", label: "Employee" },
  { id: "hr", label: "HR Manager" },
];

const VALID_APP_ROLES = new Set<string>(APP_ROLE_OPTIONS.map(r => r.id));

function isAppRoleId(value: string): value is AppRoleId {
  return VALID_APP_ROLES.has(value);
}

/** Role from employee_profiles — Executive/CEO profile always wins over app_role. */
export function resolveRoleFromProfile(
  profile: EmployeeProfile,
  metadataRole?: string | null,
): AppRoleId {
  if (isExecutiveProfile(profile)) return "ceo";
  if (profile.appRole && isAppRoleId(profile.appRole)) {
    return profile.appRole;
  }
  if (metadataRole && isAppRoleId(metadataRole)) {
    return metadataRole;
  }
  return mapProfileToAppRole(profile);
}

export const ROLE_SIGNUP_DEFAULTS: Record<AppRoleId, { designation: string; department: string }> = {
  ceo: { designation: "Administrator", department: "Executive" },
  teamlead: { designation: "Team Leader", department: "Development" },
  employee: { designation: "Employee", department: "Development" },
  developer: { designation: "Developer", department: "Development" },
  designer: { designation: "Designer", department: "Design" },
  marketing: { designation: "Marketing Executive", department: "Marketing" },
  hr: { designation: "HR Manager", department: "HR" },
};

export function saveAppSession(role: string, name: string) {
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(NAME_KEY, name);
}

export function clearAppSession() {
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(NAME_KEY);
}

export function hasStoredAppSession() {
  return Boolean(localStorage.getItem(ROLE_KEY) && localStorage.getItem(NAME_KEY));
}

/** Maps employee_profiles row → app navigation role. */
export function mapProfileToAppRole(profile: {
  name: string;
  role: string;
  dept: string;
}): AppRoleId {
  if (isExecutiveProfile(profile)) return "ceo";

  const role = profile.role.toLowerCase();
  const dept = profile.dept.toLowerCase();

  if (role.includes("developer") || dept.includes("develop")) return "developer";
  if (role.includes("design") || dept === "design") return "designer";
  if (role.includes("marketing") || dept === "marketing") return "marketing";
  if (role.includes("hr") || dept.includes("hr") || dept.includes("people")) return "hr";
  if (role.includes("team lead") || role.includes("teamlead")) return "teamlead";
  if (role.includes("lead") && !role.includes("developer")) return "teamlead";

  return "employee";
}

export function resolveUserFromAuth(
  user: User,
  loginRoleFallback?: string
): { role: string; name: string } {
  const name =
    (user.user_metadata?.full_name as string) ||
    user.email?.split("@")[0] ||
    localStorage.getItem(NAME_KEY) ||
    "User";

  const role =
    (user.user_metadata?.role as string) ||
    loginRoleFallback ||
    localStorage.getItem(ROLE_KEY) ||
    "employee";

  return { role, name };
}

export function resolveUserFromSession(
  session: Session,
  loginRoleFallback?: string
) {
  return resolveUserFromAuth(session.user, loginRoleFallback);
}

/**
 * Login — role from employee_profiles.app_role when present,
 * otherwise metadata / selected role hint (e.g. Team Leader signup).
 */
export async function loginWithRole(
  email: string,
  password: string,
  options?: { roleHint?: AppRoleId },
) {
  let profile: EmployeeProfile | null = null;
  try {
    profile = await fetchEmployeeProfileByEmail(email);
  } catch {
    profile = null;
  }

  const roleForAuth: AppRoleId = profile
    ? resolveRoleFromProfile(profile, options?.roleHint)
    : options?.roleHint && isAppRoleId(options.roleHint)
      ? options.roleHint
      : "employee";

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, role: roleForAuth }),
  });

  const json = (await response.json()) as AuthTokenResponse;
  if (!response.ok || !json.access_token || !json.refresh_token) {
    const { data: fallbackData, error: fallbackError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (fallbackError || !fallbackData.user) {
      throw new Error(
        json.error_description || json.msg || json.message || fallbackError?.message || "Login failed",
      );
    }
    if (fallbackData.session) {
      await supabase.auth.setSession({
        access_token: fallbackData.session.access_token,
        refresh_token: fallbackData.session.refresh_token,
      });
    }
    const user = fallbackData.user;
    if (!profile) {
      try {
        profile = await fetchEmployeeProfileByEmail(email);
      } catch {
        profile = null;
      }
    }
    const metadataRole = user.user_metadata?.role as string | undefined;
    const resolvedRole = profile
      ? resolveRoleFromProfile(profile, metadataRole || options?.roleHint)
      : metadataRole && isAppRoleId(metadataRole)
        ? metadataRole
        : roleForAuth;
    return finalizeAuthUser(user, resolvedRole, { syncMetadata: true, profile });
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: json.access_token,
    refresh_token: json.refresh_token,
  });
  if (sessionError) throw sessionError;

  const user = sessionData.user;
  if (!user) throw new Error("Login failed");

  if (!profile) {
    try {
      profile = await fetchEmployeeProfileByEmail(email);
    } catch {
      profile = null;
    }
  }

  if (!profile && email) {
    const meta = user.user_metadata || {};
    const hintRole = options?.roleHint;
    const metaRole = meta.role as string | undefined;
    const appRole =
      (hintRole && isAppRoleId(hintRole) ? hintRole : null) ||
      (metaRole && isAppRoleId(metaRole) ? metaRole : null) ||
      "employee";
    try {
      await upsertEmployeeProfileFromSignup({
        name: String(meta.full_name || email.split("@")[0]),
        email,
        phone: String(meta.phone || ""),
        dept: String(meta.department || ROLE_SIGNUP_DEFAULTS[appRole].department),
        role: String(meta.designation || ROLE_SIGNUP_DEFAULTS[appRole].designation),
        appRole,
      });
      profile = await fetchEmployeeProfileByEmail(email);
    } catch {
      profile = null;
    }
  }

  const metadataRole = user.user_metadata?.role as string | undefined;
  const resolvedRole = profile
    ? resolveRoleFromProfile(profile, metadataRole || options?.roleHint)
    : metadataRole && isAppRoleId(metadataRole)
      ? metadataRole
      : roleForAuth;

  return finalizeAuthUser(user, resolvedRole, { syncMetadata: true, profile });
}

/** Dummy OTP for password reset (development — replace with SMS/email OTP later). */
export const DEV_PASSWORD_RESET_OTP = "1234";

/** Validate email exists, then pretend OTP was sent. */
export async function sendPasswordResetOtp(email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) throw new Error("Email is required");

  const profile = await fetchEmployeeProfileByEmail(trimmed);
  if (!profile) throw new Error("No account found with this email.");

  await new Promise(resolve => setTimeout(resolve, 500));
  return true;
}

export function verifyPasswordResetOtp(otp: string): boolean {
  return otp.replace(/\s/g, "") === DEV_PASSWORD_RESET_OTP;
}

/** Reset password after OTP verification (dummy OTP for now). */
export async function resetPasswordAfterOtp(email: string, otp: string, newPassword: string) {
  if (!verifyPasswordResetOtp(otp)) {
    throw new Error("Invalid OTP. For testing use 1234.");
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPassword = newPassword.trim();
  if (trimmedPassword.length < 6) throw new Error("Password must be at least 6 characters");

  const profile = await fetchEmployeeProfileByEmail(trimmedEmail);
  if (!profile) throw new Error("No account found with this email.");

  const { data, error } = await supabase.functions.invoke("reset-password-otp", {
    body: { email: trimmedEmail, otp, password: trimmedPassword },
  });

  if (error) {
    throw new Error(
      "Could not reset password. Deploy the reset-password-otp edge function in Supabase, or try again later."
    );
  }

  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
}

/** Send password reset link to the user's email (Supabase Auth). */
export async function requestPasswordReset(email: string) {
  const trimmed = email.trim();
  if (!trimmed) throw new Error("Email is required");

  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo,
  });
  if (error) throw error;
}

/** Set new password after user opens the reset link from email. */
export async function updatePassword(newPassword: string) {
  const trimmed = newPassword.trim();
  if (trimmed.length < 6) throw new Error("Password must be at least 6 characters");

  const { error } = await supabase.auth.updateUser({ password: trimmed });
  if (error) throw error;
}

function formatAuthError(
  error: { message?: string; code?: string; status?: number } | null,
  fallback = "Signup failed",
) {
  if (!error) return fallback;
  const msg = error.message?.trim();
  if (msg) return msg;
  if (error.code) return `${fallback} (${error.code})`;
  return fallback;
}

/** Signup with role stored in user metadata. */
export async function signUpWithRole(
  email: string,
  password: string,
  role: AppRoleId,
  metadata: Record<string, unknown> = {}
) {
  const trimmedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: { role, app_role: role, ...metadata },
    },
  });

  if (error) {
    throw new Error(formatAuthError(error));
  }

  if (!data.user) {
    throw new Error("Signup failed — no user returned. Check Supabase Auth → signups are enabled.");
  }

  if (data.session?.access_token && data.session.refresh_token) {
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    return { user: data.user, session: data.session };
  }

  // Email confirmation ON in Supabase → signup succeeds but no session yet
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (!loginError && loginData.session) {
    await supabase.auth.setSession({
      access_token: loginData.session.access_token,
      refresh_token: loginData.session.refresh_token,
    });
    return { user: loginData.user ?? data.user, session: loginData.session };
  }

  const loginMsg = loginError?.message?.toLowerCase() ?? "";
  if (loginMsg.includes("confirm") || loginMsg.includes("verified")) {
    throw new Error(
      "Account created but email confirmation is required. In Supabase Dashboard → Authentication → Providers → Email, turn OFF “Confirm email”, then try signup again.",
    );
  }

  return { user: data.user, session: null };
}

async function finalizeAuthUser(
  user: User,
  role: AppRoleId,
  options?: { syncMetadata?: boolean; profile?: EmployeeProfile | null }
) {
  const email = user.email || "";
  let profile = options?.profile ?? null;

  if (!profile && email) {
    try {
      profile = await fetchEmployeeProfileByEmail(email);
    } catch {
      profile = null;
    }
  }

  const resolvedRole = profile
    ? resolveRoleFromProfile(profile, role)
    : role;

  const name =
    profile?.name ||
    (user.user_metadata?.full_name as string) ||
    email.split("@")[0] ||
    "User";

  const shouldSync = options?.syncMetadata !== false;

  if (shouldSync) {
    await supabase.auth.updateUser({
      data: {
        role: resolvedRole,
        full_name: name,
        department: profile?.dept || user.user_metadata?.department,
        designation: profile?.role || user.user_metadata?.designation,
        app_role: resolvedRole,
      },
    });
  }

  return { role: resolvedRole, name, profile, user };
}

/**
 * Session restore — uses metadata role saved at login.
 */
export async function resolveLoginUser(
  user: User,
  options?: { syncMetadata?: boolean }
) {
  const email = user.email || "";
  let profile = null;
  if (email) {
    try {
      profile = await fetchEmployeeProfileByEmail(email);
    } catch {
      profile = null;
    }
  }

  const fallbackRole: AppRoleId =
    (user.user_metadata?.role as AppRoleId) ||
    (localStorage.getItem(ROLE_KEY) as AppRoleId) ||
    "employee";

  const metadataRole = user.user_metadata?.role as string | undefined;
  const resolvedRole = profile
    ? resolveRoleFromProfile(profile, metadataRole || fallbackRole)
    : metadataRole && isAppRoleId(metadataRole)
      ? metadataRole
      : fallbackRole;

  return finalizeAuthUser(user, resolvedRole, { ...options, profile });
}

const ADMIN_ROLES = new Set(["ceo", "teamlead", "hr"]);

/** CEO / Team Lead / HR — company-wide projects list */
export function canSeeAllProjects(role: string) {
  return isAdminRole(role);
}

export function isAdminRole(role: string) {
  return ADMIN_ROLES.has(role);
}

/** Team Shift Tracker — CEO & Team Lead only */
export function isShiftTrackerRole(role: string) {
  return role === "ceo" || role === "teamlead";
}

export function isExecutiveProfile(profile: { name: string; role: string; dept: string }) {
  return (
    profile.dept === "Executive" ||
    profile.name === "CEO Admin" ||
    profile.role.toLowerCase().includes("ceo")
  );
}
