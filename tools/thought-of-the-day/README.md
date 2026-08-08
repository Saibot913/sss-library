# Thought for the day — importer setup

The daily "Sai Inspires" thought is emailed out by Sri Sathya Sai Media Centre. [`Code.gs`](Code.gs) is a Google Apps Script that reads that email once a day, pulls the text out, and saves it to Supabase. The website then just reads a table — it never touches email or sssmediacentre.org.

```
Sai Inspires email  ->  Gmail inbox  ->  Apps Script (daily)  ->  Supabase table  ->  website
```

## Why it works this way

Two dead ends, both already tested, so nobody repeats them:

- **The website can't fetch the thought directly.** `sssmediacentre.org/sai-inspires` renders its content with JavaScript — the HTML a plain request gets back contains loading placeholders and no text. The `archive.sssmediacentre.org` subdomain has dated URLs that would have been ideal, but it serves an incomplete TLS certificate chain, so automated fetches fail verification.
- **The Google Group archive is private.** `groups.google.com/g/sai-inspires` returns "You don't have permission to access this content", and the old Groups RSS endpoints are gone.

The email is the only reliable source, and it arrives as real text rather than an image, so it can be parsed.

## What you need before starting

- The Gmail account that is **subscribed to the group** and receiving the daily email
- Access to the Supabase dashboard

## 1. Create the table

Run [`supabase/migrations/0003_thought_of_the_day.sql`](../../supabase/migrations/0003_thought_of_the_day.sql) against the project — paste it into the Supabase dashboard's **SQL Editor** and hit Run.

Confirm it worked: **Table Editor** should now list `thought_of_the_day`, empty.

The script never creates this table. It only adds rows to one that already exists, and errors out if it's missing.

## 2. Confirm the email address

Open a real Sai Inspires message in the inbox and look at the **To:** line. It should be `sai-inspires@sssmediacentre.org`.

If it differs, update `GROUP_ADDRESS` at the top of `Code.gs` — that string is the Gmail search filter, and the script finds nothing if it's wrong. Note the address is on their own domain, *not* `@googlegroups.com`.

While you're there, note **what time the email arrives**. You need it in step 6.

## 3. Get the write key — and it must be the *legacy* one

Supabase dashboard → **Settings → API Keys → Legacy API keys** → copy **`service_role`** (a long JWT starting `eyJ`).

**Do not use a new-style `sb_secret_…` key here. It cannot work.** Supabase rejects secret keys whenever the request's `User-Agent` looks like a browser, and Apps Script's is hardcoded to `Mozilla/5.0 (compatible; Google-Apps-Script; …)`. Apps Script also strips any `User-Agent` you try to set, so there is no way around it from inside the script. You get:

```
HTTP 401 {"message":"Forbidden use of secret API key in browser"}
```

That was verified directly: the same key succeeds with a `curl/8.0.1` User-Agent and fails with Apps Script's. Legacy JWT keys predate that check and have no such restriction.

Whichever you use, it is *not* the key in `.env`:

| | `publishable` / `anon` (in `.env`) | `service_role` |
|---|---|---|
| Used by | the website, in the browser | this script only |
| RLS policies | enforced | **bypassed entirely** |
| Safe to expose | yes, that's the point | **no — full admin access** |

The table has a read-only policy, so the publishable key *cannot* write to it. That's the whole reason the importer needs `service_role`.

Treat it like a database password: Script Properties and nowhere else. Never in this repo, never in `.env`, never anywhere under `src/`, never pasted into a chat or an issue. Anyone holding it can read and change every table from anywhere in the world.

### This needs revisiting before the end of 2026

Supabase [plans to deprecate legacy JWT keys by the end of 2026](https://supabase.com/docs/guides/getting-started/api-keys). When that lands, this script stops working and cannot be fixed by swapping in a secret key, because of the User-Agent problem above. Two ways out, neither urgent yet:

- **Put an Edge Function in front.** Apps Script calls the function with a shared secret; the function holds the secret key and does the write server-side, where no browser User-Agent is involved.
- **Move the job to GitHub Actions and read the mailbox over IMAP** with a Gmail app password. A CI runner sends an ordinary User-Agent, so `sb_secret_…` works there. This also puts the whole job in this repo instead of in one person's Google account — see the sync caveat near the end of this file.

## 4. Create the Apps Script project

**Sign in to [script.google.com](https://script.google.com) as the subscribed Gmail account**, not your personal one. The script can only read the mailbox it belongs to.

1. **New project**, and give it a name like `Sai Inspires importer`
2. Paste the whole of [`Code.gs`](Code.gs) over the default file contents
3. **Project Settings → Time zone →** set it to Pacific, so the trigger fires when you expect
4. **Project Settings → Script Properties → Add script property**, twice:

   | Property | Value |
   |---|---|
   | `SUPABASE_URL` | `https://<your-project>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key from step 3 |

## 5. Run it once by hand

Select `importTodaysThought` in the function dropdown and press **Run**.

Google will ask permission to read Gmail and make external requests, and will warn that the app is **unverified** — expected for a script you wrote yourself. Click *Advanced → Go to (project name)*.

Then check both ends:

- **Execution log** should show `Stored 2026-08-07: The process of education must...`
- **Supabase Table Editor** should show one row — open it and read the text, confirming it's the actual quote and not markup or an empty string

If it fails, the error names the stage: no email found, no paragraphs matched, empty passage, or Supabase rejecting the write (with Supabase's own explanation attached).

## 6. Add the daily trigger

**Triggers** (clock icon) → **Add Trigger**:

- Function: `importTodaysThought`
- Event source: Time-driven
- Type: Day timer
- Time of day: an hour or two **after** the email normally arrives

Observed arrival is around 1:30pm Pacific, so a 2–3pm slot catches it the same day.

## 7. Forward the failure emails

When a trigger throws, Google emails **the account the script belongs to** — an inbox nobody reads.

Set up a forwarding rule from that Gmail to a real person, or add them as a collaborator on the script. Every failure path in `Code.gs` throws on purpose so problems surface; that only helps if the alert reaches someone.

## Keeping this file and Apps Script in sync

Apps Script is edited in a browser, so the copy running in production can drift from the one in this repo. `Code.gs` here is the source of truth — **if you change it there, paste it back here and commit.** Otherwise the next person improves the wrong copy.

## When it breaks

It's parsing HTML out of somebody else's email template, so a redesign on their end will break it. That's expected, and the script is written to fail loudly rather than write blanks.

What it keys on, in order of how likely each is to change:

| Piece | Anchor |
|---|---|
| Date | the `sai-inspires.web.app/?date=YYYY-MM-DD` link |
| Intro + passage | `<p dir="ltr">` paragraphs; the intro is the one styled `#0070c0` |
| Attribution | `<p align="right"><strong>…</strong></p>` |
| Short quote | the `bgcolor="#074171"` cell |

To debug: forward yourself a copy, view its source, and check which anchor moved. The error message tells you which one failed.
