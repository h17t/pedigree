import { describe, expect, it } from 'vitest';
import { cjkFamiliesIn, fontStack, hasCjk } from '@/design/cjkFonts';
import { joinName, setSurnameFirst } from '@/model/nameOrder';
import { personName } from '@/model/types';
import { estimateWidth } from '@/render/text';
import { cjkChunksFor, chunksFor } from '@/print/fonts';
import type { CjkChunkTable } from '@/print/fonts';

describe('East Asian names and fonts', () => {
  it('joins names in the active order and without a space when both parts are CJK', () => {
    setSurnameFirst(false);
    expect(joinName('Karl', 'Weber')).toBe('Karl Weber');
    expect(joinName('太郎', '山田')).toBe('太郎山田');
    setSurnameFirst(true);
    expect(joinName('Karl', 'Weber')).toBe('Weber Karl');
    expect(joinName('太郎', '山田')).toBe('山田太郎');
    expect(joinName('민준', '김')).toBe('김민준');
    expect(joinName('Karl', '山田')).toBe('山田 Karl');
    expect(personName({ givenNames: '太郎', surname: '山田', titlePrefix: 'Dr.' })).toBe('Dr. 山田太郎');
    setSurnameFirst(false);
  });

  it('detects which East Asian families a text needs', () => {
    expect(cjkFamiliesIn('Karl Weber')).toEqual([]);
    expect(cjkFamiliesIn('김민준')).toEqual(['kr']);
    expect(cjkFamiliesIn('やまだ 山田')).toEqual(['jp']);
    expect(cjkFamiliesIn('山田', 'jp')).toEqual(['jp']);
    expect(cjkFamiliesIn('王小明')).toEqual(['sc']);
    expect(hasCjk('Ölçek')).toBe(false);
    expect(fontStack('kr')).toMatch(/^"Atkinson Hyperlegible Next", "Noto Sans KR", "Noto Sans JP", "Noto Sans SC"/);
  });

  it('estimates full-width glyphs as one em and Cyrillic a little wider than Latin', () => {
    const latin = estimateWidth('abcd', 16, 400);
    expect(estimateWidth('山田太郎', 16, 400)).toBe(64);
    expect(estimateWidth('김민준', 16, 400)).toBe(48);
    expect(estimateWidth('абвг', 16, 400)).toBeGreaterThan(latin);
  });

  it('picks only the Noto chunks whose ranges the text uses, and only for the families asked for', () => {
    const table: CjkChunkTable = {
      jp: { family: 'Noto Sans JP', chunks: [
        { weight: 400, file: 'fonts/cjk/a.woff2', unicodeRange: 'U+3041-3096' },
        { weight: 400, file: 'fonts/cjk/b.woff2', unicodeRange: 'U+5c71' },
        { weight: 700, file: 'fonts/cjk/b7.woff2', unicodeRange: 'U+5c71' },
        { weight: 400, file: 'fonts/cjk/c.woff2', unicodeRange: 'U+9000-9fff' },
      ] },
      kr: { family: 'Noto Sans KR', chunks: [{ weight: 400, file: 'fonts/cjk/k.woff2', unicodeRange: 'U+ac00-d7af' }] },
    };
    const chunks = cjkChunksFor('山だ', [400, 500, 700], ['jp'], table);
    expect(chunks.map((c) => c.file)).toEqual(['fonts/cjk/a.woff2', 'fonts/cjk/b.woff2', 'fonts/cjk/b7.woff2']);
    expect(chunks[0]!.family).toBe('Noto Sans JP');
    expect(cjkChunksFor('김', [400], ['jp'], table)).toEqual([]);
    // Latin text still resolves to the Atkinson chunks only.
    expect(chunksFor('Karl', [400]).map((c) => c.range)).toEqual(['latin']);
    expect(chunksFor('Иван', [400]).map((c) => c.range)).toEqual(['cyrillic']);
  });
});
