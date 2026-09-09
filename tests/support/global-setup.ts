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
  // Not calling authGlobalInit() here: manageAuthToken isn't implemented yet
  // (see the TODO in auth-fixture.ts), so eagerly fetching a token would just
  // fail every run. Tests that need authToken will surface that error when
  // they ask for it.
}

export default globalSetup
