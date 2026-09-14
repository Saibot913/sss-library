# SSS Library — Setup Guide

This is a website (React + Vite + Tailwind, backed by Supabase) for the Sri Sathya Sai Baba Center of Sacramento's library. This guide gets the project running on your computer from a completely blank start — it assumes nothing is installed yet. Follow it top to bottom, in order.

## 0. What you'll need

- A **GitHub account** — sign up free at [github.com](https://github.com) if you don't have one.
- Ask **Surya, (916) 805-0152**, to **add you as a collaborator** on this repo (GitHub → repo → Settings → Collaborators). You can't push code without this.
- Ask them for the **two Supabase credentials** too (you'll need them in step 6) — send these privately (text/DM), never post them anywhere public.

Everything else below you'll install yourself.

## 1. Open a terminal

The terminal is where you'll type commands for the rest of this guide.

- **Mac**: press `Cmd + Space`, type `Terminal`, press Enter.
- **Windows**: press the Start key, type `PowerShell`, press Enter.

Keep it open — every command below gets typed into this window, then press Enter to run it.

## 2. Install Git

Git is the tool that downloads the code and tracks changes.

- **Mac**: type `git --version` and press Enter. If it's not installed, macOS will pop up a prompt to install the "Command Line Tools" — click Install and wait for it to finish.
- **Windows**: download and run the installer from [git-scm.com/download/win](https://git-scm.com/download/win). Default options are fine — just keep clicking Next.

Set your name and email once (used to label your commits later — use the same email as your GitHub account):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 3. Install Node.js

Node.js runs the project's JavaScript tooling.

1. Go to [nodejs.org](https://nodejs.org), download the **LTS** version for your OS, run the installer, keep clicking Next/default options.
2. Verify it worked — in your terminal:
   ```bash
   node --version
   ```
   Should print something like `v22.x.x`. If you get "command not found," close and reopen your terminal and try again.

## 4. Install pnpm

This project uses `pnpm` instead of the more common `npm` to manage its packages.

```bash
npm install -g pnpm
```

Verify:
```bash
pnpm --version
```

## 5. Get a code editor

You'll want something to actually look at and edit the code. Recommended: [VS Code](https://code.visualstudio.com) — download, install, default options.

## 6. Clone the repo (download the code)

Pick a folder to keep your projects in, then download the code into it.

**Mac Terminal:**
```bash
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/Saibot913/sss-library.git
cd sss-library
```

**Windows PowerShell:**
```powershell
New-Item -ItemType Directory -Force -Path "$HOME\Projects"
cd "$HOME\Projects"
git clone https://github.com/Saibot913/sss-library.git
cd sss-library
```

The first time you `git clone` or push, GitHub will likely open a browser window asking you to log in — sign in there, and your terminal will remember it after that.

Open the folder in VS Code to actually browse/edit the code: `code .` in the terminal (if that doesn't work, open VS Code normally and use File → Open Folder).

## 7. Install the project's dependencies

Still inside the project folder in your terminal:

```bash
pnpm install
```

This downloads all the libraries the project depends on (React, Supabase, etc.) into a `node_modules` folder. Takes a minute, only needs to be done once (and again later if dependencies change).

## 8. Connect to Supabase

The two credentials someone gave you in step 0 go here.

1. Copy the example file to a real one:
   - **Mac**: `cp .env.example .env`
   - **Windows**: `Copy-Item .env.example .env`
2. Open `.env` in VS Code and fill in the two values you were given, so it looks like:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=xxxxxxxxxxxxxxxx
   ```
3. Save the file.

`.env` never gets uploaded to GitHub (it's in `.gitignore` on purpose) — every teammate keeps their own local copy.

## 9. Run it

```bash
pnpm dev
```

Leave this running in your terminal. It'll print a URL like `http://localhost:8443` — open that in your browser. That's the live site, running on your machine. Saving any code change auto-refreshes it.

To stop it later: click into the terminal and press `Ctrl + C`.

## 10. Deploy email auth

Signup and login email requests run through `supabase/functions/auth-email`.
The function keeps the service-role key on Supabase and uses the Invite user
template for signup. From the project root, link your Supabase project and set
the service secret before deploying:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set APP_ORIGIN=http://localhost:3000
supabase functions deploy auth-email --no-verify-jwt
supabase functions deploy delete-account --no-verify-jwt
```

`APP_ORIGIN` should be your real deployed website URL in production.
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
provided automatically to the deployed function by Supabase. Never put the
service-role key in `.env` or frontend code.

## Repo layout, quick reference

- **`src/App.tsx`** — the whole app's UI currently lives here.
- **`src/lib/`** — the Supabase-facing code (fetching books, logging in, checking out, etc.).
- **`supabase/migrations/`** — SQL that sets up the database (tables, permissions, functions).
- **`tests/`** — Playwright end-to-end tests (`pnpm test:e2e` to run them); see [tests/README.md](tests/README.md).
- **`CHANGELOG.md`** — every PR adds a line here; see [project-instructions/GIT_WORKFLOW.md](project-instructions/GIT_WORKFLOW.md).
- **`.mise.toml`**, **`pnpm-lock.yaml`**, **`package.json`** — tooling/dependency config, you generally won't hand-edit these.
- **`CLAUDE.md`** / **`AGENTS.md`** — instructions for AI coding assistants (like Claude Code) working in this repo, not for you directly.

## Now go get started

You're set up. Head to [`project-instructions/`](project-instructions/) — `README.md` there has what needs to be built, and `GIT_WORKFLOW.md` covers how we branch, commit, and open pull requests.
