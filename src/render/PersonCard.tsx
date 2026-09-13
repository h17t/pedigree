import { memo, useMemo } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { card, color, tagColor, tagPattern } from '@/design/tokens';
import type { Person } from '@/model/types';
import { cardHeight, cardText } from './geometry';
import type { DetailLevel } from './geometry';
import type { Locale } from '@/i18n';

export interface PersonCardProps {
  person: Person;
  x: number;
  y: number;
  level: DetailLevel;
  locale: Locale;
  selected: boolean;
  /** Position not stored yet: dotted outline. */
  provisional?: boolean;
  hasWarning: boolean;
  print?: boolean;
  blackAndWhite?: boolean;
  /** Accessible name for the card ("Name, years"). */
  ariaLabel: string;
  labels: { née: string; living: string; unknownDate: string; warning: string };
  onPointerDown?: (e: PointerEvent<SVGGElement>, id: string) => void;
  onSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
}

/**
 * One person card. Fixed width, one of four fixed heights; text is truncated, never grows.
 * Deceased: † plus a slate border. Sex: square/circle/diamond marker. Branch tag: stripe +
 * label. Rendered identically on screen and in print (only the detail level differs).
 */
export const PersonCard = memo(function PersonCard({ person, x, y, level, locale, selected, provisional = false, hasWarning, print = false, blackAndWhite = false, ariaLabel, labels, onPointerDown, onSelect, onOpen }: PersonCardProps) {
  const h = cardHeight(level, print);
  const w = card.width;
  const text = useMemo(() => cardText(person, level, locale, print, labels), [person, level, locale, print, labels]);
  const border = text.deceased ? color.slate : color.ink;
  const stripe = person.tag ? (blackAndWhite ? `url(#pat-${tagPattern[person.tag.color]})` : tagColor[person.tag.color]) : null;
  const left = card.padding.left + card.stripeWidth;
  const nameTop = card.padding.top + card.name.line - 5;
  const secondaryTop = card.padding.top + card.name.line * card.name.maxLines + card.secondary.line - 5;
  const notesTop = secondaryTop + text.lines.length * card.secondary.line + 4 + card.notes.line - 4;

  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.key === 'Enter' && e.shiftKey) onOpen?.(person.id);
      else onSelect?.(person.id);
    }
  };

  return (
    <g
      className={`person-card${selected ? ' person-card-selected' : ''}`}
      transform={`translate(${x} ${y})`}
      tabIndex={print ? undefined : 0}
      role={print ? undefined : 'button'}
      aria-label={ariaLabel}
      aria-pressed={print ? undefined : selected}
      data-person-id={person.id}
      onPointerDown={onPointerDown ? (e) => onPointerDown(e, person.id) : undefined}
      onKeyDown={print ? undefined : onKey}
      onDoubleClick={onOpen ? () => onOpen(person.id) : undefined}
    >
      {!print && <title>{ariaLabel}</title>}
      {selected && <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={card.radius + 3} fill={color.selectBg} stroke={color.select} strokeWidth={3} />}
      <rect x={card.border / 2} y={card.border / 2} width={w - card.border} height={h - card.border} rx={card.radius} fill={color.paper} stroke={border} strokeWidth={card.border} strokeDasharray={provisional ? '4 3' : undefined} />
      {stripe && <rect x={card.border} y={card.border} width={card.stripeWidth} height={h - card.border * 2} fill={stripe} />}
      {stripe && person.tag && (
        <text x={w - card.padding.right - card.marker - 8} y={card.padding.top + 11} fontSize={12} fontWeight={500} fill={color.slate} textAnchor="end">
          {person.tag.label}
        </text>
      )}
      <SexMarker sex={person.sex} x={w - card.padding.right - card.marker} y={card.padding.top} />
      {hasWarning && (
        <g aria-label={labels.warning} role="img">
          <path d={`M${w - card.padding.right - card.marker - 2} ${h - card.padding.bottom} l-10 0 l5 -9 z`} fill={color.warn} />
        </g>
      )}
      <text fontSize={card.name.size} fontWeight={card.name.weight} fill={color.ink}>
        {text.nameLines.map((line, i) => (
          <tspan key={i} x={left} y={nameTop + i * card.name.line}>
            {line}
          </tspan>
        ))}
      </text>
      <text fontSize={card.secondary.size} fontWeight={card.secondary.weight} fill={color.slate} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {text.lines.map((line, i) => (
          <tspan key={i} x={left} y={secondaryTop + i * card.secondary.line}>
            {line}
          </tspan>
        ))}
      </text>
      {text.noteLines.length > 0 && (
        <>
          <line x1={left} x2={w - card.padding.right} y1={notesTop - card.notes.line + 2} y2={notesTop - card.notes.line + 2} stroke={color.rule} strokeWidth={1} />
          <text fontSize={card.notes.size} fontWeight={card.notes.weight} fill={color.ink}>
            {text.noteLines.map((line, i) => (
              <tspan key={i} x={left} y={notesTop + i * card.notes.line}>
                {line}
              </tspan>
            ))}
          </text>
        </>
      )}
    </g>
  );
});

/** Pedigree-chart convention: square = male, circle = female, diamond = diverse, none = unknown. */
export function SexMarker({ sex, x, y, size = card.marker }: { sex: Person['sex']; x: number; y: number; size?: number }) {
  const c = color.ink;
  switch (sex) {
    case 'male':
      return <rect x={x} y={y} width={size} height={size} fill={c} />;
    case 'female':
      return <circle cx={x + size / 2} cy={y + size / 2} r={size / 2} fill={c} />;
    case 'diverse':
      return <path d={`M${x + size / 2} ${y} l${size / 2} ${size / 2} l-${size / 2} ${size / 2} l-${size / 2} -${size / 2} z`} fill={c} />;
    default:
      return null;
  }
}
