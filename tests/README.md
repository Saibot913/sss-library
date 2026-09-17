# Tests

End-to-end tests for the SSS Library app, using Playwright.

## Setup

```bash
pnpm install
npx playwright install --with-deps chromium
cp tests/.env.example tests/.env   # fill in SUPABASE_SERVICE_ROLE_KEY, see below
```

The suite starts its own dev server (`pnpm dev`) automatically via
`webServer` in [`playwright.config.ts`](../playwright.config.ts), so you
don't need `pnpm dev` running separately first. That dev server still needs
the app's own root `.env` (`VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`)
set up per the root [README.md](../README.md).

### Auth: `tests/.env` and the seeded test accounts

Any spec that signs in (`test.use({ authSessionEnabled: true })`) mints a
real Supabase session server-side via the service-role admin API — see
[`tests/support/mint-session.ts`](support/mint-session.ts) and the
[`tests/support/auth-fixture.ts`](support/auth-fixture.ts) TODO this
replaced. This needs `tests/.env` (gitignored, never commit real values —
copy from `tests/.env.example`) with:

- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings > API.
  **Server-side/test-runner only** — this must never go in the app's own
  `.env`, in a browser-executed file, or be committed anywhere. See
  [`README.md` #10](../README.md#10-deploy-email-auth) for the same rule
  applied to the `auth-email` Edge Function.
- `TEST_PATRON_EMAIL` / `TEST_STAFF_EMAIL` — dedicated test accounts, not
  either real staff email. Before running signed-in specs for the first
  time (or against a fresh database), seed these accounts once:

  ```bash
  pnpm test:e2e:seed
  ```

  This creates both accounts if they don't exist (Supabase's admin API,
  not a real email), gives the patron a complete profile (checkout requires
  one), and adds the staff account's row to the `staff` table. It's
  idempotent — safe to rerun.

The auth fixture defaults to the patron identity; opt into the staff one
per-test with `test.use({ authOptions: { userIdentifier: process.env.TEST_STAFF_EMAIL } })`
(see `tests/e2e/staff-return.spec.ts`).

## Running tests

```bash
pnpm test:e2e            # headless, once
pnpm test:e2e:headed     # watch the browser
pnpm test:e2e:debug      # step through with the Playwright inspector
```

View the last HTML report: `npx playwright show-report`.

## Architecture

- `tests/e2e/` — spec files (`*.spec.ts`)
- `tests/support/merged-fixtures.ts` — the **only** place specs import `test`
  from. Composes `@seontechnologies/playwright-utils` fixtures (API requests,
  network interception, network-error monitoring, `recurse`) with this
  project's own auth fixture via `mergeTests`. Never import `test` from
  `@playwright/test` directly in a spec.
- `tests/support/auth-fixture.ts` — Supabase auth provider. This app signs
  patrons in via magic-link email (`src/lib/auth.ts`), which has no
  password/API grant a test can drive directly, so `manageAuthToken` mints a
  real session server-side via the service-role admin API instead — see
  `tests/support/mint-session.ts` and the "Auth" section above.
- `tests/support/seed-test-accounts.ts` — one-time (idempotent) setup for the
  two accounts the suite signs in as. Run via `pnpm test:e2e:seed`.
- `tests/support/global-setup.ts` — runs once before all tests; registers
  the auth provider.
- `tests/support/helpers/data-factories.ts` — test data builders. Uses
  `crypto.randomUUID()`/`Date.now()` rather than Faker (not installed).

## Conventions

- Every spec imports `test`/`expect` from `../support/merged-fixtures`, not
  `@playwright/test`.
- Use `apiRequest` (from the merged fixtures) for API calls, not the raw
  Playwright `request` object.
- Use `interceptNetworkCall({ url })` to observe/stub network calls in UI
  tests, not `page.route`/`page.waitForResponse`.
- Never use `page.waitForTimeout()` — use `recurse()` or Playwright's
  built-in auto-waiting `expect(...)` assertions instead.
- This app has no `data-testid` convention yet — samples use role/text/
  placeholder selectors grounded in real UI copy
  (`getByRole`, `getByPlaceholder`). Prefer `data-testid` for anything
  brittle (dynamic text, icon-only buttons) going forward, and note it if
  you add the convention.
- Tag priority with `[P0]`/`[P1]`/etc. in test titles.

## Write-time enforcement

`.claude/hooks/tea-enforce.cjs` runs on every Write/Edit/Bash call touching
files matched by `testGlobs` in `.tea/enforce-config.json` (currently
`tests/**/*.spec.{ts,js}`), plus a sweep when a Claude Code turn ends. It
blocks banned patterns (`.only`, `page.waitForTimeout`, `page.route`/raw
`request.*` on app endpoints, `console.log` in tests, etc.) at write time
instead of waiting for review. Severity comes from
`bmad-testarch-test-review`'s criteria registry, not the hook itself. To
turn a specific rule off, add it to `disabledRules` in
`.tea/enforce-config.json` and say why in the commit — don't edit the hook
script itself (it's a byte-for-byte copy checked against a hash in that same
config file). The hook fails open: if it errors, the write goes through.

## CI

Wired into [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml),
runs on every PR into `main`. Needs `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`TEST_PATRON_EMAIL`, `TEST_STAFF_EMAIL` as repo secrets (Settings > Secrets
and variables > Actions) — the test accounts still need `pnpm test:e2e:seed`
run once against that Supabase project before signed-in specs will pass in
CI. Uploads `playwright-report/`/`test-results/` as artifacts on failure.

## Knowledge base

The scaffolding follows patterns from BMAD's `tea` module knowledge base
(tracked in this repo at `.claude/skills/bmad-testarch-test-review/resources/knowledge/`
and `.claude/skills/bmad-testarch-nfr/resources/knowledge/` — only the skills
this project's review tooling actually calls are kept, `bmad-testarch-framework`
isn't one of them) — see `playwright-utils-mandate.md`, `auth-session.md`,
`playwright-config.md`, `data-factories.md`.
