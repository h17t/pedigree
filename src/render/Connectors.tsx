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
            <g key={c.linkId}>
              <path d={c.d} stroke={background} strokeWidth={6} />
              <path
                d={c.d}
                stroke={c.style === 'unknown' ? color.rule : color.ink}
                strokeWidth={2}
                strokeDasharray={c.style === 'adopted' ? '8 6' : c.style === 'step' ? '2 5' : undefined}
                strokeLinecap={c.style === 'step' ? 'round' : 'butt'}
              />
            </g>
          ))}
          {u.partnerLine && (u.partnerLine.style === 'marriage' || u.partnerLine.style === 'divorced') && (
            <>
              <path d={u.partnerLine.d} stroke={color.ink} strokeWidth={8} />
              <path d={u.partnerLine.d} stroke={background} strokeWidth={4} />
            </>
          )}
          {u.partnerLine && u.partnerLine.style === 'dashed' && <path d={u.partnerLine.d} stroke={color.ink} strokeWidth={2} strokeDasharray="8 6" />}
          {u.partnerLine && u.partnerLine.style === 'plain' && <path d={u.partnerLine.d} stroke={color.ink} strokeWidth={2} />}
          {u.partnerLine?.strike && (
            // Divorced: two clear strokes through the junction, the one spot between the cards.
            <g className="divorce-mark">
              <path d={`M${u.partnerLine.strike.x - 10} ${u.partnerLine.strike.y + 13} l8 -26 M${u.partnerLine.strike.x + 2} ${u.partnerLine.strike.y + 13} l8 -26`} stroke={background} strokeWidth={7} strokeLinecap="round" />
              <path d={`M${u.partnerLine.strike.x - 10} ${u.partnerLine.strike.y + 13} l8 -26 M${u.partnerLine.strike.x + 2} ${u.partnerLine.strike.y + 13} l8 -26`} stroke={color.ink} strokeWidth={3} strokeLinecap="round" />
            </g>
          )}
        </g>
      ))}
    </g>
  );
});
