import { memo } from 'react';
import { unknownParentsBox } from './geometry';
import { usePalette } from './palette';

/** The junction on a partner line, or the labelled "Parents unknown" box for a zero-partner union. */
export const UnionNode = memo(function UnionNode({ cx, cy, unknownParents, label }: { cx: number; cy: number; unknownParents: boolean; label: string }) {
  const color = usePalette();
  if (unknownParents) {
    const { w, h } = unknownParentsBox;
    return (
      <g transform={`translate(${cx - w / 2} ${cy - h / 2})`} role="img" aria-label={label}>
        <rect width={w} height={h} rx={6} fill={color.paper} stroke={color.slate} strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={w / 2} y={h / 2 + 5} fontSize={15} fontWeight={500} fill={color.slate} textAnchor="middle">
          {label}
        </text>
      </g>
    );
  }
  // No marker on ordinary junctions: the lines themselves say everything.
  void cx;
  void cy;
  return null;
});
