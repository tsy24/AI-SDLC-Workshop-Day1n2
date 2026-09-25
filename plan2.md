# Plan 2: Rapid 4-Person Build of All 11 PRPs (Few Hours, Copilot-Driven)

### TL;DR
Compress the multi-week build in [plan.md](plan.md) into a single working session (~4-5 hours wall clock) by (1) having one engineer lock the shared schema/types/auth/todo-core in a fast foundation pass using [PRPs/00-one-shot-implementation.md](PRPs/00-one-shot-implementation.md), then (2) fanning the remaining feature PRPs out to 3 engineers working in parallel git worktrees against that fixed contract, each driving GitHub Copilot in **agent mode** with the individual PRP pasted in as the spec, then (3) a short integration/merge/smoke-test pass. The only way to hit "hours not weeks" is to remove the two classic parallelism blockers: a shared schema that keeps changing, and a monolithic `app/page.tsx` that everyone edits at once.

### Assumptions & explicit trade-offs
- All 4 engineers have GitHub Copilot Chat with **agent mode** (autonomous multi-file edit + terminal + test execution) enabled.
- "Few hours" means we deliberately narrow scope vs. the full [testing.md](.claude/rules/testing.md) 80%-coverage bar: unit tests only where a PRP calls out sharp edge cases (recurrence clamping, timezone, import transactions); one consolidated Playwright pass at the end instead of per-feature suites. Call this out to the team explicitly — it's a scope cut for speed, not silent corner-cutting.
- `app/page.tsx` stays monolithic per project convention long-term, but **during the parallel window** each engineer builds their UI as a temporary standalone component and the integrator inlines it in Phase 2. This avoids 4-way merge conflicts on one 2000-line file.
- Use `git worktree` (not 4 separate clones) so everyone shares one `.git` and pulls Phase 0 the moment it's pushed.

### Timeline overview

| Phase | Duration | Who | Output |
|---|---|---|---|
| 0. Kickoff & contract lock | 15 min | All 4 (sync) | Assignments confirmed, schema reviewed, branch strategy agreed |
| 1. Foundation sprint | 45-60 min | Engineer 1 solo, others prep | Repo scaffolded, full schema, auth, todo CRUD (01) + priority (02) merged to `main` |
| 2. Parallel feature build | 90-120 min | Engineers 1-4 in parallel worktrees | All 11 PRPs implemented as isolated components/routes on feature branches |
| 3. Integration | 45-60 min | Engineer 1 (integrator) + spot help | Branches merged in dependency order, `app/page.tsx` reassembled, build green |
| 4. Smoke test & hardening | 30-45 min | All 4 (split by area) | One Playwright pass per major flow, critical bugs fixed |

**Total: ~4-4.5 hours.**

### Team split (feature ownership)

1. **Engineer 1 — Foundation, Auth, Todo Core, Integrator**
   - Phase 1 (solo): scaffold Next.js app, `lib/db.ts` with the **entire** schema from [PRPs/00-one-shot-implementation.md](PRPs/00-one-shot-implementation.md) (all tables, even ones other engineers own — this is the contract lock), `lib/timezone.ts`, `lib/auth.ts`, WebAuthn routes ([PRPs/11-authentication-webauthn.md](PRPs/11-authentication-webauthn.md)), middleware, and base todo CRUD + priority ([PRPs/01-todo-crud-operations.md](PRPs/01-todo-crud-operations.md), [PRPs/02-priority-system.md](PRPs/02-priority-system.md)). Push to `main` as soon as green — this unblocks everyone else.
   - Phase 2: build recurring todos + reminders ([PRPs/03-recurring-todos.md](PRPs/03-recurring-todos.md), [PRPs/04-reminders-notifications.md](PRPs/04-reminders-notifications.md)) on `feat/recurring-reminders`.
   - Phase 3: acts as integrator — merges all branches in dependency order, reassembles `app/page.tsx`.

2. **Engineer 2 — Subtasks, Tags, Templates**
   - Owns [PRPs/05-subtasks-progress.md](PRPs/05-subtasks-progress.md), [PRPs/06-tag-system.md](PRPs/06-tag-system.md), [PRPs/07-template-system.md](PRPs/07-template-system.md) on `feat/subtasks-tags-templates`.
   - Build UI as standalone components (`SubtasksPanel.tsx`, `TagPicker.tsx`, `TemplateModal.tsx`) that take props/callbacks rather than reaching into page state directly — makes inlining trivial later.

3. **Engineer 3 — Search/Filtering, Export/Import**
   - Owns [PRPs/08-search-filtering.md](PRPs/08-search-filtering.md), [PRPs/09-export-import.md](PRPs/09-export-import.md) on `feat/search-export-import`.
   - Search/filter logic as pure functions in `lib/filters.ts` (easy to merge, no shared UI state fights). Export/import as isolated API routes + a small toolbar component.

4. **Engineer 4 — Calendar View**
   - Owns [PRPs/10-calendar-view.md](PRPs/10-calendar-view.md) on `feat/calendar`, including the holiday seed script.
   - Lightest solo scope of the four — use spare time to co-own the Phase 4 Playwright smoke pass and help Engineer 1 with integration conflicts.

### Why this split (vs. plan.md's week-based split)
- Dependency graph in [PRPs/README.md](PRPs/README.md) shows almost everything depends on Todo CRUD (01) and, transitively, Auth (11). Those *must* be sequential and are the critical path — hence one engineer front-loads them fast instead of splitting further.
- Once schema + todo CRUD exist, subtasks/tags/templates, search/export, and calendar are mutually independent (they touch different tables/routes), so 3 engineers can build simultaneously with near-zero contract collisions.
- Recurring + reminders modify the `todos` table's behavior (completion side-effects, notification polling) — safer to keep with whoever wrote the core CRUD, since they already hold that context.

### Phase 0 — Kickoff (15 min, all 4 together)
1. Confirm the schema in [PRPs/00-one-shot-implementation.md](PRPs/00-one-shot-implementation.md) as final — no changes allowed mid-flight without a sync.
2. Agree on branch names and the merge order for Phase 3 (see below).
3. Engineer 1 shares repo scaffold command; others run `git worktree add ../wt-<name> -b feat/<name>` against the not-yet-pushed `main` so they're ready to rebase the moment Phase 1 lands.
4. Each engineer opens their PRP file in Copilot Chat and pre-drafts the agent prompt (see "Copilot usage pattern" below) so they can fire immediately when unblocked.

### Phase 1 — Foundation sprint (45-60 min, Engineer 1 solo)
1. Scaffold Next.js 16 app, Tailwind, Playwright config with virtual WebAuthn authenticators.
2. Paste the full schema section of [PRPs/00-one-shot-implementation.md](PRPs/00-one-shot-implementation.md) into Copilot agent mode; have it write `lib/db.ts` with every table + every DB object (`todoDB`, `subtaskDB`, `tagDB`, `templateDB`, `holidayDB`) up front, even the empty CRUD stubs for tables other engineers own — this is what lets Phase 2 run lock-free.
3. Implement `lib/timezone.ts`, `lib/auth.ts`, WebAuthn routes, `middleware.ts`.
4. Implement todo CRUD API + minimal list page (01) and priority badges/sorting (02).
5. Run `npm run build` and a smoke Playwright login+create-todo test. Push to `main`. Post in team channel: "foundation is live, rebase now."

### Phase 2 — Parallel feature build (90-120 min, all 4 in parallel)
Each engineer, after rebasing onto the new `main`:
1. Pastes their PRP(s) into Copilot **agent mode** with an instruction like the pattern below, and lets it implement end-to-end (API route + UI component + minimal tests) in one continuous pass, per the "don't stop to ask for confirmation" execution rule in [PRPs/00-one-shot-implementation.md](PRPs/00-one-shot-implementation.md).
2. Builds UI as a standalone component that the integrator can inline later (props in, callbacks out — no direct reach into `app/page.tsx` state).
3. Runs `npm run build` + their own feature's route/unit tests locally before flagging done.
4. Pushes their branch and posts a short "ready to merge" note with any known rough edges.

**Copilot usage pattern (use for every feature):**
> "Implement [PRPs/0N-feature.md](PRPs/0N-feature.md) against the existing schema and conventions in [.github/copilot-instructions.md](.github/copilot-instructions.md). Build the API routes, DB helpers, and a standalone UI component (not inlined into `app/page.tsx` yet). Follow the model-routing guidance in [PRPs/00-one-shot-implementation.md](PRPs/00-one-shot-implementation.md): use a fast/cheap model for repetitive CRUD and UI, and switch to the main model only for the sections marked correctness-critical. Write the files directly, run the build, and report back with a one-line summary per file."

### Phase 3 — Integration (45-60 min, Engineer 1 + spot help)
1. Merge order (matches dependency graph, lowest risk first):
   `main` → `feat/recurring-reminders` → `feat/subtasks-tags-templates` → `feat/search-export-import` → `feat/calendar`.
2. For each merge: resolve `lib/db.ts` conflicts (should be additive only, since Phase 1 pre-created stubs), then inline the feature's standalone component(s) into `app/page.tsx` at the right spot, per the project's monolithic-UI convention.
3. Run `npm run build` after each merge, not just at the end — catch integration breaks incrementally.
4. Engineer 4 (lightest solo load) pairs with Engineer 1 for the trickiest merge (subtasks/tags/templates, since it touches the most shared list-item rendering).

### Phase 4 — Smoke test & hardening (30-45 min, all 4)
1. Run the full manual smoke flow from [plan.md](plan.md)'s verification plan: log in, create a todo, add subtasks + tags, make it recurring, get a reminder, filter/search, export/import, check the calendar.
2. Split remaining time by area: each engineer re-tests the feature(s) they built against the merged `main`, fixes their own regressions first (fastest context).
3. Run one consolidated Playwright pass across all `tests/*.spec.ts`; triage failures by owner.
4. Timebox bug-fixing to whatever's left of the session; log anything unresolved as follow-up rather than extending the session indefinitely.

### Guardrails to actually hit "a few hours"
- **No schema changes after Phase 0 kickoff** without an all-hands 5-minute sync — this is the #1 way parallel plans blow up.
- **No one else touches `app/page.tsx` until Phase 3** — standalone components only during Phase 2.
- Use Copilot **agent mode**, not chat-and-paste — the whole point of the one-shot PRP structure is minimal back-and-forth with the assistant.
- Prefer the fast/cheap model for CRUD-shaped work per the model-routing table in [PRPs/00-one-shot-implementation.md](PRPs/00-one-shot-implementation.md); reserve the flagship model for auth, recurrence math, reminder dedup, import transactions, and calendar grid generation.
- If a branch isn't buildable within its time box, integrate what works and stub the rest rather than blocking the whole merge train.

### Explicitly deferred for this fast pass
- Full 80%-coverage unit/integration/E2E suite (deferred to a follow-up hardening session).
- Cross-browser/device WebAuthn matrix testing (virtual authenticator only).
- Performance tuning, accessibility pass, and visual polish beyond what each PRP's UI examples already specify.
