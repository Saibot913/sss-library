# Git workflow

How we use git day-to-day on this project. Assumes you've already followed the root [README.md](../README.md) — Git installed, repo cloned, app running. This is about branches, commits, and pull requests from here on.

## 1. Make sure you're on an up-to-date `main`

Every time you start new work, do this first — `main` moves as other people merge PRs, and you want to branch off the latest version:

```bash
git checkout main
git pull origin main
```

## 2. Create your branch

Branch name: just your name (lowercase, no spaces — use a dash if you have two words, e.g. `jane-doe`).

```bash
git checkout -b yourname
```

This creates the branch and switches to it in one step. Everything you do now happens on `yourname`, not `main` — `main` stays untouched until you open a PR.

## 3. Work, and commit periodically

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

## 4. Keep your branch synced with `main`

If `main` gets new commits while you're mid-feature (someone else merged a PR), pull them into your branch periodically so you don't end up with a huge conflict at the end:

```bash
git checkout main
git pull origin main
git checkout yourname
git merge main
```

Resolve any conflicts Git flags, then commit the merge.

## 4a. Read your own diff before you commit

```bash
git diff --stat
```

Look at the deletion count. **If you're adding a feature and the diff deletes a lot of lines, stop and find out why.** That's the whole check, and it takes five seconds.

This has bitten the project twice. Both times someone had pulled main correctly, but the file they committed came from an editor buffer or a copy that predated someone else's merge — so the commit quietly removed work that was already on `main`. Git can't warn you: a commit built from a stale file looks exactly like a deliberate deletion.

Pulling first is necessary but **not sufficient** — it stops your branch diverging, it doesn't stop a stale file being written back over what you pulled. The diff is what catches it.

Two related habits:

- **Don't push straight to `main`.** Open a PR even for small things. A reviewer looking at "+40 −385" asks the obvious question immediately.
- **If a merge conflicts, resolve it hunk by hunk.** Taking one whole side (`--ours`, `--theirs`, or pasting your file over the merged one) is how both incidents happened.

## 5. Add a changelog entry

Before opening the PR: add a line to [`CHANGELOG.md`](../CHANGELOG.md) under `[Unreleased]`, in the right section (`Added`/`Changed`/`Fixed`/`Removed`) — what you changed, one or two lines. This isn't optional — a GitHub Action checks every PR into `main` and fails it if `CHANGELOG.md` wasn't touched.

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
