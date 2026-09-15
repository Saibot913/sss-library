# Future features (not in V1 scope)

Source of truth for anything decided *against* building right now, but worth keeping around instead of deleting outright. Each entry has the reasoning plus the actual code, so bringing it back later is a copy-paste, not a rebuild. This file is currently untracked/local-only (not pushed to the team repo) — nothing in the checklist below references it directly for that reason.

---

## Staff review curation (per-book reviews on the site)

**Status:** idea only — nothing built, not even a stub. Recorded here so it isn't lost, per the same "not now, not gone" treatment as everything else in this file.

**The idea:** the Reviews & Feedback form (`src/lib/reviews.ts`) that exists today just collects raw submissions into a Google Sheet — nothing from it appears on the site. This future version closes that loop: a staff-only page (same access pattern as the "Add a Book" idea in `ME/spec.md` — gated via `is_staff()`/the `staff` table, hidden from regular patrons) where a staff member reads incoming reviews, and for any they want to feature, links it to a specific book. Once linked, it shows up on that book's page.

**What that actually requires, when it's picked up:**
- A real `reviews` table (`book_code` FK → `books`, review text, reviewer name, `approved_at`/similar) — the "one-to-many" relationship from the original brainstorm, this time for real.
- The staff curation page: list of pending submissions (pulled from wherever they land — could mean querying the Google Form's responses via the Sheets API, or staff just copy-pasting from the spreadsheet into a form on this page — cheaper to build, worth deciding at the time) → a "link to book" step (search/select a `book_code`) → insert into `reviews`.
- Display: the book detail page (wherever that is in `App.tsx`) renders any linked reviews.
- RLS: public `select` on `reviews` (once approved), `insert` restricted to staff — same shape as everything else staff-gated so far.

**Why deferred:** the simple Google Form version answers "can people leave feedback" today with near-zero build cost. This version is a real feature (new table, new staff UI, a curation workflow) — worth doing once the simple version is live and there's an actual backlog of reviews worth curating, not before.

---

## Book donations

**Status:** removed from V1 entirely — no trace of it in the live app (`App.tsx`) or `src/lib/` as of 2026-08-07.

**Why deferred:** decided to cut scope for V1 rather than half-build it. Donations was one of the "content features" in the original stub layer with a fully-specified schema, but wasn't a priority against everything else on the list.

**To bring it back:**
1. Restore `src/lib/donations.ts` from the code block below.
2. Add the `book_donations` table + RLS via a new migration (schema is in the file below).
3. Re-add the § Book Donations section to `AboutPage` in `App.tsx` using the JSX below (it sat between Book Clubs and Volunteers, as `§ 02`).
4. Restore `donationForm`/`donationSent` state at the top of `AboutPage`.
5. Wire the form's `onSubmit` to `submitBookDonation()` instead of just flipping local state.
6. Add the checklist item back to `project-instructions/README.md`.

### `src/lib/donations.ts` (as it existed before removal)

```ts
export type BookDonation = {
  name: string
  title: string
  author: string
  condition: string
}

// TODO(team): same situation as volunteers.ts — the donation notice
// form in AboutPage (App.tsx ~line 1130) just sets local state and
// discards the submission. Needs a `book_donations` table:
//
//   create table book_donations (
//     id uuid primary key default gen_random_uuid(),
//     name text not null,
//     title text not null,
//     author text,
//     condition text not null,
//     created_at timestamptz default now()
//   );
//
// Same RLS shape as volunteer_applications: open `insert` for `anon`,
// no `select` policy until there's an admin role — read submissions
// from the Supabase Table Editor for now.
export async function submitBookDonation(_donation: BookDonation): Promise<void> {
  throw new Error('submitBookDonation() is not implemented yet — see TODO in src/lib/donations.ts')
}
```

### `AboutPage` section (removed from `App.tsx`)

```tsx
{/* ── § 02 Book Donations ── */}
<section style={{ background: '#FAF3E4', padding: '56px 64px 48px', borderTop: '1px solid #D4B896' }}>
  {sectionHead('§ 02', 'Book Donations')}

  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56 }}>
    {/* Left — appeal */}
    <div>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic', color: '#2C1810', lineHeight: 1.45, marginBottom: 20 }}>
        "Every book donated is a door opened for someone who might not yet know what's waiting behind it."
      </p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#5C3D2E', lineHeight: 1.75, marginBottom: 16 }}>
        Sai Library gratefully accepts donations of books in good condition. Whether it's a novel you've treasured, a reference work you've finished with, or a collection being passed on — your contribution directly enriches our community's reading life.
      </p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#5C3D2E', lineHeight: 1.75, marginBottom: 24 }}>
        Donated books are added to our circulating collection, offered through our annual book sale, or shared with partner schools and literacy programmes.
      </p>
      <div style={{ padding: '20px 24px', background: '#F4E9D0', borderLeft: '3px solid #C8521A' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>We accept</p>
        {['Fiction and non-fiction in any genre', 'Books published within the last 20 years (older accepted case by case)', 'Clean pages — no heavy underlining or water damage', 'Children\'s and young adult titles always needed', 'Spiritual, devotional, and philosophical works'].map(item => (
          <div key={item} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
            <span style={{ color: '#C8521A', fontSize: 12, flexShrink: 0, marginTop: 1 }}>—</span>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E', lineHeight: 1.5 }}>{item}</p>
          </div>
        ))}
      </div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A', marginTop: 16 }}>
        Drop off at the main desk during opening hours, or contact us to arrange a larger collection pickup.
      </p>
    </div>

    {/* Right — notify form */}
    <div>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#C8521A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>Let us know you're coming</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#9B7B6A', lineHeight: 1.6 }}>Fill in what you're bringing and we'll have the right team member ready to receive your donation.</p>
      </div>

      {donationSent ? (
        <div style={{ padding: '28px', background: 'rgba(76,175,80,0.08)', border: '1px solid #4CAF50', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#2C7A2C', marginBottom: 6 }}>Thank you!</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5C3D2E' }}>We've received your donation notice. See you soon at the library.</p>
        </div>
      ) : (
        <form onSubmit={e => { e.preventDefault(); setDonationSent(true) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Your Name', key: 'name' as const, placeholder: 'Full name' },
            { label: 'Book Title(s)', key: 'title' as const, placeholder: 'e.g. Loving God, Anna Karenina…' },
            { label: 'Author(s)', key: 'author' as const, placeholder: 'e.g. Prof. Kasturi, Tolstoy…' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input type="text" placeholder={f.placeholder} value={donationForm[f.key]} onChange={e => setDonationForm(d => ({ ...d, [f.key]: e.target.value }))} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', boxSizing: 'border-box' }} onFocus={e => (e.target.style.borderColor = '#C8521A')} onBlur={e => (e.target.style.borderColor = '#D4B896')} />
            </div>
          ))}
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9B7B6A', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Book Condition</label>
            <select value={donationForm.condition} onChange={e => setDonationForm(d => ({ ...d, condition: e.target.value }))} style={{ width: '100%', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2C1810', background: '#F4E9D0', border: '1px solid #D4B896', outline: 'none', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
              {['Like New', 'Good', 'Fair', 'Worn but readable'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <button type="submit" style={{ marginTop: 6, padding: '12px', background: '#C8521A', color: '#FAF3E4', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
            Submit Donation Notice
          </button>
        </form>
      )}
    </div>
  </div>
</section>
```

State that went with it (top of `AboutPage`):
```ts
const [donationForm, setDonationForm] = useState({ name: '', title: '', author: '', condition: 'Good' })
const [donationSent, setDonationSent] = useState(false)
```
