# Setup and git workflow

Step-by-step for getting the code onto your machine, working on your own branch, and getting it back into `main` via a PR. Written assuming you might not have done this before — if you have, skip to whatever section you need.

## 0. One-time setup

Install Git if you don't have it:
- **Mac**: open Terminal, run `git --version` — if it's not installed, macOS will prompt you to install the Xcode Command Line Tools. Accept that.
- **Windows**: install [Git for Windows](https://git-scm.com/download/win), which gives you "Git Bash." You can use PowerShell too — the `git` commands below are identical in both; only folder-navigation commands (`mkdir`, `cd`, `ls`/`dir`) differ, and both are noted.

Set your name/email once, globally (used to attribute your commits):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Make sure you have access to the GitHub repo (ask whoever owns it to add you as a collaborator) and can authenticate — either via SSH key or a GitHub personal access token when prompted for a password.

## 1. Make a folder and clone the repo

**Mac/Linux Terminal:**
```bash
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/<org>/<repo>.git
cd <repo>
```

**Windows PowerShell:**
```powershell
New-Item -ItemType Directory -Force -Path "$HOME\Projects"
cd "$HOME\Projects"
git clone https://github.com/<org>/<repo>.git
cd <repo>
```

Cloning already sets up a remote named `origin` pointing at that GitHub URL — that's what `push`/`pull`/`fetch` talk to by default. Verify it:

```bash
git remote -v
```

You should see `origin` listed twice (fetch and push), pointing at the repo URL. You don't need to configure this yourself — clone does it for you.

Then follow the main [README.md](../README.md) setup steps (`pnpm install`, copy `.env.example` to `.env`, get Supabase credentials from whoever owns the project).

## 2. Make sure you're on an up-to-date `main`

Every time you start new work, do this first — `main` moves as other people merge PRs, and you want to branch off the latest version:

```bash
git checkout main
git pull origin main
```

## 3. Create your branch

Branch name: just your name (lowercase, no spaces — use a dash if you have two words, e.g. `jane-doe`).

```bash
git checkout -b yourname
```

This creates the branch and switches to it in one step. Everything you do now happens on `yourname`, not `main` — `main` stays untouched until you open a PR.

## 4. Work, and commit periodically

Don't wait until a feature is fully done to make your first commit. Commit at natural checkpoints — got `fetchBooks()` reading real data, got the login form calling `signIn()`, got the catalog page rendering it — each of those is a commit. Small, frequent commits make it much easier for someone (including future you) to see what changed and roll back a single bad step instead of an entire day's work.

```bash
git status                    # see what you've changed
git add src/lib/books.ts      # stage specific files — avoid `git add .` if you're not sure what's in the folder
git commit -m "Implement fetchBooks() against books+copies tables"
```

Push your branch to GitHub regularly too, not just at the end — it's your backup if your laptop dies, and it lets others see your progress:

```bash
git push -u origin yourname   # first push on this branch — sets up tracking
git push                      # every push after that
```

## 5. Keep your branch synced with `main`

If `main` gets new commits while you're mid-feature (someone else merged a PR), pull them into your branch periodically so you don't end up with a huge conflict at the end:

```bash
git checkout main
git pull origin main
git checkout yourname
git merge main
```

Resolve any conflicts Git flags, then commit the merge.

## 6. Open a pull request

Push your final commits, then open a PR from `yourname` → `main` on GitHub (or `gh pr create` from the terminal if you have the GitHub CLI).

**PR description — two parts:**

1. **Verbose overall summary.** A few sentences to a short paragraph explaining *what* you built and *why*, in plain language — someone who wasn't watching you work should understand the feature and the reasoning behind any non-obvious decisions (e.g. "went with X source for events because Y didn't have public API access").
2. **Checklist of what was done**, mirroring your commit history — this should read like your periodic commit messages turned into a changelog, not a rewrite. Example:

```markdown
## Summary
Implemented the events feature end-to-end: pulls from the Sai Seva Sadan
Google Calendar via the Calendar API (went with the API over the .ics feed
since it gives structured start/end times), caches results in a new
`events` table refreshed daily via a Supabase Edge Function, and replaced
the hardcoded EVENTS array on the home page with the real data.

## What was done
- Added `events` table + RLS read policy
- Implemented fetchEvents() in src/lib/events.ts
- Added Edge Function to refresh events daily from Google Calendar API
- Wired fetchEvents() into HomePage, removed hardcoded EVENTS array
- Handled empty/error states in the events section

## Testing
- Verified events render correctly with real calendar data
- Confirmed stale/past events don't show up
```

Tag someone to review before merging, even if it's a quick look — don't merge your own PR straight to `main` without at least one other set of eyes on it.
