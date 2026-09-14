/**
 * Packing of disconnected components ("clusters"): a row when few, a grid when many, sorted by
 * size descending, separated by a gutter. Also computes cluster frames from actual positions
 * for the boundary labels on the canvas.
 */
import type { Position, Project } from '@/model/types';
import { card, layout } from '@/design/tokens';
import { connectedComponents } from '@/model/graph';
import type { Box, DetailLevel } from '../geometry';
import { cardHeight } from '../geometry';

export interface ClusterFrame {
  index: number;
  personIds: string[];
  box: Box;
}

const PAD = 40;

/** Arrange boxes (w,h) into a row or grid; returns the offset of each box. */
export function packBoxes(sizes: { w: number; h: number }[], gutter: number = layout.clusterGutter): Position[] {
  const n = sizes.length;
  if (n === 0) return [];
  const columns = n <= 4 ? n : Math.ceil(Math.sqrt(n));
  const offsets: Position[] = [];
  let y = 0;
  for (let rowStart = 0; rowStart < n; rowStart += columns) {
    const row = sizes.slice(rowStart, rowStart + columns);
    let x = 0;
    let rowH = 0;
    for (const s of row) {
      offsets.push({ x, y });
      x += s.w + gutter;
      rowH = Math.max(rowH, s.h);
    }
    y += rowH + gutter;
  }
  return offsets;
}

/** Cluster frames from the current (effective) positions, largest first. */
export function clusterFrames(project: Project, positions: Map<string, Position>, level: DetailLevel, scales: Map<string, number> = new Map()): ClusterFrame[] {
  const h = cardHeight(level);
  return connectedComponents(project)
    .map((ids, i) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const id of ids) {
        const p = positions.get(id);
        if (!p) continue;
        const sc = scales.get(id) ?? 1;
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + card.width * sc);
        maxY = Math.max(maxY, p.y + h * sc);
      }
      if (!Number.isFinite(minX)) return null;
      return { index: i + 1, personIds: ids, box: { x: minX - PAD, y: minY - PAD - 32, w: maxX - minX + 2 * PAD, h: maxY - minY + 2 * PAD + 32 } };
    })
    .filter((f): f is ClusterFrame => f !== null);
}
