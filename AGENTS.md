# SSS Library

React + Vite + Tailwind CSS front end for the library catalog, backed by Supabase. Originally scaffolded in Figma Make; runs as a normal standalone project now — `vite.config.ts` only uses Figma Make-specific config when that platform's generated files are present, and falls back to plain defaults otherwise.

## Development Server

Not auto-started outside the Figma Make platform. Run `pnpm dev` to start it (see [README.md](README.md) for full setup, including the required `.env`). If this project is open inside Figma Make specifically, that platform runs its own dev server on `$PORT` automatically and you don't need to start one.

- Hot reload: changes to source files are reflected immediately.

## Key Files

- `src/App.tsx` - Main application component (all pages/UI currently live in this one file)
- `src/main.tsx` - React entry point
- `src/index.css` - Global styles and Tailwind CSS import
- `src/lib/` - Supabase data layer (catalog, auth, checkouts, etc.) — see [README.md](README.md) for what each file does
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Vite configuration
- `.mise.toml` - Toolchain versions (Node.js, pnpm)
- `supabase/migrations/` - SQL run against the Supabase project (tables, RLS policies, functions)
- `tests/` - Playwright E2E tests — see [tests/README.md](tests/README.md) for setup, conventions, and a known gap in the auth fixture
- `playwright.config.ts` - Playwright configuration

## Testing

`pnpm test:e2e` runs the Playwright suite (`pnpm test:e2e:headed` / `:debug` for interactive runs). See [tests/README.md](tests/README.md) before adding tests — it covers the fixture conventions (always import `test`/`expect` from `tests/support/merged-fixtures`, never `@playwright/test` directly) and the one open gap (auth-session token minting isn't implemented yet, since this app uses magic-link email with no password grant).

## Styling

This project uses **Tailwind CSS v4** for styling. Use Tailwind utility classes directly in JSX. Tailwind is loaded via the Vite plugin — no PostCSS config needed. Note: `src/App.tsx` currently uses inline `style={{...}}` objects throughout rather than Tailwind classes — be aware of this existing pattern before assuming Tailwind classes are in use there.
