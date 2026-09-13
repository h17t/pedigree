/**
 * ANSEL (ANSI/NISO Z39.47) to Unicode. Combining diacritics (0xE0–0xFE) precede their base
 * letter in ANSEL; in Unicode they follow it, so they are buffered and emitted after the next
 * base character. The result is NFC-normalised.
 */
const SPACING: Record<number, string> = {
  0xa1: 'Ł', 0xa2: 'Ø', 0xa3: 'Đ', 0xa4: 'Þ', 0xa5: 'Æ', 0xa6: 'Œ', 0xa7: 'ʹ', 0xa8: '·', 0xa9: '♭', 0xaa: '®', 0xab: '±', 0xac: 'Ơ', 0xad: 'Ư', 0xae: 'ʼ',
  0xb0: 'ʻ', 0xb1: 'ł', 0xb2: 'ø', 0xb3: 'đ', 0xb4: 'þ', 0xb5: 'æ', 0xb6: 'œ', 0xb7: 'ʺ', 0xb8: 'ı', 0xb9: '£', 0xba: 'ð', 0xbc: 'ơ', 0xbd: 'ư',
  0xc0: '°', 0xc1: 'ℓ', 0xc2: '℗', 0xc3: '©', 0xc4: '♯', 0xc5: '¿', 0xc6: '¡', 0xc7: 'ß', 0xc8: '€', 0xcf: 'ß',
};
const COMBINING: Record<number, string> = {
  0xe0: '̉', 0xe1: '̀', 0xe2: '́', 0xe3: '̂', 0xe4: '̃', 0xe5: '̄', 0xe6: '̆', 0xe7: '̇', 0xe8: '̈',
  0xe9: '̌', 0xea: '̊', 0xeb: '︠', 0xec: '︡', 0xed: '̕', 0xee: '̋', 0xef: '̐', 0xf0: '̧', 0xf1: '̨',
  0xf2: '̣', 0xf3: '̤', 0xf4: '̥', 0xf5: '̳', 0xf6: '̲', 0xf7: '̦', 0xf8: '̜', 0xf9: '̮', 0xfa: '︢', 0xfb: '︣', 0xfe: '̓',
};

export function decodeAnsel(bytes: Uint8Array): string {
  let out = '';
  let pending = '';
  for (const b of bytes) {
    if (b < 0x80) {
      out += String.fromCharCode(b) + pending;
      pending = '';
    } else if (COMBINING[b]) {
      pending += COMBINING[b];
    } else if (SPACING[b]) {
      out += SPACING[b] + pending;
      pending = '';
    } else {
      out += '�' + pending;
      pending = '';
    }
  }
  return (out + pending).normalize('NFC');
}

/** Encode a string to ANSEL is not needed: exports are always UTF-8. */
