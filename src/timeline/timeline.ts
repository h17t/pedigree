/**
 * Timeline data: one lifespan bar per person. Start/end come from the birth and death
 * dates; uncertain dates are flagged; people recorded as living get an open bar to today;
 * people with unknown status and no death date get a short faded bar. Nothing is inferred
 * from a missing date.
 */
import type { Person, Project } from '@/model/types';
import { effectiveLifeStatus } from '@/model/types';
import { yearOf } from '@/model/dates';
import { connectedComponents } from '@/model/graph';

export type BarKind = 'closed' | 'living' | 'unknownEnd';

export interface TimelineBar {
  personId: string;
  start: number;
  /** For 'unknownEnd' bars this is an assumed short span (start + 10), drawn faded. */
  end: number;
  kind: BarKind;
  startUncertain: boolean;
  endUncertain: boolean;
  /** Family (cluster) index for grouping, 1-based. */
  family: number;
  tagLabel: string | null;
}

export interface TimelineData {
  bars: TimelineBar[];
  minYear: number;
  maxYear: number;
  /** People without a birth year (cannot be drawn). */
  undated: string[];
}

export function computeTimeline(project: Project, currentYear = new Date().getUTCFullYear()): TimelineData {
  const family = new Map<string, number>();
  connectedComponents(project).forEach((ids, i) => ids.forEach((id) => family.set(id, i + 1)));
  const bars: TimelineBar[] = [];
  const undated: string[] = [];
  for (const p of Object.values(project.persons)) {
    const start = yearOf(p.birth.date);
    if (start === null) {
      undated.push(p.id);
      continue;
    }
    const status = effectiveLifeStatus(p);
    const deathYear = yearOf(p.death.date);
    let kind: BarKind;
    let end: number;
    if (deathYear !== null) {
      kind = 'closed';
      end = Math.max(start, deathYear);
    } else if (status === 'living') {
      kind = 'living';
      end = Math.max(start, currentYear);
    } else {
      kind = 'unknownEnd';
      end = start + 10;
    }
    bars.push({ personId: p.id, start, end, kind, startUncertain: p.birth.qualifier !== 'exact', endUncertain: deathYear !== null && p.death.qualifier !== 'exact', family: family.get(p.id) ?? 1, tagLabel: p.tag?.label ?? null });
  }
  const years = bars.flatMap((b) => [b.start, b.end]);
  const minYear = years.length ? Math.floor(Math.min(...years) / 10) * 10 : currentYear - 100;
  const maxYear = years.length ? Math.ceil(Math.max(...years) / 10) * 10 : currentYear;
  return { bars, minYear, maxYear, undated };
}

export type TimelineSort = 'birth' | 'family';

export function sortBars(bars: TimelineBar[], sort: TimelineSort, project: Project): TimelineBar[] {
  const name = (id: string) => {
    const p: Person | undefined = project.persons[id];
    return p ? `${p.surname} ${p.givenNames}` : '';
  };
  const out = [...bars];
  if (sort === 'family') out.sort((a, b) => a.family - b.family || a.start - b.start || name(a.personId).localeCompare(name(b.personId)));
  else out.sort((a, b) => a.start - b.start || name(a.personId).localeCompare(name(b.personId)));
  return out;
}
