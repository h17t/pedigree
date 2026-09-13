/**
 * Encoding detection for GEDCOM files: BOMs, the UTF-16 null-byte pattern, then the declared
 * CHAR tag checked against the bytes. Windows-1252 covers the common "ANSI" declaration of
 * German desktop software; UTF-8 that fails validation falls back to Windows-1252.
 */
import { decodeAnsel } from './ansel';

export type Encoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'ansel' | 'windows-1252' | 'ascii';

export interface DecodeResult {
  text: string;
  declared: string | null;
  detected: Encoding;
  /** True when the declared encoding did not match the bytes. */
  mismatch: boolean;
}

function declaredCharset(bytes: Uint8Array): string | null {
  // The header is ASCII-compatible in every supported encoding except UTF-16; scan the first 4 KB.
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const m = head.match(/^\s*1\s+CHAR\s+([A-Za-z0-9_-]+)/m);
  return m ? m[1]!.toUpperCase() : null;
}

function utf8Valid(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function decodeGedcom(bytes: Uint8Array): DecodeResult {
  // BOMs
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const text = new TextDecoder('utf-8').decode(bytes.subarray(3));
    const declared = declaredCharset(bytes.subarray(3));
    return { text, declared, detected: 'utf-8', mismatch: declared !== null && declared !== 'UTF-8' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), declared: 'UNICODE', detected: 'utf-16le', mismatch: false };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), declared: 'UNICODE', detected: 'utf-16be', mismatch: false };
  // UTF-16 without BOM: every other byte is zero in an ASCII-heavy header.
  if (bytes.length > 4 && bytes[1] === 0 && bytes[3] === 0) return { text: new TextDecoder('utf-16le').decode(bytes), declared: 'UNICODE', detected: 'utf-16le', mismatch: false };
  if (bytes.length > 4 && bytes[0] === 0 && bytes[2] === 0) return { text: new TextDecoder('utf-16be').decode(bytes), declared: 'UNICODE', detected: 'utf-16be', mismatch: false };

  const declared = declaredCharset(bytes);
  const hasHighBytes = bytes.some((b) => b >= 0x80);
  if (declared === 'ANSEL') {
    return { text: decodeAnsel(bytes), declared, detected: 'ansel', mismatch: false };
  }
  if (declared === 'UTF-8' || declared === 'UTF8' || declared === null) {
    if (!hasHighBytes) return { text: new TextDecoder('utf-8').decode(bytes), declared, detected: declared ? 'utf-8' : 'ascii', mismatch: false };
    if (utf8Valid(bytes)) return { text: new TextDecoder('utf-8').decode(bytes), declared, detected: 'utf-8', mismatch: false };
    return { text: new TextDecoder('windows-1252').decode(bytes), declared, detected: 'windows-1252', mismatch: declared !== null };
  }
  if (declared === 'ASCII' || declared === 'ANSI' || declared === 'IBMPC' || declared === 'MSDOS' || declared === 'IBM_WINDOWS' || declared === 'WINDOWS-1252' || declared === 'CP1252') {
    if (hasHighBytes && utf8Valid(bytes) && declared !== 'ANSI') {
      // Declared single-byte but the bytes are valid UTF-8 with multi-byte sequences: trust the bytes.
      return { text: new TextDecoder('utf-8').decode(bytes), declared, detected: 'utf-8', mismatch: true };
    }
    return { text: new TextDecoder('windows-1252').decode(bytes), declared, detected: hasHighBytes ? 'windows-1252' : 'ascii', mismatch: false };
  }
  // Unknown declaration: best effort.
  if (utf8Valid(bytes)) return { text: new TextDecoder('utf-8').decode(bytes), declared, detected: 'utf-8', mismatch: true };
  return { text: new TextDecoder('windows-1252').decode(bytes), declared, detected: 'windows-1252', mismatch: true };
}
