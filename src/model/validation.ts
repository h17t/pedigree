/**
 * Validation produces warnings, never blocks. Each warning has a code, the people it concerns
 * and the parameters the UI needs to phrase it. Messages are translated in the UI layer.
 */
import type { Project } from './types';
import { effectiveLifeStatus, personName } from './types';
import { isRange, ordinalOf, yearsBetween, todayDate } from './dates';
import { breakCycles, buildAdjacency } from './graph';

export type WarningCode =
  | 'childOlderThanParent'
  | 'deathBeforeBirth'
  | 'birthAfterFatherDeath'
  | 'cycle'
  | 'implausibleAge'
  | 'livingTooOld'
  | 'parentTooYoung'
  | 'partnerAge';

export interface ValidationWarning {
  code: WarningCode;
  /** Person ids concerned; the first is the one the warning is attached to. */
  personIds: string[];
  params: Record<string, string>;
}

const MAX_AGE = 115;
const MIN_PARENT_AGE = 13;
const MIN_MARRIAGE_AGE = 12;
const NINE_MONTHS_DAYS = 275;

export function validateProject(project: Project, today = todayDate()): ValidationWarning[] {
  const out: ValidationWarning[] = [];
  const persons = Object.values(project.persons);
  const name = (id: string) => {
    const p = project.persons[id];
    return p ? personName(p) || '?' : '?';
  };

  for (const p of persons) {
    const b = ordinalOf(p.birth, 'start');
    const dEnd = ordinalOf(p.death, 'end');
    const dStart = ordinalOf(p.death, 'start');
    if (b !== null && dEnd !== null && dEnd < b) {
      out.push({ code: 'deathBeforeBirth', personIds: [p.id], params: { name: name(p.id) } });
    }
    if (b !== null && dStart !== null && dStart >= b) {
      const age = yearsBetween(p.birth.date, p.death.date);
      if (age !== null && age > MAX_AGE) out.push({ code: 'implausibleAge', personIds: [p.id], params: { name: name(p.id) } });
    }
    if (effectiveLifeStatus(p) === 'living' && p.birth.date) {
      const age = yearsBetween(p.birth.date, today);
      if (age !== null && age > MAX_AGE) out.push({ code: 'livingTooOld', personIds: [p.id], params: { name: name(p.id) } });
    }
  }

  const { ignoredLinks, affectedPersons } = breakCycles(project);
  for (const id of [...affectedPersons].sort()) {
    out.push({ code: 'cycle', personIds: [id], params: { name: name(id) } });
  }
  const adj = buildAdjacency(project, ignoredLinks);

  for (const link of Object.values(project.childLinks)) {
    if (ignoredLinks.has(link.id)) continue;
    const child = project.persons[link.childId];
    const union = project.unions[link.unionId];
    if (!child || !union) continue;
    const cb = ordinalOf(child.birth, 'start');
    if (cb === null) continue;
    for (const pid of union.partnerIds) {
      const parent = project.persons[pid];
      if (!parent) continue;
      const pb = ordinalOf(parent.birth, 'end');
      const blood = link.relationType !== 'step' && link.relationType !== 'foster' && link.relationType !== 'adopted';
      if (pb !== null && cb < pb && link.relationType !== 'step' && link.relationType !== 'foster') {
        out.push({ code: 'childOlderThanParent', personIds: [child.id, parent.id], params: { child: name(child.id), parent: name(parent.id) } });
      } else if (pb !== null && blood) {
        // The latest possible birth of the parent, so a range never causes a false alarm.
        const latest = isRange(parent.birth.qualifier) && parent.birth.dateEnd ? parent.birth.dateEnd : parent.birth.date;
        const age = yearsBetween(latest, child.birth.date);
        if (age !== null && age < MIN_PARENT_AGE) out.push({ code: 'parentTooYoung', personIds: [parent.id, child.id], params: { parent: name(parent.id), child: name(child.id) } });
      }
      const pd = ordinalOf(parent.death, 'end');
      if (pd !== null && parent.sex === 'male' && link.relationType === 'biological' && cb - pd > NINE_MONTHS_DAYS) {
        out.push({ code: 'birthAfterFatherDeath', personIds: [child.id, parent.id], params: { child: name(child.id), father: name(parent.id) } });
      }
    }
  }

  for (const u of Object.values(project.unions)) {
    if (!u.marriageDate) continue;
    for (const pid of u.partnerIds) {
      const p = project.persons[pid];
      if (!p?.birth.date) continue;
      const age = yearsBetween(p.birth.date, u.marriageDate);
      if (age !== null && age < MIN_MARRIAGE_AGE) out.push({ code: 'partnerAge', personIds: [pid], params: { name: name(pid) } });
    }
  }
  void adj;
  return out;
}
