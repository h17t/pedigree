import { describe, expect, it } from 'vitest';
import { rowScales, personScales, minScaleOf, MIN_SCALE } from '@/render/layout/scale';
import { layoutComponent } from '@/render/layout/generational';
import { layoutAll } from '@/render/layout';
import { card } from '@/design/tokens';
import { cardHeight } from '@/render/geometry';
import { migrateProject } from '@/model/schema';
import { build, born } from './fixtures';
import type { Person, Project } from '@/model/types';

/** A pure ancestor chart: `gens` generations above one person, every ancestor pair recorded. */
function ancestorChart(gens: number): { project: Project; self: Person } {
  const b = build();
  const self = b.person('Self', born('1990'));
  let current: Person[] = [self];
  for (let g = 1; g <= gens; g++) {
    const next: Person[] = [];
    for (const c of current) {
      const f = b.person(`F${g}`, born(String(1990 - 30 * g)));
      const m = b.person(`M${g}`, born(String(1992 - 30 * g)));
      b.family([f, m], [c]);
      next.push(f, m);
    }
    current = next;
  }
  return { project: b.project, self };
}

describe('rowScales', () => {
  it('is 1 everywhere when off or when rows are of similar size', () => {
    expect(rowScales([20, 10, 6, 2], 'off')).toEqual([1, 1, 1, 1]);
    expect(rowScales([6, 7, 8], 'gentle')).toEqual([1, 1, 7 / 8]);
    expect(rowScales([], 'strong')).toEqual([]);
  });
  it('shrinks only the crowded rows, never below the minimum, and leaves the median row alone', () => {
    // 16, 8, 4, 2, 1: target = max(0.6 * 16, median 4) = 9.6
    expect(rowScales([16, 8, 4, 2, 1], 'gentle').map((s) => Math.round(s * 100) / 100)).toEqual([0.6, 1, 1, 1, 1]);
    // strong: target = max(0.35 * 16, 4) = 5.6
    expect(rowScales([16, 8, 4, 2, 1], 'strong').map((s) => Math.round(s * 100) / 100)).toEqual([0.35, 0.7, 1, 1, 1]);
    const g = rowScales([20, 10, 6, 2], 'gentle');
    expect(g[0]).toBeCloseTo(MIN_SCALE.gentle);
    expect(g.slice(1)).toEqual([1, 1, 1]);
  });
});

describe('personScales and layout with scaling', () => {
  it('assigns the row scale to every person of the family and 1 to unconnected people', () => {
    const { project } = ancestorChart(4); // rows: 16, 8, 4, 2, 1
    const scales = personScales(project, 'strong');
    const counts = new Map<number, number>();
    for (const s of scales.values()) counts.set(s, (counts.get(s) ?? 0) + 1);
    expect(counts.get(MIN_SCALE.strong)).toBe(16);
    expect(counts.get(0.7)).toBe(8);
    expect(counts.get(1)).toBe(7);
    expect(minScaleOf(scales, Object.keys(project.persons))).toBe(MIN_SCALE.strong);
    expect(personScales(project, 'off').size).toBe(0);
  });

  it('lays out scaled rows without overlaps, narrower than at full size, with row heights that follow the scale', () => {
    const { project } = ancestorChart(4);
    const ids = Object.keys(project.persons);
    const full = layoutComponent(project, ids, 'standard');
    const strong = layoutComponent(project, ids, 'standard', undefined, 'strong');
    expect(strong.width).toBeLessThan(full.width * 0.6);
    const scales = personScales(project, 'strong');
    const h = cardHeight('standard');
    const boxes = ids.map((id) => {
      const p = strong.positions.get(id)!;
      const s = scales.get(id) ?? 1;
      return { id, x: p.x, y: p.y, w: card.width * s, h: h * s };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
    // The oldest row (scale 0.35) is followed by a row that starts after its scaled height.
    const rowYs = [...new Set(boxes.map((b) => b.y))].sort((a, b) => a - b);
    expect(rowYs[1]! - rowYs[0]!).toBeLessThan(h);
    expect(rowYs[4]! - rowYs[3]!).toBeGreaterThanOrEqual(h);
    // The single descendant sits under the middle part of the drawing: the ancestor couples are
    // placed above their child in turn, shifted sideways only as far as the row above needs.
    const self = boxes.find((b) => b.id === Object.values(project.persons).find((p) => p.givenNames === 'Self')!.id)!;
    expect(Math.abs(self.x + self.w / 2 - strong.width / 2)).toBeLessThan(strong.width / 4);
    const parents = boxes.filter((b) => ['F1', 'M1'].includes(project.persons[b.id]!.givenNames));
    expect(Math.abs((parents[0]!.x + parents[1]!.x + card.width) / 2 - (self.x + self.w / 2))).toBeLessThan(2);
  });

  it('layoutAll reads the mode from the tree settings and the schema fills in "off"', () => {
    const { project } = ancestorChart(3);
    const off = layoutAll(project, 'standard');
    const withSetting: Project = { ...project, settings: { ...project.settings, generationScaling: 'gentle' } };
    const gentle = layoutAll(withSetting, 'standard');
    const width = (m: Map<string, { x: number }>) => Math.max(...[...m.values()].map((p) => p.x));
    expect(width(gentle)).toBeLessThan(width(off));
    const migrated = migrateProject({ ...project, settings: { preserveRawGedcom: true } });
    expect(migrated.ok && migrated.project.settings.generationScaling).toBe('off');
    const bad = migrateProject({ ...project, settings: { preserveRawGedcom: true, generationScaling: 'huge' } });
    expect(bad.ok && bad.project.settings.generationScaling).toBe('off');
  });
});
