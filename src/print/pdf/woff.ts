/**
 * WOFF → TrueType. A PDF can embed a TrueType file but not a WOFF or WOFF2 one, and the app
 * ships only web fonts. WOFF is the simple container: the original sfnt tables, each on its own
 * zlib-deflated (or stored verbatim when compression did not pay). Undoing that gives back the
 * exact TrueType file the font was built from, which is what `FontFile2` wants.
 *
 * WOFF2 is not handled: its glyph table is transformed, not merely compressed, so it would need
 * a Brotli decoder and a glyf rebuilder. The .woff of every chunk is shipped for this reason.
 */

const SIGNATURE = 0x774f4646; // 'wOFF'

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  // 'deflate' is the zlib wrapper WOFF uses ('deflate-raw' would be the bare stream).
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  void writer.write(new Uint8Array(bytes)).then(() => writer.close());
  const reader = ds.readable.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Largest power of two ≤ n, and its log; the sfnt header states both. */
function searchParams(numTables: number): { searchRange: number; entrySelector: number; rangeShift: number } {
  let entrySelector = 0;
  while (1 << (entrySelector + 1) <= numTables) entrySelector += 1;
  const searchRange = (1 << entrySelector) * 16;
  return { searchRange, entrySelector, rangeShift: numTables * 16 - searchRange };
}

/**
 * Rebuild the TrueType file a WOFF was made from. Throws when the input is not a WOFF
 * (a WOFF2, say), so the caller can fall back rather than embed nonsense.
 */
export async function woffToTrueType(woff: ArrayBuffer): Promise<Uint8Array> {
  const view = new DataView(woff);
  if (view.byteLength < 44 || view.getUint32(0) !== SIGNATURE) throw new Error('not a WOFF file');
  const flavor = view.getUint32(4);
  const numTables = view.getUint16(12);
  const entries: { tag: number; checksum: number; data: Uint8Array }[] = [];
  for (let i = 0; i < numTables; i++) {
    const at = 44 + i * 20;
    const tag = view.getUint32(at);
    const offset = view.getUint32(at + 4);
    const compLength = view.getUint32(at + 8);
    const origLength = view.getUint32(at + 12);
    const checksum = view.getUint32(at + 16);
    const raw = new Uint8Array(woff, offset, compLength);
    // Equal lengths mean the table was stored as it is; anything else is zlib.
    const data = compLength === origLength ? raw.slice() : await inflate(raw);
    if (data.length !== origLength) throw new Error(`table ${tag.toString(16)} has the wrong length`);
    entries.push({ tag, checksum, data });
  }
  entries.sort((a, b) => a.tag - b.tag);

  const pad = (n: number) => (n + 3) & ~3;
  const headerSize = 12 + entries.length * 16;
  const total = entries.reduce((sum, e) => sum + pad(e.data.length), headerSize);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  const { searchRange, entrySelector, rangeShift } = searchParams(entries.length);
  dv.setUint32(0, flavor);
  dv.setUint16(4, entries.length);
  dv.setUint16(6, searchRange);
  dv.setUint16(8, entrySelector);
  dv.setUint16(10, rangeShift);
  let offset = headerSize;
  entries.forEach((e, i) => {
    const at = 12 + i * 16;
    dv.setUint32(at, e.tag);
    dv.setUint32(at + 4, e.checksum);
    dv.setUint32(at + 8, offset);
    dv.setUint32(at + 12, e.data.length);
    out.set(e.data, offset);
    offset += pad(e.data.length);
  });
  return out;
}
