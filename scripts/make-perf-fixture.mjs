/**
 * Generates src/fixtures/perf-500.json: a deterministic 500-person tree for performance
 * tests (separate from the readable sample). Seeded PRNG, so the output is reproducible.
 * Run: node scripts/make-perf-fixture.mjs
 */
import { writeFileSync } from 'node:fs';

let seed = 20260913;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const id = (prefix, n) => `${prefix}0000-0000-4000-8000-${String(n).padStart(12, '0')}`.slice(prefix.length);
const GIVEN_M = ['Johann', 'Karl', 'Friedrich', 'Wilhelm', 'Heinrich', 'Otto', 'Paul', 'Hans', 'Peter', 'Thomas', 'Michael', 'Andreas', 'Stefan', 'Jonas', 'Lukas'];
const GIVEN_F = ['Anna', 'Maria', 'Elisabeth', 'Margarethe', 'Katharina', 'Emma', 'Gertrud', 'Ingrid', 'Ursula', 'Sabine', 'Petra', 'Claudia', 'Julia', 'Lena', 'Mia'];
const SURNAMES = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann'];
const PLACES = ['Berlin', 'Hamburg', 'München', 'Köln', 'Leipzig', 'Dresden', 'Bremen', 'Stuttgart', 'Nürnberg', 'Kiel'];
const JOBS = ['Bauer', 'Schmied', 'Lehrer', 'Näherin', 'Kaufmann', 'Arbeiter', 'Bäcker', 'Ärztin', 'Ingenieur', 'Verkäuferin'];

const persons = {}, unions = {}, childLinks = {};
let pc = 0, uc = 0, lc = 0;
const mk = (sex, year, surname) => {
  const p = {
    id: id('', ++pc),
    givenNames: sex === 'male' ? pick(GIVEN_M) : pick(GIVEN_F),
    surname,
    birthName: '', nickname: '', titlePrefix: '', sex,
    birth: { date: `${year}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`, qualifier: rnd() < 0.1 ? 'about' : 'exact', place: pick(PLACES), note: '' },
    death: { date: null, qualifier: 'exact', place: '', note: '', cause: '' },
    lifeStatus: 'unknown',
    occupation: pick(JOBS), religion: '', residence: '', events: [], sources: '', notes: '', customFields: [], position: null, tag: null, rawGedcom: [],
  };
  if (year < 1950 && rnd() < 0.9) {
    p.death.date = String(year + 40 + Math.floor(rnd() * 55));
    p.death.qualifier = rnd() < 0.1 ? 'about' : 'exact';
    p.lifeStatus = 'deceased';
  } else if (year >= 1950) p.lifeStatus = rnd() < 0.8 ? 'living' : 'unknown';
  persons[p.id] = p;
  return p;
};
const union = (a, b, year) => {
  const u = { id: id('', 1000 + ++uc), partnerIds: [a.id, b.id], type: 'marriage', marriageDate: String(year), marriageQualifier: 'exact', marriagePlace: pick(PLACES), divorceDate: null, divorceQualifier: 'exact', status: 'married', notes: '', position: null, rawGedcom: [] };
  if (rnd() < 0.08) { u.status = 'divorced'; u.divorceDate = String(year + 5 + Math.floor(rnd() * 15)); }
  unions[u.id] = u;
  return u;
};
const link = (u, c) => { const l = { id: id('', 2000 + ++lc), unionId: u.id, childId: c.id, relationType: rnd() < 0.03 ? 'adopted' : 'biological' }; childLinks[l.id] = l; };

// Build several families from founders in the 1820s, descending until ~500 people.
const TARGET = 500;
let queue = [];
for (let f = 0; f < 6 && pc < TARGET; f++) {
  const surname = pick(SURNAMES);
  const a = mk('male', 1820 + Math.floor(rnd() * 10), surname);
  const b = mk('female', 1822 + Math.floor(rnd() * 10), pick(SURNAMES));
  queue.push({ a, b, surname });
}
while (queue.length && pc < TARGET) {
  const { a, b, surname } = queue.shift();
  const y = Math.max(Number(a.birth.date.slice(0, 4)), Number(b.birth.date.slice(0, 4))) + 22 + Math.floor(rnd() * 6);
  const u = union(a, b, y);
  const n = 1 + Math.floor(rnd() * 5);
  for (let i = 0; i < n && pc < TARGET; i++) {
    const sex = rnd() < 0.5 ? 'male' : 'female';
    const c = mk(sex, y + 1 + i * 2 + Math.floor(rnd() * 2), surname);
    link(u, c);
    if (rnd() < 0.7 && Number(c.birth.date.slice(0, 4)) < 1995) {
      const partner = mk(sex === 'male' ? 'female' : 'male', Number(c.birth.date.slice(0, 4)) + Math.floor(rnd() * 6) - 3, pick(SURNAMES));
      queue.push({ a: sex === 'male' ? c : partner, b: sex === 'male' ? partner : c, surname: sex === 'male' ? surname : partner.surname });
    }
  }
}
const project = { schemaVersion: 1, id: id('', 9999), name: 'Performance fixture (500 people)', createdAt: 1700000000000, modifiedAt: 1700000000000, persons, unions, childLinks, rawRecords: [], settings: { preserveRawGedcom: true } };
writeFileSync('src/fixtures/perf-500.json', JSON.stringify(project) + '\n');
console.log(`persons ${pc}, unions ${uc}, links ${lc}`);
