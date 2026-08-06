export type Patron = {
  id: string
  name: string
  cardId: string
}

// TODO(team): implement patron authentication — either Supabase Auth,
// or a custom `patrons` table keyed by library card number. LoginModal
// in App.tsx currently fakes a login purely in local component state;
// wire its onLogin callback to call signIn() here instead.
export async function signIn(_cardId: string, _name: string): Promise<Patron> {
  throw new Error('signIn() is not implemented yet — see TODO in src/lib/auth.ts')
}

export async function signOut(): Promise<void> {
  throw new Error('signOut() is not implemented yet — see TODO in src/lib/auth.ts')
}

export async function getCurrentPatron(): Promise<Patron | null> {
  throw new Error('getCurrentPatron() is not implemented yet — see TODO in src/lib/auth.ts')
}
