import { createHash } from 'node:crypto'

/*
 * The OpenAI stub every API test uses (§2.9: tests never call OpenAI); test/setup.js installs it. Embeddings hash each
 * word into a few dimensions, so texts sharing words are closer. Answers fill the requested JSON schema with
 * "stub" texts unless a test sets `aiStub.reply(request)`. `calls` records every request.
 */
const DIMS = 16

function wordVector(text) {
  const vector = Array.from({ length: DIMS }, () => 0)
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    vector[createHash('sha256').update(word).digest()[0] % DIMS] += 1
  }
  return vector
}

function fill(schema) {
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties).map(([name, value]) => [name, fill(value)]))
  if (schema.type === 'array') return [fill(schema.items)]
  if (schema.type === 'integer' || schema.type === 'number') return 0
  if (schema.type === 'boolean') return false
  return schema.enum?.[0] ?? 'stub'
}

export const aiStub = {
  // Never the real model names, so nothing the stub writes to eujobs_test is reused by the e2e server.
  models: { fast: 'stub-fast', main: 'stub-main', embedding: 'stub-embedding', transcribe: 'stub-transcribe' },
  calls: [],
  reply: null,
  // Models whose transcription fails (the whisper-1 fallback test).
  failingTranscribeModels: [],
  reset() {
    this.calls.length = 0
    this.reply = null
    this.failingTranscribeModels = []
  },
  audio: {
    transcriptions: {
      async create({ model, file }) {
        file.destroy()
        aiStub.calls.push({ kind: 'transcription', model })
        if (aiStub.failingTranscribeModels.includes(model)) throw new Error('stub transcription failure')
        return { text: `stub transcript (${model})` }
      },
    },
  },
  embeddings: {
    async create({ model, input }) {
      aiStub.calls.push({ kind: 'embedding', model, input })
      return { data: input.map((text, index) => ({ index, embedding: wordVector(text) })) }
    },
  },
  responses: {
    async create(request) {
      aiStub.calls.push({ kind: 'response', ...request })
      const output = aiStub.reply ? aiStub.reply(request) : fill(request.text.format.schema)
      return { output_text: JSON.stringify(output) }
    },
  },
}
