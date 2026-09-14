import { describe, expect, it } from 'vitest';
import { parseUserDate, formatPartialDate, formatDateWithQualifier, formatYearWithQualifier, ordinalOf, yearsBetween, toOrdinal, qualifierMark } from '@/model/dates';

const ok = (s: string, f: 'dayFirst' | 'monthFirst' = 'dayFirst') => {
  const r = parseUserDate(s, f);
  if (!r.ok) throw new Error(`expected ${s} to parse`);
  return r;
};

describe('parseUserDate – German and English keyword sets', () => {
  it.each([
    ['1923', '1923', 'exact'],
    ['03.1923', '1923-03', 'exact'],
    ['14.03.1923', '1923-03-14', 'exact'],
    ['~1923', '1923', 'about'],
    ['vor 1923', '1923', 'before'],
    ['nach 1923', '1923', 'after'],
    ['um 1923', '1923', 'about'],
    ['03/1923', '1923-03', 'exact'],
    ['14 Mar 1923', '1923-03-14', 'exact'],
    ['about 1923', '1923', 'about'],
    ['before 1923', '1923', 'before'],
    ['after 1923', '1923', 'after'],
    ['circa 1923', '1923', 'about'],
    ['est 1923', '1923', 'estimated'],
    ['geschätzt 1923', '1923', 'estimated'],
    ['<1923', '1923', 'before'],
    ['> 1923', '1923', 'after'],
    ['14. März 1923', '1923-03-14', 'exact'],
    ['März 1923', '1923-03', 'exact'],
    ['March 14, 1923', '1923-03-14', 'exact'],
    ['1923-03-14', '1923-03-14', 'exact'],
    ['1923-03', '1923-03', 'exact'],
    ['abt 1850', '1850', 'about'],
    ['ca. 1850', '1850', 'about'],
  ])('%s → %s (%s)', (input, date, qualifier) => {
    const r = ok(input);
    expect(r.value).toEqual({ date, qualifier, dateEnd: null });
  });

  it.each([
    ['between 1920 and 1925', '1920', '1925', 'between'],
    ['zwischen 1920 und 1925', '1920', '1925', 'between'],
    ['bet 1920 and 1925', '1920', '1925', 'between'],
    ['1920–1925', '1920', '1925', 'between'],
    ['1920 - 1925', '1920', '1925', 'between'],
    ['1920-1925', '1920', '1925', 'between'],
    ['from 1905 to 1962', '1905', '1962', 'from'],
    ['von 03.1905 bis 14.03.1962', '1905-03', '1962-03-14', 'from'],
  ])('%s → %s..%s (%s)', (input, date, dateEnd, qualifier) => {
    expect(ok(input).value).toEqual({ date, qualifier, dateEnd });
  });

  it('rejects a range whose end lies before its start', () => {
    expect(parseUserDate('between 1925 and 1920', 'dayFirst').ok).toBe(false);
    expect(parseUserDate('from 1962 to 1905', 'dayFirst').ok).toBe(false);
  });

  it('rejects impossible dates and nonsense', () => {
    for (const s of ['', 'hello', '31.02.1923', '13/13/1923', '0', 'März', '14 Foo 1923']) {
      expect(parseUserDate(s, 'dayFirst').ok, s).toBe(false);
    }
  });
});

describe('parseUserDate – numeric conventions', () => {
  it('reads slash dates day-first in the day-first setting and offers the swap', () => {
    const r = ok('02/03/1923', 'dayFirst');
    expect(r.value.date).toBe('1923-03-02');
    expect(r.alternative?.date).toBe('1923-02-03');
  });
  it('reads slash dates month-first in the month-first setting and offers the swap', () => {
    const r = ok('02/03/1923', 'monthFirst');
    expect(r.value.date).toBe('1923-02-03');
    expect(r.alternative?.date).toBe('1923-03-02');
  });
  it('dots are always day-first, regardless of setting', () => {
    expect(ok('02.03.1923', 'monthFirst').value.date).toBe('1923-03-02');
  });
  it('does not offer an alternative when the swap would be invalid', () => {
    const r = ok('14/03/1923', 'monthFirst');
    expect(r.value.date).toBe('1923-03-14');
    expect(r.alternative).toBeNull();
  });
  it('does not offer an alternative when day equals month', () => {
    expect(ok('03/03/1923').alternative).toBeNull();
  });
});

describe('formatting', () => {
  it('formats ranges short, long and as card years', () => {
    expect(formatDateWithQualifier('en', '1920', 'between', 'short', '1925')).toBe('1920\u20131925');
    expect(formatDateWithQualifier('en', '1920', 'between', 'long', '1925')).toBe('between 1920 and 1925');
    expect(formatDateWithQualifier('de', '1920', 'between', 'long', '1925')).toBe('zwischen 1920 und 1925');
    expect(formatDateWithQualifier('en', '1905', 'from', 'long', '1962')).toBe('from 1905 to 1962');
    expect(formatDateWithQualifier('de', '1905-03', 'from', 'long', '1962-03-14')).toBe('von März 1905 bis 14. März 1962');
    expect(formatDateWithQualifier('en', '1905', 'from', 'long', null)).toBe('from 1905');
    expect(formatYearWithQualifier({ date: '1920', qualifier: 'between', dateEnd: '1925' })).toBe('1920\u20131925');
    expect(formatYearWithQualifier({ date: '1920-03', qualifier: 'between', dateEnd: '1920-05' })).toBe('1920');
    expect(formatYearWithQualifier({ date: '1920', qualifier: 'about', dateEnd: null })).toBe('~1920');
    expect(ordinalOf({ date: '1920', qualifier: 'between', dateEnd: '1925' }, 'end')).toBe(toOrdinal('1925', 'end'));
    expect(ordinalOf({ date: '1920', qualifier: 'between', dateEnd: '1925' }, 'start')).toBe(toOrdinal('1920', 'start'));
  });
  it('formats short dates per locale', () => {
    expect(formatPartialDate('de', '1923-03-14')).toBe('14.03.1923');
    expect(formatPartialDate('en', '1923-03-14')).toBe('14 Mar 1923');
    expect(formatPartialDate('de', '1923-03')).toBe('März 1923');
    expect(formatPartialDate('en', '1923-03')).toBe('Mar 1923');
    expect(formatPartialDate('en', '1923')).toBe('1923');
    expect(formatPartialDate('en', null)).toBe('');
  });
  it('formats long dates per locale', () => {
    expect(formatPartialDate('de', '1923-03-02', 'long')).toBe('2. März 1923');
    expect(formatPartialDate('en', '1923-03-02', 'long')).toBe('2 March 1923');
  });
  it('adds qualifier marks; estimated shares ~', () => {
    expect(formatDateWithQualifier('en', '1923', 'about')).toBe('~1923');
    expect(formatDateWithQualifier('en', '1923', 'before')).toBe('<1923');
    expect(formatDateWithQualifier('en', '1923', 'after')).toBe('>1923');
    expect(qualifierMark('estimated')).toBe('~');
  });
});

describe('arithmetic', () => {
  it('computes years between partial dates', () => {
    expect(yearsBetween('1923-03-14', '2001-01-02')).toBe(77);
    expect(yearsBetween('1923-03-14', '2001-03-13')).toBe(77);
    expect(yearsBetween('1923-03-14', '2001-03-14')).toBe(78);
    expect(yearsBetween('1923', '2001')).toBe(78);
    expect(yearsBetween(null, '2001')).toBeNull();
  });
  it('orders partial dates with start/end edges', () => {
    expect(toOrdinal('1923', 'start')!).toBeLessThan(toOrdinal('1923-06', 'start')!);
    expect(toOrdinal('1923', 'end')!).toBeGreaterThan(toOrdinal('1923-06', 'end')!);
  });
});
