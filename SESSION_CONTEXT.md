# Base2Brand ERP — Session Context Handoff

This file captures everything built/changed across a long Claude Code session on this
project, so a fresh session (or a different machine) can pick up with full context.
Written on 2026-09-26.

## 1. Project shape

- **Main ERP** — `D:\nitin-dev\ERP-BASE2BRAND` (this repo root). Vite + React + TypeScript,
  wrapped in Electron for desktop. Supabase project: **`jgbkpbafgwxlkudwqvdb`** ("Erp").
  No custom backend server — all logic is either in the React app or in Supabase Edge
  Functions on this same project.
- **client-erp** — `D:\nitin-dev\ERP-BASE2BRAND\client-erp` (sibling app inside this same
  repo, own `package.json`/`vite.config.ts`/`supabase/`). A separate client-facing web
  portal. Supabase project: **`ptnsbdtqkooidvcdqzee`** ("CLIENT-ERP"). Deployed on Netlify
  at **https://clienterpb2b.netlify.app** (confirm before assuming it's up to date with
  local changes — deploys are not automatic from this session).
- Both apps' dev servers default to Vite port 5173, which caused Electron (main ERP,
  always loads `http://localhost:5173` in dev) to silently show client-erp's login screen
  when client-erp's server took over that port. Fixed: **client-erp now runs on port 5174**
  (`client-erp/vite.config.ts`, `server: { port: 5174, strictPort: true }`). Always run the
  main ERP's own `npm run dev` from the repo root for the Electron app to show the right
  thing.
- **Security model, explicitly established this session**: the main ERP is an internal
  staff tool with **wide-open RLS on almost every table** (`using (true)` for both `anon`
  and `authenticated`) — authorization is enforced in the React app's own code, not the
  database. client-erp was deliberately built with **real per-tenant RLS** from the start
  (`current_org_id()`, `project_in_scope()`, etc., all `SECURITY DEFINER` to avoid a
  circular-RLS bootstrap crash — see `client-erp/supabase/migrations/20260909000000_fix_rls_helpers.sql`).
  Where the main ERP later gained new client-facing surfaces (client login, tickets),
  those specific new tables got real RLS treatment (see §3), but the rest of the main ERP
  schema remains wide open — a client's own JWT could still directly query most other
  tables if it ever got main-ERP-side access to unrelated data. This was disclosed to and
  knowingly accepted by the user for the main-ERP client-login feature specifically.

## 2. Recurring operational gotchas

- **Supabase CLI account drift**: this session repeatedly found the CLI silently logged
  into an unrelated Supabase account (unrelated project refs show up in
  `supabase projects list`). Fix each time: `supabase login` again. At one point this hit
  the **20-personal-access-token cap** (each login mints a new token) — had to delete old
  tokens at https://supabase.com/dashboard/account/tokens before a fresh login would work.
- Whichever directory you run `supabase db query --linked -f ...` from must actually be
  **linked** to the project you mean to hit. Main ERP root is linked to `jgbkpbafgwxlkudwqvdb`;
  run `cd client-erp && supabase link --project-ref ptnsbdtqkooidvcdqzee` before touching
  client-erp's DB, and `supabase functions deploy <name> --project-ref <ref>` must also be
  run **from inside that project's own directory** (relative paths inside the CLI are
  resolved from CWD) — deploying a client-erp function from the repo root fails with a
  "path does not exist" error.
- Docker isn't running in this environment; `supabase functions deploy` still works
  without it (just prints a harmless warning).
- Never guess Cloudinary/OpenAI/Gmail credentials or a deployed URL — always ask the user
  or read them from `.env`/existing secrets.

## 3. Main ERP — features built this session

All verified via `npm run typecheck` (7 pre-existing, unrelated errors — MeetingView.tsx
×2, RecruitmentView.tsx, SettingsViews.tsx, database.ts ×3 — confirmed unchanged after
every change) and `npm run build`.

### Sandwich-leave / public holidays, invoice preview, Feed module, idle/screenshot toggles
Completed earlier in the session — a Feed module (`src/app/components/views/FeedView.tsx`,
`supabase/feed.sql`), a live invoice preview panel, an idle-tracking pause toggle (click the
"Idle: Ns" badge — `src/hooks/useElectronIdleTracker.ts`), and a screenshot-pause toggle
(click the sidebar logo — small red dot indicator, `App.tsx`). `isScreenshotMonitoredRole`
in `src/lib/database.ts` now also excludes the `"client"` role (see below).

### Client login in the main ERP (`src/app/components/views/ClientProjectView.tsx`)
The user was explicitly warned this main-ERP tool has wide-open RLS everywhere, and chose
"add client login to the main ERP anyway" over building this in client-erp. Built with
real, targeted RLS rather than trusting the UI alone:
- New tables `client_users`, `project_client_members` (`supabase/client_login.sql`).
- `SECURITY DEFINER` helpers: `is_client_user()`, `current_client_user_id()`,
  `client_has_project(project_id)`.
- Existing `projects`/`project_tasks`/`employee_profiles` policies were tightened to
  `using (not is_client_user())` (preserves 100% of existing employee behavior) plus new
  client-scoped SELECT policies. **Employee_profiles was deliberately locked down too** —
  a client's own JWT must never be able to pull the full staff/salary list directly.
- RPCs `list_project_team_for_client` / `create_client_task` — the only way a client
  session reads team members or creates a task (returns only id/name/avatar, never raw
  `employee_profiles` rows).
- `update_client_task_status(task_id, status)` RPC — client drag-and-drop, restricted to
  `todo|in-progress|done` (a simpler 3-column board than the internal Kanban's 5).
- Auth: `src/lib/auth.ts`'s `loginWithRole`/`resolveLoginUser` now check `client_users`
  by email (only possible *after* a session exists, since RLS requires
  `auth_user_id = auth.uid()`) before falling into employee-profile auto-provisioning.
- App.tsx: `"client"` RoleId gets its own minimal shell (bypasses the whole employee
  sidebar/nav system), rendering just `ClientProjectView`.
- **Test account** (kept live, not cleaned up): `clienttest@base2brand.com` /
  `ClientTest12345`, linked to project **P685 (Bubble Car Wash Website)**.

### Projects & Work task improvements (`src/app/components/views/CRMTasksViews.tsx`, `RoleDashboards.tsx`)
- Anyone (not just admins/TL) can now assign a task to someone else — the assignee field
  is a searchable dropdown (`SearchableSelect`, same component used for Project).
  Defaults to self.
- New `project_tasks.created_by` column (`supabase/add_task_created_by.sql`) — shows
  "Assigned by X" on the Kanban card, list row, edit modal, **and** the Employee
  Dashboard's "Today's Tasks" widget (that last one was a gap fixed after the user
  reported it missing there specifically).
- **Important scoping fix**: `TasksView`'s internal task fetch used to pass
  `assigneeId` into `useProjectTasks()`, which filters *at the SQL level* — so a task you
  created but assigned to someone else was never even fetched into your own board. Fixed
  by fetching the full task list (same as admins already do) and filtering client-side via
  a broadened `scopedTasks` (assignee OR creator) — **deliberately not** touching the
  shared `filterTasksForUser()` used by Today's Tasks/timesheets/KPI, which must stay
  assignee-only (delegating a task shouldn't count as "my work" there).
- Task-assignment notifications (`insertNotification`, type `"task_assigned"`) — fires on
  create (assignee ≠ creator) and on reassignment (new assignee ≠ mover), never on
  self-assignment. Click-through wired in `App.tsx`'s `handleNotificationClick`.
- Delete permission broadened: the task's creator can delete it too (previously only the
  assignee, and only for "personal" roles).
- **Timezone bug fixed**: editing an existing task showed the due date one day earlier
  than actual (e.g. today=21 showed 20) for any timezone ahead of UTC (like IST). Root
  cause: `parseDueToIso()` re-parsed the *display* string ("Sep 21") through
  `new Date(...).toISOString()`, which converts through UTC and rolls back a day. Fixed by
  preferring the task's raw stored `dueIso` directly, and making the fallback parser use
  `formatLocalDateIso` (local Y/M/D getters) instead of `.toISOString()`.

### Raise Ticket module (`src/app/components/views/TicketsView.tsx`, `supabase/tickets.sql`)
- New `tickets` + `ticket_assignees` tables (multi-assignee tagging, like Feed). RLS open
  to employees (matches the app's existing convention) but explicitly excludes
  `is_client_user()` from day one.
- **Tagging rule**: CEO/Superadmin can tag anyone; everyone else can tag anyone *except*
  CEO/Superadmin (`canTagAnyoneInTicket` in `auth.ts`), enforced in the picker itself, not
  at the DB layer (consistent with this app's existing employee-permission model).
- Kanban board (Open/In Progress/Resolved/Closed), `react-dnd` drag-and-drop — same
  library already used by `MeetingView.tsx`/`CRMTasksViews.tsx`.
- `tickets.project_id` is nullable — a ticket can be "General" (no project). The old
  project-scope filter dropdown was removed per request; the board just shows every
  ticket visible to you (your own projects' tickets + every General ticket).
- Edit/delete: the ticket's creator, or CEO/Superadmin for any ticket.
- Search bar (title/description) and a separate searchable "tag people" box inside the
  Raise/Edit modal (chips for selected people + live filter).
- Notifications: tagging (new tags only, not re-saves) and status-change drags both notify
  via `insertNotification` (types `"ticket_tagged"` / `"ticket_status"`), excluding
  whoever performed the action.
- Responsive grid layout for the board (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`).
- Nav item added to every internal role (not the client role).

### Client Portal Control (`src/app/components/views/ClientPortalControlView.tsx`)
CEO/Superadmin-only new module to control what the *separate client-erp app* shows —
"kitna data dikhana hai client ko or kya dikhana hai". **Global** setting (applies to
every client the same way, per the user's choice — not per-client).
- New client-erp table `portal_settings` (singleton row, `id='global'`) — `visible_modules`
  (jsonb array of module ids) + `show_financials` (boolean).
- New main-ERP Edge Function `manage-portal-settings` — re-verifies the caller is really
  CEO/Superadmin against `employee_profiles` (the default "valid JWT" check alone would
  pass for the anon key too, which is NOT sufficient for a sensitive write endpoint), then
  reads/writes client-erp's `portal_settings` via `CLIENT_ERP_SUPABASE_URL`/
  `CLIENT_ERP_SERVICE_ROLE_KEY` secrets (same secrets the older `sync-project-to-client-portal`
  function already used).
- client-erp's `App.tsx`/`Sidebar.tsx` fetch this on load and both hide disabled modules
  in the sidebar **and** block direct/typed URL navigation to a hidden page (falls back to
  Command Center) — real enforcement, not just cosmetic. Never applies to admin
  (`kind==='admin'`) accounts.
- `show_financials=false` hides budget/revenue figures in `CommandCenter.tsx`,
  `Analytics.tsx`, `Projects.tsx` (each got a `showFinancials?: boolean` prop).

### Enable Client Portal Access (`src/app/components/views/ProfileViews.tsx` — `ClientDetailPage`)
CEO/Superadmin-only "Enable Client Portal" button on a client's profile (Client Profiles
module). Creates/resets that client's actual client-erp login and shows the credentials
in-app (with copy buttons) regardless of whether email sending works.
- New main-ERP Edge Function `enable-client-portal-access` — same admin-check pattern as
  above. Upserts the client-erp `organizations`/`people` rows (same `source_lead_id` key as
  the project sync function, so a client enabled here and one synced via a project always
  land on the same org), generates a random password, creates-or-resets their client-erp
  Auth account, links `people.auth_user_id`.
- Emailing is **prepared but not live**: reads `GMAIL_SMTP_USER`/`GMAIL_SMTP_APP_PASSWORD`
  secrets via `denomailer` (a Deno SMTP client) — currently unset, so it always reports
  `emailSent: false` with a clear reason, and the modal shows the credentials for manual
  sharing instead. Once those two secrets are set (a Gmail account + an
  [app password](https://myaccount.google.com/apppasswords)), sending starts working with
  no code changes.
- `CLIENT_ERP_PORTAL_URL` secret is set (`https://clienterpb2b.netlify.app`) and included
  in the credentials.
- Verified live end-to-end with a disposable test lead (created, tested, fully cleaned up
  afterward) — never touched a real client's account.

## 4. client-erp — features built this session

### client_users / portal_settings — see §3 above (both are client-erp-side tables written
  from the main ERP via Edge Functions with client-erp's service role key).

### Meeting recording + transcription — **IN PROGRESS, CURRENTLY BROKEN, mid-debug**
client-erp already had (pre-existing, not built this session) a **live embedded Jitsi
call** right inside the browser (`Meetings.tsx` + `JitsiMeetEmbed.tsx`, public
`meet.jit.si`, both client and staff join the same in-page call) — this is different from
the main ERP's Meetings module, which just stores an external link as text.

The ask: auto-record meetings (audio of both sides) and transcribe them via the user's own
paid OpenAI API key, store in Cloudinary, show in "Past Meetings" (which already had UI
slots for `recordingUrl`/`aiSummary`/`decisions` — nobody had wired them up yet).

**Hard constraint established and agreed with the user**: browsers require an explicit,
non-bypassable "share this tab" permission click — there is no way to make recording
100% silent/automatic without self-hosting Jitsi with Jibri (real server infra the user
does not have — no VPS). Agreed approach: **one-click auto-record on join**, staff-side
only (`context.person.kind === "admin"`), never for clients.

**What was built:**
- `client-erp/src/lib/meetingRecording.ts` — `getDisplayMedia` (video + tab audio) mixed
  with `getUserMedia` (own mic) via Web Audio API `MediaStreamDestination`, so both sides'
  voices are captured; `MediaRecorder` → webm blob.
- `client-erp/src/lib/cloudinary.ts` (new — client-erp didn't have one) — unsigned upload
  to Cloudinary's `/video/upload` endpoint, same cloud account/preset (`djyl2qvdc` /
  `base2brand_chat`) already used by the main ERP for screenshots/chat files. **Not yet
  confirmed the preset actually allows the "video" resource type** — flagged as a possible
  failure point, unconfirmed.
- New client-erp migration `20260926000000_meeting_transcript.sql` — adds
  `meetings.transcript` column, and **adds a `meetings_update` RLS policy** (the table had
  SELECT/INSERT policies but no UPDATE policy at all before this — needed so the recording
  pipeline can write back `recording_url`/`ai_summary`/`decisions`/`transcript`).
- New client-erp Edge Function `transcribe-meeting-recording` — acts as the *calling
  user* (not service role) so DB writes go through normal RLS; derives an audio-only
  Cloudinary URL (swap extension to `.mp3`, Cloudinary transcodes on the fly) to keep the
  OpenAI upload small; calls `POST /v1/audio/transcriptions` (`whisper-1`) then
  `gpt-4o-mini` to derive a summary + decisions list (JSON mode); reads `OPENAI_API_KEY`
  secret — **not yet set by the user**, currently returns a clean
  `"OPENAI_API_KEY is not set on this project yet."` error rather than failing silently.
- `Meetings.tsx` wiring: `canRecord` prop (from `App.tsx`, `context.person.kind==="admin"`),
  `tryStartRecording()` called as the very first `await` inside `handleJoin`/
  `handleStartInstant` (preserves the click's "user activation" so Chrome doesn't reject
  `getDisplayMedia` outright), a pulsing "Recording" badge in `JitsiMeetEmbed`'s header,
  and `processRecording()` (stop → upload → save URL → transcribe → toast) fired
  fire-and-forget when the call ends.
- Mounted `<Toaster theme="dark" />` in client-erp's `App.tsx` — **it was never mounted
  before**, so `sonner`'s `toast(...)` calls anywhere in client-erp would have silently done
  nothing.

**Deployed**: both `manage-portal-settings`/`enable-client-portal-access` (main ERP
project) and `transcribe-meeting-recording` (client-erp project) are live. Local
`tsc --noEmit` and `npm run build` both pass clean on client-erp.

**Currently debugging — where this was left off**: the user tested locally
(`npm run dev`, not the stale Netlify deploy) logged in as the real admin account
(`aaryanbase2brand@gmail.com`, confirmed `kind='admin'` in the DB) and saw **neither** the
browser's screen-share permission prompt **nor** the "Recording" badge when clicking
Join/Start Meeting — meaning `tryStartRecording()`'s guard
(`if (!canRecord || !canRecordTab()) return;`) short-circuited, or something failed before
`getDisplayMedia()` ever ran. The wiring was re-verified line-by-line and looks correct
(`canRecord={context.person.kind === "admin"}` in `App.tsx` → threaded correctly into
`Meetings.tsx` → gate check is correct). Root cause **not yet found**. Last message asked
the user to hard-refresh (rule out stale HMR state) and check the browser DevTools
console for any error at the moment they click Join/Start Meeting — **awaiting that
console output** to continue diagnosis. No code fix has been applied yet for this bug.

Known things NOT yet ruled out:
- Whether the dev server page was actually reloaded after these edits landed (Vite HMR
  should catch component changes, but worth a hard refresh to be sure).
- Whether `getDisplayMedia` is throwing synchronously for some environment reason (e.g. a
  browser flag, or being tested inside an unexpected embedding context) that the
  try/catch in `tryStartRecording()` swallows into a `toast.info(...)` call the user
  might not have noticed (only *prompt* and *badge* were asked about, not the toast).
- Whether Cloudinary's `base2brand_chat` unsigned preset actually permits `video` resource
  type uploads (would only matter if recording actually started, which per the above it
  apparently didn't).

## 5. Known unresolved issues (not addressed this session, flagged and left as-is)

- **`enforceAutoLunchBreak()` in `src/lib/database.ts`** inserts `clock_session_segments`
  rows with `kind: "lunch_break"` / `kind: "work"`, but the live DB's
  `clock_session_segments_kind_check` constraint only allows
  `'working' | 'break' | 'meeting' | 'idle'`. This has likely been silently failing every
  day at 2 PM for every employee (insert error never checked/surfaced). Confirmed via a
  live failed insert early in the session. **Never fixed** — was offered, user did not
  follow up on that specific offer before the conversation moved to other features.

## 6. Manual data corrections made this session (for the record, not code changes)

- Corrected a real employee's ("Arshpreet Singh") clock-in time and inserted a manual
  lunch-break segment (worked around the `enforceAutoLunchBreak` bug above by using
  `kind: "break"` + `label: "Lunch Break"`).
- Converted a "System Idle" `clock_session_segments` row to `kind: "working"` for
  employee "rishav karn" (`78904c67-2e90-41c8-a18b-675a8cd20fa9`) for 2026-09-25, per a
  direct request to remove that day's idle state.

## 7. Secrets reference (set where, and what's still missing)

**Main ERP project (`jgbkpbafgwxlkudwqvdb`) secrets** (already set, reused across
functions): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (auto),
`CLIENT_ERP_SUPABASE_URL`, `CLIENT_ERP_SERVICE_ROLE_KEY`, `CLIENT_ERP_PORTAL_URL`
(`https://clienterpb2b.netlify.app`), `CLOUDINARY_*` (cloud name/key/secret),
`FIREBASE_SERVICE_ACCOUNT`. **Missing**: `GMAIL_SMTP_USER` / `GMAIL_SMTP_APP_PASSWORD`
(needed for Enable Client Portal Access to actually send email).

**client-erp project (`ptnsbdtqkooidvcdqzee`) secrets**: auto-injected
`SUPABASE_URL`/`SUPABASE_ANON_KEY` only so far. **Missing**: `OPENAI_API_KEY` (the user
has a paid key ready, just hasn't run
`supabase secrets set OPENAI_API_KEY=sk-... --project-ref ptnsbdtqkooidvcdqzee` yet —
and this alone won't fix the recording bug above, which happens *before* transcription is
ever reached).

## 8. Test/throwaway accounts still live (deliberately not cleaned up, useful for testing)

- Main ERP client login: `clienttest@base2brand.com` / `ClientTest12345` (project P685).
- client-erp admin: `aaryanbase2brand@gmail.com` / `12345678` (`kind='admin'`).
- client-erp test client account mentioned by the user: `testclient@base2brand.dev`
  (not created by this session — pre-existing, used by the user for their own testing).

All other test data created purely for verification during this session (disposable
leads, org/person/auth rows in client-erp) was created and then fully cleaned up
immediately after each test — nothing else should be lying around.
