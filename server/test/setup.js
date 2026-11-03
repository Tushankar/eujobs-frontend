// Loaded with --import before any test file: test database, captured mail and the /_test routes (§2.13).
process.env.NODE_ENV = 'test'

// §2.9: API tests never call OpenAI.
const { setAiClient } = await import('../lib/ai.js')
const { aiStub } = await import('./helpers/ai.js')
setAiClient(aiStub)
