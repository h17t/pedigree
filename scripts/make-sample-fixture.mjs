/**
 * Generates src/fixtures/sample-family.json: the in-app sample family AND the test fixture
 * (one artifact, one source of truth). Deterministic ids, so tests can reference people.
 *
 * Contents: two disconnected families plus one isolated person, multiple marriages, a divorce,
 * a separation, a widow, an unmarried partnership, a same-sex partnership, adoption, a foster
 * child, a step relation via a second marriage, a sibling group with unknown parents, uncertain
 * dates (~ < > estimated), an infant death, incomplete records, events, custom fields, notes.
 *
 * Run: node scripts/make-sample-fixture.mjs
 */
import { writeFileSync } from 'node:fs';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const pid = (n) => id(n); // persons 1..99
const uid = (n) => id(100 + n); // unions 101..
const cid = (n) => id(200 + n); // child links 201..
const eid = (n) => id(300 + n); // events 301..

const persons = {};
const unions = {};
const childLinks = {};
let eventCounter = 0;
let linkCounter = 0;

const date = (d, qualifier = 'exact', place = '', note = '') => ({ date: d, qualifier, place, note });
const death = (d, qualifier = 'exact', place = '', note = '', cause = '') => ({ date: d, qualifier, place, note, cause });

function person(n, given, surname, sex, opts = {}) {
  const p = {
    id: pid(n),
    givenNames: given,
    surname,
    birthName: opts.birthName ?? '',
    nickname: opts.nickname ?? '',
    titlePrefix: opts.titlePrefix ?? '',
    sex,
    birth: opts.birth ?? date(null),
    death: opts.death ?? death(null),
    lifeStatus: opts.lifeStatus ?? (opts.death?.date ? 'deceased' : 'unknown'),
    occupation: opts.occupation ?? '',
    religion: opts.religion ?? '',
    residence: opts.residence ?? '',
    events: (opts.events ?? []).map((e) => ({ id: eid(++eventCounter), label: '', qualifier: 'exact', place: '', note: '', ...e })),
    sources: opts.sources ?? '',
    notes: opts.notes ?? '',
    customFields: opts.customFields ?? [],
    position: null,
    tag: opts.tag ?? null,
    rawGedcom: [],
  };
  persons[p.id] = p;
  return p.id;
}

function union(n, partners, opts = {}) {
  const u = {
    id: uid(n),
    partnerIds: partners,
    type: opts.type ?? 'marriage',
    marriageDate: opts.marriageDate ?? null,
    marriageQualifier: opts.marriageQualifier ?? 'exact',
    marriagePlace: opts.marriagePlace ?? '',
    divorceDate: opts.divorceDate ?? null,
    divorceQualifier: 'exact',
    status: opts.status ?? (opts.type === 'marriage' || !opts.type ? 'married' : 'unknown'),
    notes: opts.notes ?? '',
    position: null,
    rawGedcom: [],
  };
  unions[u.id] = u;
  return u.id;
}

function child(unionId, childId, relationType = 'biological') {
  const l = { id: cid(++linkCounter), unionId, childId, relationType };
  childLinks[l.id] = l;
}

const WEBER = { color: 'green', label: 'Weber' };
const KOCH = { color: 'amber', label: 'Koch' };
const LINDNER = { color: 'steel', label: 'Lindner' };

// ---------------- Family A: Weber / Koch (Palatinate) ----------------
// Generation 0
const friedrich = person(1, 'Friedrich', 'Weber', 'male', {
  birth: date('1848-04-02', 'exact', 'Landau in der Pfalz'),
  death: death('1912-11-19', 'exact', 'Landau in der Pfalz', '', 'Lungenentzündung'),
  occupation: 'Winzer',
  religion: 'evangelisch',
  events: [{ type: 'burial', date: '1912-11-22', place: 'Landau, Hauptfriedhof' }],
  sources: 'Kirchenbuch Landau, Sterberegister 1912, Nr. 214',
  tag: WEBER,
});
const wilhelmine = person(2, 'Wilhelmine Charlotte', 'Weber', 'female', {
  birthName: 'Kühl',
  birth: date('1852', 'about', 'Neustadt an der Weinstraße'),
  death: death('1930-01-05', 'exact', 'Landau in der Pfalz'),
  occupation: 'Bäuerin',
  notes:
    'Laut Familienerzählung stammte Wilhelmine aus Neustadt; ihre Eltern sind in keinem Kirchenbuch gefunden worden. Ihr Bruder August wanderte zeitweise nach Lothringen aus und kehrte 1890 zurück. Sie führte nach dem Tod ihres Mannes den Weinbetrieb noch 18 Jahre allein weiter und galt im Dorf als streng, aber gerecht.',
  tag: WEBER,
});
const august = person(3, 'August', 'Kühl', 'male', {
  birth: date('1855', 'estimated'),
  death: death('1920', 'after'),
  occupation: 'Tagelöhner',
});
// Wilhelmine and August are siblings with unknown parents: a zero-partner union.
const kuehlSiblings = union(1, [], { type: 'unknown', status: 'unknown', notes: 'Eltern unbekannt' });
child(kuehlSiblings, wilhelmine);
child(kuehlSiblings, august);

const friedrichWilhelmine = union(2, [friedrich, wilhelmine], { marriageDate: '1876-05-20', marriagePlace: 'Landau in der Pfalz' });
const karl = person(4, 'Karl', 'Weber', 'male', {
  birth: date('1878-02-11', 'exact', 'Landau in der Pfalz'),
  death: death('1944-12-30', 'exact', 'Landau in der Pfalz'),
  occupation: 'Winzer',
  events: [{ type: 'baptism', date: '1878-02-24', place: 'Stiftskirche Landau' }],
  tag: WEBER,
});
const marie = person(5, 'Marie', 'Koch', 'female', {
  birthName: 'Weber',
  birth: date('1881-07-30', 'exact', 'Landau in der Pfalz'),
  lifeStatus: 'unknown',
  notes: 'Sterbedatum nicht bekannt; zuletzt 1955 in Speyer nachgewiesen.',
  tag: KOCH,
});
const otto = person(6, 'Otto', 'Weber', 'male', {
  birth: date('1885-10-03', 'exact', 'Landau in der Pfalz'),
  death: death('1915-05', 'about', 'bei Ypern', 'Gefallen', 'Gefallen im Ersten Weltkrieg'),
  occupation: 'Küfer',
  tag: WEBER,
});
child(friedrichWilhelmine, karl);
child(friedrichWilhelmine, marie);
child(friedrichWilhelmine, otto);

// Generation 1
const anna = person(7, 'Anna', 'Weber', 'female', {
  birthName: 'Schmidt',
  birth: date('1884-03-14', 'exact', 'Edenkoben'),
  death: death('1962-01-02', 'exact', 'Landau in der Pfalz'),
  occupation: 'Lehrerin',
  tag: WEBER,
});
const karlAnna = union(3, [karl, anna], { marriageDate: '1905-09-16', marriagePlace: 'Edenkoben' });
const heinrich = person(8, 'Heinrich', 'Weber', 'male', {
  birth: date('1906-06-21', 'exact', 'Landau in der Pfalz'),
  death: death('1980-08-14', 'exact', 'Neustadt an der Weinstraße'),
  occupation: 'Weinhändler',
  residence: 'Neustadt an der Weinstraße',
  customFields: [{ label: 'Weingut', value: 'Weber & Söhne, gegründet 1931' }],
  tag: WEBER,
});
const elisabeth = person(9, 'Elisabeth', 'Hartmann', 'female', {
  birthName: 'Weber',
  nickname: 'Lisbeth',
  birth: date('1909-12-01', 'exact', 'Landau in der Pfalz'),
  death: death('1998-03-17', 'exact', 'Karlsruhe'),
  tag: WEBER,
});
const paulInfant = person(10, 'Paul', 'Weber', 'male', {
  birth: date('1912-04-02', 'exact', 'Landau in der Pfalz'),
  death: death('1912-04-09', 'exact', 'Landau in der Pfalz'),
  tag: WEBER,
});
child(karlAnna, heinrich);
child(karlAnna, elisabeth);
child(karlAnna, paulInfant);

const ludwig = person(11, 'Ludwig', 'Koch', 'male', {
  birth: date('1879', 'about', 'Speyer'),
  death: death('1950-10-10', 'exact', 'Speyer'),
  occupation: 'Lehrer',
  religion: 'katholisch',
  tag: KOCH,
});
const marieLudwig = union(4, [ludwig, marie], { marriageDate: '1906', marriageQualifier: 'about', marriagePlace: 'Speyer' });
const johann = person(12, 'Johann', 'Koch', 'male', {
  birth: date('1908-08-08', 'exact', 'Speyer'),
  death: death('1975-02-27', 'exact', 'Speyer'),
  occupation: 'Buchhalter',
  tag: KOCH,
});
const klara = person(13, 'Klara', 'Koch', 'female', {
  birth: date('1911-01-15', 'exact', 'Speyer'),
  death: death('2001-06-30', 'exact', 'Mannheim'),
  occupation: 'Schneiderin',
  tag: KOCH,
});
child(marieLudwig, johann);
child(marieLudwig, klara);

// Generation 2 — Heinrich: two marriages, divorce, adoption of the second wife's son
const gertrud = person(14, 'Gertrud', 'Meyer', 'female', {
  birth: date('1910-02-20', 'exact', 'Neustadt an der Weinstraße'),
  death: death('1990-11-11', 'exact', 'Neustadt an der Weinstraße'),
});
const heinrichGertrud = union(5, [heinrich, gertrud], {
  marriageDate: '1932-04-30',
  marriagePlace: 'Neustadt an der Weinstraße',
  divorceDate: '1948-02-12',
  status: 'divorced',
});
const werner = person(15, 'Werner', 'Weber', 'male', {
  birth: date('1934-01-19', 'exact', 'Neustadt an der Weinstraße'),
  death: death('2010-05-05', 'exact', 'Neustadt an der Weinstraße'),
  occupation: 'Weinhändler',
  tag: WEBER,
});
const ingrid = person(16, 'Ingrid', 'Schulz', 'female', {
  birthName: 'Weber',
  birth: date('1937-09-09', 'exact', 'Neustadt an der Weinstraße'),
  lifeStatus: 'living',
  occupation: 'Apothekerin',
  tag: WEBER,
});
child(heinrichGertrud, werner);
child(heinrichGertrud, ingrid);

const hilde = person(17, 'Hilde', 'Weber', 'female', {
  birthName: 'Braun',
  birth: date('1920-07-07', 'exact', 'Kaiserslautern'),
  death: death('2005-12-24', 'exact', 'Neustadt an der Weinstraße'),
});
const dieter = person(18, 'Dieter', 'Weber', 'male', {
  birthName: 'Braun',
  birth: date('1945-03-03', 'exact', 'Kaiserslautern'),
  lifeStatus: 'living',
  occupation: 'Kfz-Meister',
  notes: 'Von Heinrich Weber 1951 adoptiert; leiblicher Vater unbekannt.',
  tag: WEBER,
});
const hildeAlone = union(6, [hilde], { type: 'unknown', status: 'unknown' });
child(hildeAlone, dieter, 'biological');
const heinrichHilde = union(7, [heinrich, hilde], { marriageDate: '1950-06-03', marriagePlace: 'Neustadt an der Weinstraße', status: 'widowed' });
child(heinrichHilde, dieter, 'adopted');
const ursula = person(19, 'Ursula', 'Fischer', 'female', {
  birthName: 'Weber',
  birth: date('1952-10-10', 'exact', 'Neustadt an der Weinstraße'),
  lifeStatus: 'living',
  occupation: 'Ärztin',
  tag: WEBER,
});
child(heinrichHilde, ursula);

const franz = person(20, 'Franz', 'Hartmann', 'male', {
  birth: date('1905-05-05', 'exact', 'Karlsruhe'),
  death: death('1970-01-20', 'exact', 'Karlsruhe'),
  occupation: 'Eisenbahner',
});
const elisabethFranz = union(8, [franz, elisabeth], { marriageDate: '1933-10-14', marriagePlace: 'Landau in der Pfalz', status: 'widowed' });
const rosa = person(21, 'Rosa', 'Hartmann', 'female', { birth: date('1935-02-02', 'exact', 'Karlsruhe'), lifeStatus: 'living' });
const ernst = person(22, 'Ernst', 'Hartmann', 'male', {
  birth: date('1938-08-18', 'exact', 'Karlsruhe'),
  death: death('2015-07-07', 'exact', 'Karlsruhe'),
  occupation: 'Ingenieur',
});
child(elisabethFranz, rosa);
child(elisabethFranz, ernst);

const erna = person(23, 'Erna', 'Koch', 'female', {
  birthName: 'Lang',
  birth: date('1910', 'estimated', 'Ludwigshafen'),
  death: death('1985-09-09', 'exact', 'Speyer'),
  tag: KOCH,
});
const johannErna = union(9, [johann, erna], { marriageDate: '1935-05-25', marriagePlace: 'Speyer' });
// Incomplete record: nothing but a name.
const helmut = person(24, 'Helmut', 'Koch', 'male', { tag: KOCH });
const brigitte = person(25, 'Brigitte', 'Koch', 'female', {
  birth: date('1940-11-30', 'exact', 'Speyer'),
  lifeStatus: 'living',
  occupation: 'Bibliothekarin',
  tag: KOCH,
});
child(johannErna, helmut);
child(johannErna, brigitte);

const walter = person(26, 'Walter', 'Vogt', 'male', {
  birth: date('1908-04-04', 'exact', 'Mannheim'),
  death: death('1979-03-03', 'exact', 'Mannheim'),
  occupation: 'Musiker',
});
const klaraWalter = union(10, [klara, walter], { type: 'unmarried', status: 'partnership' });
const renate = person(27, 'Renate', 'Koch', 'female', {
  birth: date('1942-06-06', 'exact', 'Mannheim'),
  lifeStatus: 'living',
  occupation: 'Journalistin',
  tag: KOCH,
});
child(klaraWalter, renate);

// Generation 3
const christa = person(28, 'Christa', 'Weber', 'female', {
  birthName: 'Neumann',
  birth: date('1936-12-12', 'exact', 'Bad Dürkheim'),
  lifeStatus: 'living',
  tag: WEBER,
});
const wernerChrista = union(11, [werner, christa], { marriageDate: '1958-08-23', marriagePlace: 'Bad Dürkheim', status: 'widowed' });
const thomas = person(29, 'Thomas', 'Weber', 'male', {
  birth: date('1960-03-21', 'exact', 'Neustadt an der Weinstraße'),
  lifeStatus: 'living',
  occupation: 'Winzer',
  tag: WEBER,
});
const sabine = person(30, 'Sabine', 'Weber', 'female', {
  birth: date('1963-07-14', 'exact', 'Neustadt an der Weinstraße'),
  lifeStatus: 'living',
  occupation: 'Architektin',
  tag: WEBER,
});
child(wernerChrista, thomas);
child(wernerChrista, sabine);

const peter = person(31, 'Peter', 'Schulz', 'male', {
  birth: date('1935-01-01', 'exact', 'Mainz'),
  death: death('2020-04-18', 'exact', 'Mainz'),
  occupation: 'Apotheker',
});
const ingridPeter = union(12, [peter, ingrid], { marriageDate: '1960-05-14', marriagePlace: 'Mainz', status: 'widowed' });
const andreas = person(32, 'Andreas', 'Schulz', 'male', { birth: date('1961-09-30', 'exact', 'Mainz'), lifeStatus: 'living', occupation: 'Apotheker' });
child(ingridPeter, andreas);

const michael = person(33, 'Michael', 'Fischer', 'male', { birth: date('1950-02-28', 'exact', 'Heidelberg'), lifeStatus: 'living', occupation: 'Lehrer' });
const ursulaMichael = union(13, [michael, ursula], { marriageDate: '1975-07-05', marriagePlace: 'Heidelberg', status: 'separated' });
const julia = person(34, 'Julia', 'Fischer', 'female', { birth: date('1978-11-11', 'exact', 'Heidelberg'), lifeStatus: 'living', occupation: 'Übersetzerin' });
const kevin = person(35, 'Kevin', 'Ortiz', 'male', {
  birth: date('1990-05-19', 'exact', 'Heidelberg'),
  lifeStatus: 'living',
  notes: 'Pflegekind der Familie Fischer von 1996 bis 2008.',
});
child(ursulaMichael, julia);
child(ursulaMichael, kevin, 'foster');

const monika = person(36, 'Monika', 'Berger', 'female', { birth: date('1965-10-02', 'exact', 'Freiburg'), lifeStatus: 'living', occupation: 'Ingenieurin' });
const sabineMonika = union(14, [sabine, monika], { type: 'partnership', status: 'partnership', marriageDate: '2002-09-14', marriagePlace: 'Freiburg' });
const lena = person(37, 'Lena', 'Weber', 'female', {
  birth: date('1998-01-23', 'exact', 'Freiburg'),
  lifeStatus: 'living',
  notes: 'Adoptiert 2003.',
  tag: WEBER,
});
child(sabineMonika, lena, 'adopted');

// Generation 4
const claudia = person(38, 'Claudia', 'Weber', 'female', { birthName: 'Roth', birth: date('1962-04-04', 'exact', 'Landau in der Pfalz'), lifeStatus: 'living' });
const thomasClaudia = union(15, [thomas, claudia], { marriageDate: '1988-06-11', marriagePlace: 'Neustadt an der Weinstraße' });
const felix = person(39, 'Felix', 'Weber', 'male', { birth: date('1990-09-09', 'exact', 'Neustadt an der Weinstraße'), lifeStatus: 'living', occupation: 'Winzer', tag: WEBER });
const annaJ = person(40, 'Anna', 'Weber', 'female', { birth: date('1993-12-05', 'exact', 'Neustadt an der Weinstraße'), lifeStatus: 'living', occupation: 'Studentin', tag: WEBER });
child(thomasClaudia, felix);
child(thomasClaudia, annaJ);

// ---------------- Family B: Lindner (Bremen), disconnected ----------------
const johannL = person(41, 'Johann', 'Lindner', 'male', {
  birth: date('1860-03-01', 'exact', 'Bremen'),
  death: death('1935-06-06', 'exact', 'Bremen'),
  occupation: 'Schiffszimmermann',
  events: [
    { type: 'emigration', date: '1884-04', place: 'Bremerhaven → New York', note: 'Rückkehr 1892' },
    { type: 'residence', date: '1892', place: 'Bremen-Vegesack' },
  ],
  tag: LINDNER,
});
const emma = person(42, 'Emma', 'Lindner', 'female', {
  birthName: 'Voss',
  birth: date('1865-08-15', 'exact', 'Vegesack'),
  death: death('1940-02-02', 'exact', 'Bremen'),
  tag: LINDNER,
});
const johannEmma = union(16, [johannL, emma], { marriageDate: '1887-10-01', marriagePlace: 'Bremen' });
const carl = person(43, 'Carl', 'Lindner', 'male', {
  birth: date('1888-05-05', 'exact', 'New York'),
  death: death('1960-10-30', 'exact', 'Bremen'),
  occupation: 'Werftarbeiter',
  tag: LINDNER,
});
const hedwig = person(44, 'Hedwig', 'Lindner', 'female', {
  birth: date('1891-01-31', 'exact', 'New York'),
  death: death('1970', 'about', 'Hamburg'),
  tag: LINDNER,
});
child(johannEmma, carl);
child(johannEmma, hedwig);
const margarethe = person(45, 'Margarethe', 'Lindner', 'female', {
  birthName: 'Berg',
  birth: date('1890-12-24', 'exact', 'Bremen'),
  lifeStatus: 'unknown',
  tag: LINDNER,
});
const carlMargarethe = union(17, [carl, margarethe], { marriageDate: '1919-03-08', marriagePlace: 'Bremen' });
const robert = person(46, 'Robert', 'Lindner', 'male', {
  birth: date('1920-02-14', 'exact', 'Bremen'),
  death: death('1944', 'about', 'Ostfront', 'Vermisst, 1950 für tot erklärt'),
  tag: LINDNER,
});
const elseL = person(47, 'Else', 'Lindner', 'female', {
  birth: date('1923-06-18', 'exact', 'Bremen'),
  death: death('2010-01-09', 'exact', 'Bremen'),
  occupation: 'Verkäuferin',
  tag: LINDNER,
});
child(carlMargarethe, robert);
child(carlMargarethe, elseL);

// ---------------- Isolated person ----------------
person(48, 'Sophie', 'Meier', 'female', {
  birth: date('1900', 'about'),
  death: death('1970-05-01', 'exact'),
  notes: 'Auf einem Foto im Nachlass von Anna Weber; Verwandtschaft unklar.',
});

const project = {
  schemaVersion: 1,
  id: id(999),
  name: 'Beispielfamilie (Weber und Koch)',
  createdAt: 1700000000000,
  modifiedAt: 1700000000000,
  persons,
  unions,
  childLinks,
  rawRecords: [],
  settings: { preserveRawGedcom: true },
};

writeFileSync('src/fixtures/sample-family.json', JSON.stringify(project, null, 2) + '\n');
console.log(`persons ${Object.keys(persons).length}, unions ${Object.keys(unions).length}, childLinks ${Object.keys(childLinks).length}`);
