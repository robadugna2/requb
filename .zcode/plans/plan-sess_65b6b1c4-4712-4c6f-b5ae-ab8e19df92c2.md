# Restructure Admin Dashboard Navigation & Group Pages

## Problems (confirmed from screenshots + code)
1. **Duplicate Members sections** — a global "Members" sidebar page (`app/members/page.tsx`, 599 lines) lists the same people already visible inside each group; the group detail page lists members in *three* places (Members tab, Shares & Dues tab, plus modals).
2. **9 messy tabs** on the group detail page (`groups/[id]/page.tsx`, 4,575 lines): Deposits, Members, Rules, Penalties, Disputes, Turn Swaps, Guarantors, Shares & Dues, Leaders — too many, overlapping, wrapping badly.
3. **God-file** — everything in one 4,575-line component; hard to maintain.

## Plan

### Step 1 — Remove Members from the sidebar
- `config/nav-config.ts`: delete the "Members" nav item (line 41-47).
- Delete `app/members/page.tsx` (the global "Platform Members" list). No functionality is lost: the group "Add Member" modal already supports both *create new member* and *add existing member*.
- Keep `app/members/[id]/page.tsx` (individual member profile with deposit history) — it's opened from inside groups. Fix its back-button (`router.push('/members')` at line 158 → `router.back()`).

### Step 2 — Consolidate group tabs: 9 → 4
New tab structure on the group detail page (permission mapping preserved exactly):

| New tab | Contains (merged from) | Visible to |
|---|---|---|
| **Deposits** (default) | Current deposits UI (KPIs, cycle selector, table) + **Penalties** as a section below | canManageDeposits |
| **Members** | ONE unified roster: avatar, name + **leader badge**, phone, **share chip (full / ½ / ¼…)**, per-cycle ETB, total due, won status, actions (edit shares, grant waiver, remove, view profile) — merges old Members + Shares & Dues tabs; **Merged Groups** section moves here; Add Member stays | canManageMembers |
| **Requests** | Disputes + Turn Swaps + Guarantors (Wase) as three stacked sections with mini sub-nav | canManageMembers |
| **Settings** | Rules & Settings + **Leaders** (sub-admin privilege checkboxes — owner/super-admin only, as today) | canManageRules / owner |

Group leaders keep seeing only what their privileges allow (the `visibleTabs` logic at line 263 is remapped to the new 4 tabs, same underlying `canManage*` flags).

### Step 3 — Decompose the god-file
Split into `components/groups/`: `GroupHeader.tsx`, `DepositsTab.tsx`, `MembersTab.tsx`, `RequestsTab.tsx`, `SettingsTab.tsx`. `page.tsx` keeps data fetching + permissions + tab state (target < 400 lines). **No backend/API changes** — all existing `lib/api.ts` calls stay.

### Step 4 — UI polish
- Compact segmented tab bar with icons + live counts (e.g. "Members 46"), no wrapping; horizontal scroll on mobile.
- Roster: share-fraction chips, leader shield badges, search box, sticky table header, skeleton loaders, consistent empty states.
- New i18n keys added to both English and Amharic dictionaries in `LanguageContext.tsx`.

### Step 5 — Verify
`npm run build:web` must pass; quick dev-server render check of the group page tabs and permissions.

## Out of scope
Backend changes, the receipts/lottery/admins pages, and database changes.
