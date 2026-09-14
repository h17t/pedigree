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

  it.each([
    ['vers 1923', '1923', 'about'],
    ['avant 1923', '1923', 'before'],
    ['après 1923', '1923', 'after'],
    ['14 mars 1923', '1923-03-14', 'exact'],
    ['14 de marzo de 1923', '1923-03-14', 'exact'],
    ['hacia 1923', '1923', 'about'],
    ['antes de 1923', '1923', 'before'],
    ['después de 1923', '1923', 'after'],
    ['circa 1923', '1923', 'about'],
    ['14 marzo 1923', '1923-03-14', 'exact'],
    ['prima del 1923', '1923', 'before'],
    ['cerca de 1923', '1923', 'about'],
    ['14 de março de 1923', '1923-03-14', 'exact'],
    ['omstreeks 1923', '1923', 'about'],
    ['14 maart 1923', '1923-03-14', 'exact'],
    ['około 1923', '1923', 'about'],
    ['14 marca 1923', '1923-03-14', 'exact'],
    ['przed 1923', '1923', 'before'],
    ['около 1923', '1923', 'about'],
    ['14 марта 1923 г.', '1923-03-14', 'exact'],
    ['до 1923', '1923', 'before'],
    ['после 1923', '1923', 'after'],
    ['yaklaşık 1923', '1923', 'about'],
    ['14 Mart 1923', '1923-03-14', 'exact'],
    ["1923'ten önce", '1923', 'before'],
    ['1923 civarı', '1923', 'about'],
    ['1923年3月14日', '1923-03-14', 'exact'],
    ['1923年3月', '1923-03', 'exact'],
    ['1923年頃', '1923', 'about'],
    ['约1923年', '1923', 'about'],
    ['1923년 3월 14일', '1923-03-14', 'exact'],
    ['1923년경', '1923', 'about'],
  ])('other languages: %s → %s (%s)', (input, date, qualifier) => {
    expect(ok(input).value).toEqual({ date, qualifier, dateEnd: null });
  });

  it.each([
    ['entre 1920 et 1925', 'between'],
    ['entre 1920 y 1925', 'between'],
    ['tra 1920 e 1925', 'between'],
    ['tussen 1920 en 1925', 'between'],
    ['między 1920 a 1925', 'between'],
    ['между 1920 и 1925', 'between'],
    ['1920 ile 1925 arasında', 'between'],
    ['1920和1925之间', 'between'],
    ['de 1920 à 1925', 'from'],
    ['de 1920 a 1925', 'from'],
    ['van 1920 tot 1925', 'from'],
    ['od 1920 do 1925', 'from'],
    ['с 1920 по 1925', 'from'],
    ['从1920到1925', 'from'],
    ['1920から1925まで', 'from'],
    ['1920부터 1925까지', 'from'],
  ])('ranges in other languages: %s (%s)', (input, qualifier) => {
    expect(ok(input).value).toEqual({ date: '1920', qualifier, dateEnd: '1925' });
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
  it('formats long ranges in the other languages', () => {
    expect(formatDateWithQualifier('fr', '1920', 'between', 'long', '1925')).toBe('entre 1920 et 1925');
    expect(formatDateWithQualifier('ru', '1905', 'from', 'long', '1962')).toBe('с 1905 по 1962');
    expect(formatDateWithQualifier('pl', '1905', 'from', 'long', null)).toBe('od 1905');
    expect(formatPartialDate('fr', '1923-03-14')).toBe('14 mars 1923');
    expect(formatPartialDate('ru', '1923-03')).toMatch(/1923/);
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
