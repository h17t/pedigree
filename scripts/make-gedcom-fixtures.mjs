/**
 * Writes the GEDCOM test files under tests/gedcom/. The binary variants (Windows-1252,
 * UTF-16, ANSEL) are derived here so the bytes are reproducible.
 * Run: node scripts/make-gedcom-fixtures.mjs
 */
import { writeFileSync } from 'node:fs';

const CRLF = (s) => s.trim().split('\n').map((l) => l.replace(/^\s+/, '')).join('\r\n') + '\r\n';
const EURO = String.fromCharCode(0x20ac);
const ENDASH = String.fromCharCode(0x2013);

const gramps = CRLF(`
0 HEAD
1 SOUR Gramps
2 VERS 5.2.0
2 NAME Gramps
1 DATE 12 SEP 2026
2 TIME 10:00:00
1 SUBM @SUBM@
1 FILE weber.ged
1 COPR Copyright (c) 2026 Test.
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
1 LANG German
0 @SUBM@ SUBM
1 NAME Test Person
0 @I1@ INDI
1 NAME Karl /Weber/
2 GIVN Karl
2 SURN Weber
2 NICK Kalle
1 SEX M
1 BIRT
2 DATE 11 FEB 1878
2 PLAC Landau in der Pfalz
2 SOUR @S1@
3 PAGE Geburtsregister 1878, Nr. 44
1 DEAT
2 DATE 30 DEC 1944
2 PLAC Landau in der Pfalz
2 CAUS Herzschwäche
1 BAPM
2 DATE 24 FEB 1878
2 PLAC Stiftskirche Landau
1 OCCU Winzer
1 RELI evangelisch
1 NOTE Ein Winzer aus der Pfalz. Zweite Zeile mit Umlauten: äöü ß.
2 CONT Dritte Zeile nach CONT.
1 SOUR @S1@
2 PAGE Familienbuch S. 12
1 _UDF Weingut
2 TEXT Weber & Söhne
1 FAMS @F1@
1 FAMC @F2@
1 _UID 1234567890ABCDEF
1 CHAN
2 DATE 1 JAN 2026
0 @I2@ INDI
1 NAME Anna /Schmidt/
2 GIVN Anna
2 SURN Schmidt
2 _MARNM Weber
1 SEX F
1 BIRT
2 DATE ABT 1884
2 PLAC Edenkoben
1 DEAT
2 DATE BET 1960 AND 1962
1 RESI
2 DATE FROM 1905 TO 1962
2 PLAC Landau
1 FAMS @F1@
0 @I3@ INDI
1 NAME Heinrich /Weber/
1 SEX M
1 BIRT
2 DATE 21 JUN 1906
1 FAMC @F1@
0 @I4@ INDI
1 NAME Dieter /Braun/
1 SEX M
1 BIRT
2 DATE EST 1945
1 FAMC @F1@
2 PEDI adopted
1 NOTE @N1@
0 @I5@ INDI
1 NAME Friedrich /Weber/
1 SEX M
1 BIRT
2 DATE 2 APR 1848
1 DEAT Y
1 FAMS @F2@
0 @I6@ INDI
1 NAME Alex /Weber/
1 SEX X
1 _GENDER diverse
1 BIRT
2 DATE 1990
1 FAMC @F1@
0 @I7@ INDI
1 NAME Robert /Lindner/
1 SEX M
1 BIRT
2 DATE @#DJULIAN@ 14 FEB 1720/21
1 EMIG
2 DATE 1884
2 PLAC Bremerhaven
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 CHIL @I4@
1 CHIL @I6@
1 MARR
2 DATE 16 SEP 1905
2 PLAC Edenkoben
1 _CUSTOMFAM something
0 @F2@ FAM
1 HUSB @I5@
1 CHIL @I1@
1 DIV
2 DATE 1890
0 @S1@ SOUR
1 TITL Kirchenbuch Landau
1 REPO @R1@
0 @R1@ REPO
1 NAME Landeskirchliches Archiv
0 @N1@ NOTE Adoptiert 1951.
0 @O1@ OBJE
1 FILE karl.jpg
2 FORM jpg
0 TRLR
`);

const ahnenblattText = CRLF(`
0 HEAD
1 SOUR AHN
2 VERS 3.0
2 NAME Ahnenblatt
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR ANSI
0 @I1@ INDI
1 NAME Jürgen /Müller/
1 SEX M
1 BIRT
2 DATE 3 MAR 1950
2 PLAC Köln
1 OCCU Schlosser
1 NOTE Größe: 1,80 m ${ENDASH} Preis 5 ${EURO}
0 @I2@ INDI
1 NAME Bärbel /Müller/
2 SURN Müller
2 _MARNM Schäfer
1 SEX F
1 BIRT
2 DATE 14.03.1952
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE 1975
0 TRLR
`);
// Windows-1252: Latin-1 for umlauts; the euro sign is 0x80 and the en dash 0x96.
const win1252 = Buffer.from(
  [...ahnenblattText].map((ch) => (ch === EURO ? String.fromCharCode(0x80) : ch === ENDASH ? String.fromCharCode(0x96) : ch)).join(''),
  'latin1',
);

const utf16Text = CRLF(`
0 HEAD
1 SOUR TEST
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UNICODE
0 @I1@ INDI
1 NAME Søren /Ærø/
1 SEX M
1 BIRT
2 DATE 1 JAN 1900
0 TRLR
`);
const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(utf16Text, 'utf16le')]);

// ANSEL: the combining diaeresis (0xE8) precedes the base letter.
const anselText = CRLF(`
0 HEAD
1 SOUR PAF
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR ANSEL
0 @I1@ INDI
1 NAME Hans /M#uller/
1 SEX M
1 BIRT
2 DATE 5 MAY 1901
2 PLAC L#ubeck
0 TRLR
`);
const ansel = Buffer.from(anselText, 'latin1');
for (let i = 0; i < ansel.length; i++) if (ansel[i] === 0x23) ansel[i] = 0xe8;

const malformed = CRLF(`
0 HEAD
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Broken /Record/
3 DATE 1900
this line is not gedcom at all
1 FAMC @F99@
0 @I2@ INDI
1 NAME Second /Person/
1 BIRT
2 DATE 31 FEB 1900
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I77@
1 CHIL @I2@
1 CHIL @I88@
`);

const gedcom7 = CRLF(`
0 HEAD
1 GEDC
2 VERS 7.0
0 @I1@ INDI
1 NAME Future /Person/
0 TRLR
`);

writeFileSync('tests/gedcom/gramps-utf8.ged', gramps);
writeFileSync('tests/gedcom/ahnenblatt-win1252.ged', win1252);
writeFileSync('tests/gedcom/utf16.ged', utf16);
writeFileSync('tests/gedcom/ansel.ged', ansel);
writeFileSync('tests/gedcom/malformed.ged', malformed);
writeFileSync('tests/gedcom/gedcom7.ged', gedcom7);
console.log('fixtures written');
