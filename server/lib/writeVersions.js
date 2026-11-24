/*
 * Write counters per model (perf 2026-11-24). In-process caches (the visible companies, the legal versions, the public
 * landing data) keep the counters of the models they read and read again once one moved. Every Mongoose write of a
 * tracked schema counts: save, query updates and deletes, document deleteOne/updateOne, insertMany and bulkWrite.
 * Native `Model.collection` writes and other processes (seed scripts) do not, so each cache also has a short TTL.
 */
const counters = new Map()
const QUERY_WRITES = ['updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace']

/** Counts the writes of `schema` under `name` (call before mongoose.model compiles it). */
export function trackWrites(schema, name) {
  const bump = () => {
    counters.set(name, (counters.get(name) ?? 0) + 1)
  }
  schema.post('save', bump)
  schema.post(QUERY_WRITES, { query: true, document: false }, bump)
  schema.post(['updateOne', 'deleteOne'], { document: true, query: false }, bump)
  schema.post(['insertMany', 'bulkWrite'], bump)
}

/** The current counters of these models as one comparable key; read it before the data it guards. */
export const writeVersion = (...names) => names.map((name) => counters.get(name) ?? 0).join('.')

/**
 * A value cached per `key` while none of `models` was written and for at most `ttlMs`. `load(key)` reads it again;
 * concurrent callers share one load, a load that overlaps a write is kept under the older counters (so the next call
 * reads again) and a failed load is forgotten. Callers must not mutate the shared value.
 */
export function versionedCache({ models, ttlMs }) {
  const entries = new Map()
  return {
    get(key, load) {
      const version = writeVersion(...models)
      const entry = entries.get(key)
      if (entry && entry.version === version && entry.at > Date.now() - ttlMs) return entry.value
      const value = load(key)
      entries.set(key, { value, version, at: Date.now() })
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key)
      })
      return value
    },
    clear: () => entries.clear(),
  }
}
