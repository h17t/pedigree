import { memo } from 'react';
import { color } from '@/design/tokens';
import type { UnionGeometry } from './connectors';

/**
 * Draws partner and child lines. A double line is drawn as a wide ink stroke with a narrower
 * background-coloured stroke on top, which works for any orthogonal path.
 */
export const Connectors = memo(function Connectors({ unions, background = color.ground }: { unions: UnionGeometry[]; background?: string }) {
  return (
    <g className="connectors" fill="none" strokeLinejoin="round" strokeLinecap="butt" aria-hidden="true">
      {unions.map((u) => (
        <g key={u.unionId}>
          {u.childLines.map((c) => (
            <path
              key={c.linkId}
              d={c.d}
              stroke={c.style === 'unknown' ? color.rule : color.ink}
              strokeWidth={2}
              strokeDasharray={c.style === 'adopted' ? '8 6' : c.style === 'step' ? '2 5' : undefined}
              strokeLinecap={c.style === 'step' ? 'round' : 'butt'}
            />
          ))}
          {u.partnerLine && (u.partnerLine.style === 'marriage' || u.partnerLine.style === 'divorced') && (
            <>
              <path d={u.partnerLine.d} stroke={color.ink} strokeWidth={8} />
              <path d={u.partnerLine.d} stroke={background} strokeWidth={4} />
            </>
          )}
          {u.partnerLine && u.partnerLine.style === 'dashed' && <path d={u.partnerLine.d} stroke={color.ink} strokeWidth={2} strokeDasharray="8 6" />}
          {u.partnerLine && u.partnerLine.style === 'plain' && <path d={u.partnerLine.d} stroke={color.ink} strokeWidth={2} />}
          {u.partnerLine?.strike && <path d={`M${u.partnerLine.strike.x - 24 - 7} ${u.partnerLine.strike.y + 9} l14 -18`} stroke={color.ink} strokeWidth={2.5} />}
        </g>
      ))}
    </g>
  );
});
