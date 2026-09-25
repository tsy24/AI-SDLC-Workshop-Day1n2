## Plan: Todo App implementation for a team of 4

### TL;DR
Build the app in dependency order: foundation + auth, then the todo core, then feature layers that extend the shared todo model, and finally calendar/export plus end-to-end verification. The key structural decision is to treat the SQLite schema and shared types as the single source of truth, while the four engineers split across auth/database, todo lifecycle, task organization features, and reporting/UX. This keeps API contracts stable and reduces rework.

### Team split
1. Engineer 1 — Platform + Auth + Shared Data Layer
   - Scaffold Next.js app, DB connection, migrations, shared types, timezone utilities, and auth/session primitives.
   - Owns [PRPs/11-authentication-webauthn.md](../PRPs/11-authentication-webauthn.md), the shared DB wrapper in the project conventions, and the middleware protections.
   - Coordinates with all engineers on schema and API contract definitions.

2. Engineer 2 — Todo Core + Recurrence + Reminders
   - Owns the todo CRUD lifecycle and all behaviors that modify todo state.
   - Owns [PRPs/01-todo-crud-operations.md](../PRPs/01-todo-crud-operations.md), [PRPs/02-priority-system.md](../PRPs/02-priority-system.md), [PRPs/03-recurring-todos.md](../PRPs/03-recurring-todos.md), and [PRPs/04-reminders-notifications.md](../PRPs/04-reminders-notifications.md).
   - Produces the sorting logic, validation, recurring due-date logic, and reminder polling flow.

3. Engineer 3 — Task Organization + Productivity Features
   - Owns subtasks, tagging, templates, and client-side filtering workflows.
   - Owns [PRPs/05-subtasks-progress.md](../PRPs/05-subtasks-progress.md), [PRPs/06-tag-system.md](../PRPs/06-tag-system.md), [PRPs/07-template-system.md](../PRPs/07-template-system.md), and [PRPs/08-search-filtering.md](../PRPs/08-search-filtering.md).
   - Keeps the app page state consistent and ensures search/filter interactions work with the shared todo model.

4. Engineer 4 — Data Import/Export + Calendar + QA
   - Owns the holiday table, calendar page, export/import utility, and Playwright coverage.
   - Owns [PRPs/09-export-import.md](../PRPs/09-export-import.md), [PRPs/10-calendar-view.md](../PRPs/10-calendar-view.md), and the E2E test suite described in the PRP index.
   - Runs regression validation and coordinates the final cutover checklist.

### Delivery phases

#### Phase 0 — Shared foundation and contract lock (parallel with all teams, but central owner is Engineer 1)
**Status: Complete for implementation handoff.** Formal test/build execution remains deferred by request; rate limiting and broader hardening remain Phase 5 work.

1. Scaffold the app shell, Next.js App Router, Tailwind, and the auth/session layer.
2. Define SQLite schema, shared DB interfaces, and all CRUD helpers in the single DB module.
3. Add timezone utilities and strict validation helpers for dates, priorities, recurrence, reminders, and tags.
4. Establish the auth middleware and protected-route behavior.
5. Create a minimal list page and data-fetch loop to validate API contracts early.

Dependencies: none for the foundation; all later work depends on this phase.

#### Phase 1 — Auth and todo core (Engineer 1 + Engineer 2)
**Status: Implemented.** Tests and build execution are intentionally deferred by request.

1. Implement WebAuthn registration/login and session cookies.
2. Build the authenticated todo CRUD API and the list page create/edit/delete flow.
3. Implement priority validation, badge rendering, and sorting logic.
4. Validate all routes with session checks and user-scoping.

Dependencies: Phase 0 first; features 01 + 02 are the first real application work.

#### Phase 2 — Recurring and reminders (Engineer 2)
1. Add recurrence validation and the next-instance creation logic on completion.
2. Implement reminder storage and the notification polling endpoint.
3. Wire reminder badges and permission handling for the browser notifications flow.
4. Verify edge cases like month-end rollovers and duplicate notifications.

Dependencies: Phase 1 must be stable before recurring logic is introduced.

#### Phase 3 — Subtasks, tags, templates, and filtering (Engineer 3)
1. Add the subtasks table, CRUD endpoints, and progress bar logic.
2. Add user-scoped tag CRUD, many-to-many linking, and filter-driven UI.
3. Add template saving and use flows with subtasks serialized in JSON.
4. Implement debounced search and preset persistence in localStorage.
5. Reconcile list-view state so filtering works across subtasks, tags, and priorities.

Dependencies: todo core + priority + reminders should already be working; filter logic is layered on top of list data.

#### Phase 4 — Import/export and calendar (Engineer 4 with support from Engineer 3)
1. Implement JSON and CSV export endpoints and UI actions.
2. Build the import transaction, tag reuse logic, and data validation.
3. Add the holidays table and seed script.
4. Build the monthly calendar page, navigation, and day detail modal.
5. Confirm the app behaves correctly across protected routes and URL-based month state.

Dependencies: todos, tags, and subtasks must already exist and be populated correctly for import/export and calendar rendering.

#### Phase 5 — End-to-end verification and hardening
1. Run Playwright specs for authentication, todo CRUD, recurrence, reminders, subtasks, tags, templates, filters, import/export, and calendar.
2. Validate cross-user isolation, Singapore timezone behavior, and data integrity at boundaries.
3. Fix regressions with a final pass on the shared schema, auth, and API contract layer.
4. Confirm the app meets the acceptance criteria listed in the PRPs and is ready for a small pilot or staging review.

### Parallelization rules
- Engineer 1 and Engineer 2 can work in parallel during Phase 1 after the DB layer is established.
- Engineer 3 can start the subtasks/tag work immediately after the todo CRUD API is in place, even while Engineer 2 continues recurrence and reminders.
- Engineer 4 should not start the import/export and calendar UI until the core data model and tag/subtask relationships are stable.
- All four engineers review schema and API contract changes together at the end of each phase to avoid drift.

### Verification plan
1. Unit-level validation: timezone calculations, recurrence-month-end clamping, progress math, and filter logic.
2. API validation: session gating, user-scoping, 400/401/404/409 handling, and transaction integrity for import.
3. E2E validation: run the Playwright suite for each PRP-aligned feature area and confirm the app works with virtual WebAuthn authenticators.
4. Manual smoke check: a user logs in, creates a todo, adds subtasks and tags, repeats it, receives a reminder, filters, exports/imports, and checks the calendar view.

### Scope boundaries
Included:
- Todo lifecycle, priority, recurrence, reminders, subtasks, tags, templates, search/filter, JSON/CSV export-import, calendar, authentication, and end-to-end tests.

Explicitly excluded:
- Email/SMS push delivery beyond browser notifications
- Background service-worker notifications when the tab is closed
- Multi-device sync or cloud-based persistence
- Custom reminder offsets beyond the planned presets

### Recommended schedule
- Week 1: Foundation + auth + core todo CRUD + priority
- Week 2: Recurrence + reminders + subtasks + tags
- Week 3: Templates + filters + export/import + calendar
- Week 4: Testing, bug fixing, and staging hardening

This is a realistic 4-person schedule for the full app described in [PRPs/README.md](../PRPs/README.md) and the individual feature documents.