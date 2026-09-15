/**
 * A small PDF writer: objects, pages, Flate-compressed content streams, and TrueType fonts
 * embedded as composite (Type0 / Identity-H) fonts so that any character the tree uses can be
 * written, not only the 255 of a simple encoding. Text stays real text — selectable, searchable
 * and copyable — because every string also carries a ToUnicode map back to its characters.
 *
 * Only what the print sheets need is implemented. See `svg.ts` for the drawing side.
 */
import type { FontMetrics } from './sfnt';

/** 72 pt to the inch, 25.4 mm to the inch. */
export const MM_TO_PT = 72 / 25.4;

export interface PdfPattern {
  /** Name used in the page's resources and in `/Pattern cs /<name> scn`. */
  name: string;
  bbox: [number, number, number, number];
  xStep: number;
  yStep: number;
  /** Pattern space → default user space (the page is flipped, patterns are not). */
  matrix: [number, number, number, number, number, number];
  content: string;
}

export interface PdfPage {
  widthPt: number;
  heightPt: number;
  content: string;
  /** Font keys the content stream refers to as /F<key>. */
  fonts: string[];
  patterns: PdfPattern[];
}

/** A font the document embeds, with the glyphs the text actually used. */
export interface EmbeddedFont {
  key: string;
  metrics: FontMetrics;
  /** Glyph id → the code point it was written for, for the ToUnicode map. */
  used: Map<number, number>;
}

const latin1 = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  void writer.write(new Uint8Array(bytes)).then(() => writer.close());
  const reader = cs.readable.getReader();
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
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Text of a PDF string: escape the three characters that would end it early. */
export const pdfString = (s: string) => `(${s.replace(/[\\()]/g, (c) => `\\${c}`)})`;

/** Collects numbered objects and lays them out with a cross-reference table. */
class Objects {
  private readonly bodies: (Uint8Array | null)[] = [];

  /** Reserves a number so objects can refer to each other before they are written. */
  reserve(): number {
    this.bodies.push(null);
    return this.bodies.length;
  }

  put(id: number, body: Uint8Array | string): number {
    this.bodies[id - 1] = typeof body === 'string' ? latin1(body) : body;
    return id;
  }

  add(body: Uint8Array | string): number {
    return this.put(this.reserve(), body);
  }

  /** The whole file: header, bodies, xref, trailer. */
  render(rootId: number, infoId: number): Uint8Array {
    const parts: Uint8Array[] = [];
    let length = 0;
    const push = (b: Uint8Array | string) => {
      const bytes = typeof b === 'string' ? latin1(b) : b;
      parts.push(bytes);
      length += bytes.length;
    };
    // A binary comment in the header tells tools the file is not plain text.
    push('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
    const offsets: number[] = [];
    this.bodies.forEach((body, i) => {
      offsets.push(length);
      push(`${i + 1} 0 obj\n`);
      push(body ?? latin1('null'));
      push('\nendobj\n');
    });
    const xref = length;
    push(`xref\n0 ${this.bodies.length + 1}\n0000000000 65535 f \n`);
    for (const o of offsets) push(`${String(o).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size ${this.bodies.length + 1} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const out = new Uint8Array(length);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }
}

async function stream(objects: Objects, id: number, data: Uint8Array, extra = ''): Promise<void> {
  const body = await deflate(data);
  const head = latin1(`<< /Length ${body.length} /Filter /FlateDecode${extra} >>\nstream\n`);
  const tail = latin1('\nendstream');
  const out = new Uint8Array(head.length + body.length + tail.length);
  out.set(head, 0);
  out.set(body, head.length);
  out.set(tail, head.length + body.length);
  objects.put(id, out);
}

/** The ToUnicode CMap that makes the text copyable: glyph id → the character it stands for. */
function toUnicodeCMap(used: Map<number, number>): string {
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
  const pairs = [...used.entries()].sort((a, b) => a[0] - b[0]);
  const lines: string[] = [];
  for (let i = 0; i < pairs.length; i += 100) {
    const batch = pairs.slice(i, i + 100);
    lines.push(`${batch.length} beginbfchar`);
    // Beyond the BMP a character needs its UTF-16 surrogate pair.
    for (const [glyph, cp] of batch) {
      const utf16 = cp > 0xffff ? hex(0xd800 + ((cp - 0x10000) >> 10)) + hex(0xdc00 + ((cp - 0x10000) & 0x3ff)) : hex(cp);
      lines.push(`<${hex(glyph)}> <${utf16}>`);
    }
    lines.push('endbfchar');
  }
  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CMapName /Pedigree-UTF16 def',
    '/CMapType 2 def',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    ...lines,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
}

/** `/W` array: the advance of every glyph used, in the PDF's 1000-unit text space. */
function widthsArray(font: EmbeddedFont): string {
  const scale = 1000 / font.metrics.unitsPerEm;
  const glyphs = [...font.used.keys()].sort((a, b) => a - b);
  const runs: string[] = [];
  let i = 0;
  while (i < glyphs.length) {
    const start = glyphs[i]!;
    const widths = [Math.round(font.metrics.advance(start) * scale)];
    let j = i + 1;
    while (j < glyphs.length && glyphs[j] === glyphs[j - 1]! + 1) {
      widths.push(Math.round(font.metrics.advance(glyphs[j]!) * scale));
      j += 1;
    }
    runs.push(`${start} [${widths.join(' ')}]`);
    i = j;
  }
  return `[${runs.join(' ')}]`;
}

async function embedFont(objects: Objects, font: EmbeddedFont): Promise<number> {
  const m = font.metrics;
  const scale = 1000 / m.unitsPerEm;
  const round = (n: number) => Math.round(n * scale);
  const fileId = objects.reserve();
  await stream(objects, fileId, m.data, ` /Length1 ${m.data.length}`);
  const descriptorId = objects.add(
    `<< /Type /FontDescriptor /FontName /${font.key} /Flags 32 /FontBBox [${m.bbox.map(round).join(' ')}] /ItalicAngle ${m.italicAngle} /Ascent ${round(m.ascent)} /Descent ${round(m.descent)} /CapHeight ${round(m.capHeight)} /StemV 80 /FontFile2 ${fileId} 0 R >>`,
  );
  const cidId = objects.add(
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${font.key} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptorId} 0 R /DW ${round(m.advance(0))} /W ${widthsArray(font)} /CIDToGIDMap /Identity >>`,
  );
  const unicodeId = objects.reserve();
  await stream(objects, unicodeId, latin1(toUnicodeCMap(font.used)));
  return objects.add(`<< /Type /Font /Subtype /Type0 /BaseFont /${font.key} /Encoding /Identity-H /DescendantFonts [${cidId} 0 R] /ToUnicode ${unicodeId} 0 R >>`);
}

export interface PdfDocOptions {
  title: string;
  /** Producer line; no personal data ever goes into the file. */
  creator: string;
}

/** Assembles the finished file. Pages are drawn in the order given, one page per sheet. */
export async function buildPdf(pages: PdfPage[], fonts: EmbeddedFont[], o: PdfDocOptions): Promise<Uint8Array> {
  const objects = new Objects();
  const catalogId = objects.reserve();
  const pagesId = objects.reserve();
  const fontIds = new Map<string, number>();
  for (const f of fonts) if (f.used.size > 0) fontIds.set(f.key, await embedFont(objects, f));

  const pageIds: number[] = [];
  for (const page of pages) {
    const contentId = objects.reserve();
    await stream(objects, contentId, latin1(page.content));
    const patternIds = new Map<string, number>();
    for (const p of page.patterns) {
      const id = objects.reserve();
      await stream(
        objects,
        id,
        latin1(p.content),
        ` /Type /Pattern /PatternType 1 /PaintType 1 /TilingType 1 /BBox [${p.bbox.join(' ')}] /XStep ${p.xStep} /YStep ${p.yStep} /Matrix [${p.matrix.join(' ')}] /Resources << >>`,
      );
      patternIds.set(p.name, id);
    }
    const fontRes = page.fonts
      .filter((k) => fontIds.has(k))
      .map((k) => `/F${k} ${fontIds.get(k)!} 0 R`)
      .join(' ');
    const patternRes = [...patternIds].map(([name, id]) => `/${name} ${id} 0 R`).join(' ');
    const resources = `<< /ProcSet [/PDF /Text] ${fontRes ? `/Font << ${fontRes} >>` : ''} ${patternRes ? `/Pattern << ${patternRes} >>` : ''} >>`;
    pageIds.push(objects.add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${page.widthPt.toFixed(2)} ${page.heightPt.toFixed(2)}] /Resources ${resources} /Contents ${contentId} 0 R >>`));
  }

  objects.put(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  objects.put(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const infoId = objects.add(`<< /Title ${pdfString(o.title)} /Producer ${pdfString(o.creator)} /Creator ${pdfString(o.creator)} >>`);
  return objects.render(catalogId, infoId);
}
