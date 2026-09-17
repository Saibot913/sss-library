// One-time (idempotent) setup for the two accounts the e2e suite signs in
// as. Run manually, not on every test run - see tests/README.md.
//
//   node --experimental-strip-types tests/support/seed-test-accounts.ts
//
// Needs SUPABASE_SERVICE_ROLE_KEY, TEST_PATRON_EMAIL, TEST_STAFF_EMAIL in
// tests/.env (gitignored - never commit real values).
import { createAdminClient, testPatronEmail, testStaffEmail } from './supabase-admin.ts'

async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  // No admin.auth.admin.getUserByEmail() in this supabase-js version - list and filter.
  // The test project has few enough users that pagination isn't a concern here.
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw error
  return data.users.find(user => user.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function ensureUser(admin: ReturnType<typeof createAdminClient>, email: string) {
  const existing = await findUserByEmail(admin, email)
  if (existing) return existing

  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw error
  return data.user
}

async function seedPatron() {
  const admin = createAdminClient()
  const email = testPatronEmail()
  const user = await ensureUser(admin, email)

  // Checkout requires a complete profile (first/last/phone) - see
  // src/App.tsx's submitHoldRequests() and ProfilePage. Seeded once here so
  // individual specs don't need to fill this in themselves.
  const { error } = await admin
    .from('profiles')
    .upsert(
      { id: user.id, email: email.toLowerCase(), first_name: 'Playwright', last_name: 'Patron', phone: '555-0100' },
      { onConflict: 'id' },
    )
  if (error) throw error

  console.log(`Seeded test patron: ${email} (${user.id})`)
}

async function seedStaff() {
  const admin = createAdminClient()
  const email = testStaffEmail()
  const user = await ensureUser(admin, email)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert(
      { id: user.id, email: email.toLowerCase(), first_name: 'Playwright', last_name: 'Staff', phone: '555-0101' },
      { onConflict: 'id' },
    )
  if (profileError) throw profileError

  // staff is keyed by email, not user_id - see
  // supabase/migrations/0013_reconcile_staff_email_schema.sql.
  const { error: staffError } = await admin.from('staff').upsert({ email: email.toLowerCase() }, { onConflict: 'email' })
  if (staffError) throw staffError

  console.log(`Seeded test staff: ${email} (${user.id})`)
}

await seedPatron()
await seedStaff()
