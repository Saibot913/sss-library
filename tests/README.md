# Tests

End-to-end tests for the SSS Library app, using Playwright.

## Setup

```bash
pnpm install
npx playwright install --with-deps chromium
cp tests/.env.example tests/.env   # optional, only if overriding defaults
```

The suite starts its own dev server (`pnpm dev`) automatically via
`webServer` in [`playwright.config.ts`](../playwright.config.ts), so you
don't need `pnpm dev` running separately first.

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
- `tests/support/auth-fixture.ts` — Supabase auth provider. **Currently
  incomplete**: this app signs patrons in via magic-link email
  (`src/lib/auth.ts`), which has no password/API grant a test can drive
  directly. `manageAuthToken` throws until someone wires up either a
  Supabase service-role admin call (against a dedicated test account) or a
  test-only Edge Function — see the TODO comment in that file. The
  service-role key must never go in `.env` or this repo; see
  [`README.md` #10](../README.md#10-deploy-email-auth).
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

Not yet wired into `.github/workflows/`. To add it, mirror
`.github/workflows/verify.yml`'s pattern: install deps, run
`npx playwright install --with-deps chromium`, then `pnpm test:e2e`, and
upload `playwright-report/`/`test-results/` on failure. (`bmad-testarch-ci`
can scaffold this.)

## Knowledge base

The scaffolding follows patterns from BMAD's `tea` module knowledge base
(tracked in this repo at `.claude/skills/bmad-testarch-test-review/resources/knowledge/`
and `.claude/skills/bmad-testarch-nfr/resources/knowledge/` — only the skills
this project's review tooling actually calls are kept, `bmad-testarch-framework`
isn't one of them) — see `playwright-utils-mandate.md`, `auth-session.md`,
`playwright-config.md`, `data-factories.md`.
