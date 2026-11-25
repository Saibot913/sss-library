import { authStorageInit, configureAuthSession } from '@seontechnologies/playwright-utils/auth-session'
// Registers the provider as a side effect; see tests/support/auth-fixture.ts
import './auth-fixture'

async function globalSetup() {
  // playwright-utils deviation: passing storageDir to configureAuthSession()
  // has no effect on where authStorageInit() actually writes (it always uses
  // process.cwd()/.auth regardless of what runs first) - so this accepts
  // that default rather than configuring a path that gets ignored.
  authStorageInit()
  configureAuthSession({})
  // Not calling authGlobalInit() here: sessions are minted on demand per spec
  // (see mint-session.ts and auth-fixture.ts), not eagerly for every run.
}

export default globalSetup
