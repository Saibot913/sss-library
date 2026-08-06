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

## Styling

This project uses **Tailwind CSS v4** for styling. Use Tailwind utility classes directly in JSX. Tailwind is loaded via the Vite plugin — no PostCSS config needed. Note: `src/App.tsx` currently uses inline `style={{...}}` objects throughout rather than Tailwind classes — be aware of this existing pattern before assuming Tailwind classes are in use there.
