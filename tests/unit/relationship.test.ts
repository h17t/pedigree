import { describe, expect, it } from 'vitest';
import { relationship, describeRelation } from '@/model/relationship';
import { t, useLocaleStore } from '@/i18n';
import { build } from './fixtures';
import type { Person } from '@/model/types';

function family() {
  const b = build();
  const gp = b.person('Grandpa', { sex: 'male' }), gm = b.person('Grandma', { sex: 'female' });
  const dad = b.person('Dad', { sex: 'male' }), uncle = b.person('Uncle', { sex: 'male' }), aunt = b.person('Aunt', { sex: 'female' });
  const mum = b.person('Mum', { sex: 'female' }), me = b.person('Me', { sex: 'female' }), bro = b.person('Bro', { sex: 'male' });
  const cousin = b.person('Cousin', { sex: 'female' }), cousinKid = b.person('CousinKid', { sex: 'male' });
  const wife = b.person('Wife', { sex: 'female' }), kid = b.person('Kid', { sex: 'male' }), grandkid = b.person('Grandkid', { sex: 'female' });
  const half = b.person('Half', { sex: 'male' }), ex = b.person('Ex', { sex: 'female' }), stranger = b.person('Stranger');
  const auntHusband = b.person('AuntHusband', { sex: 'male' });
  b.family([gp, gm], [dad, uncle, aunt]);
  b.family([dad, mum], [me, bro]);
  b.family([dad, ex], [half]);
  b.family([uncle], [cousin]);
  b.family([cousin], [cousinKid]);
  b.family([me, wife], [kid]);
  b.family([kid], [grandkid]);
  b.family([aunt, auntHusband], []);
  return { p: b.project, gp, gm, dad, uncle, aunt, mum, me, bro, cousin, cousinKid, wife, kid, grandkid, half, ex, stranger, auntHusband };
}

describe('relationship', () => {
  it('classifies direct lines, siblings, aunts, nieces, cousins with removal, partners and in-laws', () => {
    const f = family();
    const r = (a: Person, b: Person) => relationship(f.p, a.id, b.id);
    expect(r(f.me, f.dad)).toEqual({ kind: 'ancestor', up: 1 });
    expect(r(f.me, f.gm)).toEqual({ kind: 'ancestor', up: 2 });
    expect(r(f.gp, f.me)).toEqual({ kind: 'descendant', down: 2 });
    expect(r(f.me, f.bro)).toEqual({ kind: 'sibling', half: false });
    expect(r(f.me, f.half)).toEqual({ kind: 'sibling', half: true });
    expect(r(f.me, f.uncle)).toEqual({ kind: 'auntUncle', up: 1 });
    expect(r(f.uncle, f.me)).toEqual({ kind: 'nieceNephew', down: 1 });
    expect(r(f.me, f.cousin)).toEqual({ kind: 'cousin', degree: 1, removed: 0, olderSide: null });
    expect(r(f.me, f.cousinKid)).toEqual({ kind: 'cousin', degree: 1, removed: 1, olderSide: 'a' }); // Me is the generation nearer the common ancestor
    expect(r(f.me, f.wife)).toEqual({ kind: 'partner' });
    expect(r(f.me, f.grandkid)).toEqual({ kind: 'descendant', down: 2 });
    expect(r(f.me, f.auntHusband)).toMatchObject({ kind: 'partnerOfRelative', inner: { kind: 'auntUncle', up: 1 } });
    expect(r(f.wife, f.bro)).toMatchObject({ kind: 'relativeOfPartner', inner: { kind: 'sibling', half: false } });
    expect(r(f.me, f.stranger)).toEqual({ kind: 'none' });
    expect(r(f.me, f.me)).toEqual({ kind: 'same' });
  });

  it('describes the relationship in plain English and German', () => {
    const f = family();
    const name = (id: string) => f.p.persons[id]!.givenNames;
    useLocaleStore.setState({ locale: 'en' });
    const en = (a: Person, b: Person) => describeRelation(f.p, a.id, b.id, t, 'en', name);
    expect(en(f.me, f.gm)).toBe('Grandma is the grandmother of Me.');
    expect(en(f.me, f.gp)).toBe('Grandpa is the grandfather of Me.');
    expect(en(f.grandkid, f.gp)).toBe('Grandpa is the great-great-grandfather of Grandkid.');
    expect(en(f.me, f.half)).toBe('Half is the half-brother of Me.');
    expect(en(f.me, f.cousinKid)).toBe('CousinKid is the first cousin once removed of Me.');
    expect(en(f.me, f.auntHusband)).toBe('AuntHusband is the partner of Aunt, the aunt of Me.');
    expect(en(f.me, f.stranger)).toBe('No known relationship between Me and Stranger.');
    useLocaleStore.setState({ locale: 'de' });
    const de = (a: Person, b: Person) => describeRelation(f.p, a.id, b.id, t, 'de', name);
    expect(de(f.me, f.gm)).toBe('Grandma ist die Großmutter von Me.');
    expect(de(f.grandkid, f.gp)).toBe('Grandpa ist der Ururgroßvater von Grandkid.');
    expect(de(f.me, f.cousin)).toBe('Cousin ist die Cousine ersten Grades von Me.');
    expect(de(f.uncle, f.me)).toBe('Me ist die Nichte von Uncle.');
    useLocaleStore.setState({ locale: 'en' });
  });

  it('composes great-prefixes and articles in the other languages', () => {
    const f = family();
    const name = (id: string) => f.p.persons[id]!.givenNames;
    const say = (locale: 'fr' | 'es' | 'it' | 'pt' | 'nl' | 'pl' | 'ru' | 'tr', a: Person, b: Person) => {
      useLocaleStore.setState({ locale });
      return describeRelation(f.p, a.id, b.id, t, locale, name);
    };
    expect(say('fr', f.me, f.gm)).toBe('Grandma est la grand-mère de Me.');
    expect(say('fr', f.grandkid, f.gp)).toBe('Grandpa est l’arrière-arrière-grand-père de Grandkid.');
    expect(say('fr', f.me, f.cousin)).toBe('Cousin est la cousine germaine de Me.'.replace('germaine', 'germain'));
    expect(say('es', f.grandkid, f.gp)).toBe('Grandpa es el tatarabuelo de Grandkid.');
    expect(say('es', f.me, f.gp)).toBe('Grandpa es el abuelo de Me.');
    expect(say('it', f.grandkid, f.gm)).toBe('Grandma è la trisnonna di Grandkid.');
    expect(say('pt', f.grandkid, f.gp)).toBe('Grandpa é o trisavô de Grandkid.');
    expect(say('nl', f.grandkid, f.gp)).toBe('Grandpa is de overovergrootvader van Grandkid.');
    expect(say('pl', f.grandkid, f.gm)).toBe('Grandma to praprababcia osoby Grandkid.');
    expect(say('ru', f.grandkid, f.gp)).toBe('Grandpa — прапрадедушка для Grandkid.');
    expect(say('tr', f.grandkid, f.gp)).toBe('Grandpa, Grandkid kişisinin büyük büyük dedesi.');
    useLocaleStore.setState({ locale: 'en' });
  });
});
