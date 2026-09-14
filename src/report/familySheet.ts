/**
 * The family sheet: one person with parents, partnerships, children and events, as plain data
 * and as a standalone HTML document (inline styles, no scripts) for printing and saving.
 */
import type { Person, Project, Union } from '@/model/types';
import { displayName } from '@/model/types';
import { formatDateWithQualifier } from '@/model/dates';
import type { Locale, TKey } from '@/i18n';
import { parentUnionsOf, unionsOf } from '@/model/edits';

export interface SheetRow {
  label: string;
  value: string;
}
export interface SheetPerson {
  name: string;
  years: string;
  detail: string;
}
export interface SheetPartnership {
  partners: SheetPerson[];
  info: string;
  children: SheetPerson[];
}
export interface FamilySheet {
  name: string;
  years: string;
  fields: SheetRow[];
  parents: SheetPerson[];
  parentsInfo: string;
  siblings: SheetPerson[];
  partnerships: SheetPartnership[];
  events: SheetRow[];
  notes: string;
  sources: string;
}

type T = (key: TKey, params?: Record<string, string | number>) => string;

export function buildFamilySheet(project: Project, personId: string, locale: Locale, t: T): FamilySheet | null {
  const person = project.persons[personId];
  if (!person) return null;
  const date = (d: string | null, q: Person['birth']['qualifier']) => (d ? formatDateWithQualifier(locale, d, q, 'long') : '');
  const years = (p: Person) => {
    const b = p.birth.date ? `* ${date(p.birth.date, p.birth.qualifier)}` : '';
    const d = p.death.date ? `† ${date(p.death.date, p.death.qualifier)}` : p.lifeStatus === 'deceased' ? '†' : '';
    return [b, d].filter(Boolean).join('   ');
  };
  const brief = (id: string): SheetPerson => {
    const p = project.persons[id];
    if (!p) return { name: t('common.unknown'), years: '', detail: '' };
    return { name: displayName(p, t('person.née')) || t('person.unnamed'), years: years(p), detail: [p.birth.place, p.occupation].filter(Boolean).join(' · ') };
  };
  const unionInfo = (u: Union) => {
    const status = u.status !== 'unknown' ? t(`union.status.${u.status}` as TKey) : u.type !== 'unknown' ? t(`union.type.${u.type}` as TKey) : t('family.notRecorded');
    const m = u.marriageDate ? `${t('union.marriageDate')}: ${date(u.marriageDate, u.marriageQualifier)}${u.marriagePlace ? `, ${u.marriagePlace}` : ''}` : '';
    const d = u.divorceDate ? `${t('union.divorceDate')}: ${date(u.divorceDate, u.divorceQualifier)}` : '';
    return [status, m, d].filter(Boolean).join(' · ');
  };
  const fields: SheetRow[] = [];
  const add = (label: string, value: string) => value && fields.push({ label, value });
  add(t('person.givenNames'), person.givenNames);
  add(t('person.surname'), person.surname);
  add(t('person.birthName'), person.birthName);
  add(t('person.nickname'), person.nickname);
  add(t('person.titlePrefix'), person.titlePrefix);
  add(t('person.sex'), person.sex === 'unknown' ? '' : t(`person.sexValue.${person.sex}` as TKey));
  add(t('person.birth'), [date(person.birth.date, person.birth.qualifier), person.birth.place, person.birth.note].filter(Boolean).join(', '));
  add(t('person.death'), [date(person.death.date, person.death.qualifier), person.death.place, person.death.cause ? `${t('person.cause')}: ${person.death.cause}` : '', person.death.note].filter(Boolean).join(', '));
  add(t('person.occupation'), person.occupation);
  add(t('person.religion'), person.religion);
  add(t('person.residence'), person.residence);
  for (const f of person.customFields) add(f.label, f.value);
  add(t('person.tag'), person.groupId ? (project.groups.find((g) => g.id === person.groupId)?.name ?? '') : '');

  const parentUnions = parentUnionsOf(project, personId);
  const parents = parentUnions.flatMap((u) => u.partnerIds).map(brief);
  const parentsInfo = parentUnions.filter((u) => u.partnerIds.length === 2).map(unionInfo).join(' · ');
  const siblingIds = [...new Set(parentUnions.flatMap((u) => Object.values(project.childLinks).filter((l) => l.unionId === u.id && l.childId !== personId).map((l) => l.childId)))];
  const partnerships: SheetPartnership[] = unionsOf(project, personId).map((u) => ({
    partners: u.partnerIds.filter((p) => p !== personId).map(brief),
    info: unionInfo(u),
    children: Object.values(project.childLinks)
      .filter((l) => l.unionId === u.id)
      .map((l) => {
        const b = brief(l.childId);
        return l.relationType !== 'biological' ? { ...b, detail: [t(`person.relation.${l.relationType}` as TKey), b.detail].filter(Boolean).join(' · ') } : b;
      }),
  }));
  const events: SheetRow[] = person.events.map((e) => ({
    label: e.type === 'other' ? e.label || t('person.eventType.other') : t(`person.eventType.${e.type}` as TKey),
    value: [date(e.date, e.qualifier), e.place, e.note].filter(Boolean).join(', '),
  }));
  return {
    name: displayName(person, t('person.née')) || t('person.unnamed'),
    years: years(person),
    fields,
    parents,
    parentsInfo,
    siblings: siblingIds.map(brief),
    partnerships,
    events,
    notes: person.notes,
    sources: person.sources,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SheetLabels {
  title: string;
  parents: string;
  parentsRelationship: string;
  siblings: string;
  partnerships: string;
  partner: string;
  children: string;
  events: string;
  notes: string;
  sources: string;
  none: string;
  generated: string;
}

/** The sheet as the inner HTML of a document body (also used inside the app's dialog). */
export function familySheetBody(sheet: FamilySheet, l: SheetLabels): string {
  const people = (ps: SheetPerson[]) =>
    ps.length === 0
      ? `<p class="muted">${esc(l.none)}</p>`
      : `<ul class="people">${ps.map((p) => `<li><span class="name">${esc(p.name)}</span>${p.years ? ` <span class="years">${esc(p.years)}</span>` : ''}${p.detail ? `<br><span class="detail">${esc(p.detail)}</span>` : ''}</li>`).join('')}</ul>`;
  const rows = (rs: SheetRow[]) => (rs.length === 0 ? `<p class="muted">${esc(l.none)}</p>` : `<dl>${rs.map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd>`).join('')}</dl>`);
  return [
    `<div class="head"><p class="kicker">${esc(l.title)}</p><h1>${esc(sheet.name)}</h1>${sheet.years ? `<p class="years">${esc(sheet.years)}</p>` : ''}</div>`,
    `<section>${rows(sheet.fields)}</section>`,
    `<section><h2>${esc(l.parents)}</h2>${people(sheet.parents)}${sheet.parentsInfo ? `<p class="detail">${esc(l.parentsRelationship)}: ${esc(sheet.parentsInfo)}</p>` : ''}</section>`,
    `<section><h2>${esc(l.siblings)}</h2>${people(sheet.siblings)}</section>`,
    `<section><h2>${esc(l.partnerships)}</h2>${
      sheet.partnerships.length === 0
        ? `<p class="muted">${esc(l.none)}</p>`
        : sheet.partnerships.map((u) => `<div class="union"><h3>${esc(l.partner)}</h3>${people(u.partners)}<p class="detail">${esc(u.info)}</p><h3>${esc(l.children)}</h3>${people(u.children)}</div>`).join('')
    }</section>`,
    `<section><h2>${esc(l.events)}</h2>${rows(sheet.events)}</section>`,
    sheet.notes ? `<section><h2>${esc(l.notes)}</h2><p>${esc(sheet.notes).replace(/\n/g, '<br>')}</p></section>` : '',
    sheet.sources ? `<section><h2>${esc(l.sources)}</h2><p>${esc(sheet.sources).replace(/\n/g, '<br>')}</p></section>` : '',
    `<div class="foot"><p class="muted">${esc(l.generated)}</p></div>`,
  ].join('');
}

export const SHEET_CSS = `
body { font-family: "Atkinson Hyperlegible Next", "Segoe UI", system-ui, sans-serif; color: #1B2733; margin: 0; padding: 24px; line-height: 1.45; max-width: 720px; }
.family-sheet .head { border-bottom: 2px solid #1B2733; padding-bottom: 8px; margin-bottom: 16px; }
.family-sheet .kicker { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #4A5A6A; }
.family-sheet h1 { margin: 2px 0 4px; font-size: 24px; }
.family-sheet h2 { font-size: 15px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #6F7C89; }
.family-sheet h3 { font-size: 13px; margin: 8px 0 4px; color: #4A5A6A; text-transform: uppercase; letter-spacing: 0.04em; }
.family-sheet dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
.family-sheet dt { color: #4A5A6A; }
.family-sheet dd { margin: 0; }
.family-sheet ul.people { list-style: none; margin: 0; padding: 0; }
.family-sheet ul.people li { margin: 0 0 6px; }
.family-sheet .name { font-weight: 700; }
.family-sheet .years, .family-sheet .detail, .family-sheet .muted { color: #4A5A6A; font-size: 13px; }
.family-sheet .union { margin: 0 0 12px; padding-left: 10px; border-left: 3px solid #1E6B5A; }
.family-sheet .foot { margin-top: 24px; font-size: 12px; }
@media print { body { padding: 0; } }
`;

/** A complete standalone HTML file. */
export function familySheetHtml(sheet: FamilySheet, l: SheetLabels, lang: string): string {
  return `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(l.title)}: ${esc(sheet.name)}</title><style>${SHEET_CSS}</style></head>
<body><main class="family-sheet">${familySheetBody(sheet, l)}</main></body></html>`;
}
