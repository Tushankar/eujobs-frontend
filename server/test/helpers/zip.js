import { inflateRawSync } from 'node:zlib'

/* Reads a ZIP from its central directory (stored and deflated entries): { name: Buffer }. Used by the export tests and the e2e. */
export function readZip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (end < 0) throw new Error('not a ZIP file')
  const count = buffer.readUInt16LE(end + 10)
  let offset = buffer.readUInt32LE(end + 16)
  const entries = {}
  for (let index = 0; index < count; index += 1) {
    const method = buffer.readUInt16LE(offset + 10)
    const size = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const skip = nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32)
    const local = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    const data = buffer.subarray(start, start + size)
    entries[name] = method === 8 ? inflateRawSync(data) : data
    offset += 46 + skip
  }
  return entries
}

/** supertest parser that keeps a binary response as one Buffer. */
export function binary(res, callback) {
  const chunks = []
  res.on('data', (chunk) => chunks.push(chunk))
  res.on('end', () => callback(null, Buffer.concat(chunks)))
}
