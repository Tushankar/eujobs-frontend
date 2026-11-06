// Loaded with --import before any test file: test database, captured mail and the /_test routes (§2.13).
process.env.NODE_ENV = 'test'

// One run at a time on eujobs_test (test/lock.js): a test file started outside `npm test` stops while another run holds the lock.
const { activeLock, lockHolderMessage } = await import('./lock.js')
const holder = activeLock()
if (holder && String(holder.pid) !== process.env.EUJOBS_TEST_LOCK) {
  console.error(lockHolderMessage(holder))
  process.exit(3)
}

// §2.9: API tests never call OpenAI.
const { setAiClient } = await import('../lib/ai.js')
const { aiStub } = await import('./helpers/ai.js')
setAiClient(aiStub)

// API tests never call the ECB either: a fixed rate table.
const { setRatesSource } = await import('../lib/fxRates.js')
const { fxStub } = await import('./helpers/fx.js')
setRatesSource(fxStub)
