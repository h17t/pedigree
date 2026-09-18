import { memo, useMemo } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { card, tagColor, tagPattern } from '@/design/tokens';
import { usePalette } from './palette';
import type { TagColor } from '@/design/tokens';
import { tintFor } from '@/design/tint';
import type { CardAppearance, Person } from '@/model/types';
import { defaultCardAppearance } from '@/model/types';

/** One shared object, so a card that is not given the setting still compares equal between renders. */
const DEFAULT_CARDS = defaultCardAppearance();
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
  /** Zoomed far out: keep the box, draw only name and years. */
  sparse?: boolean;
  /** "Balance generations": the card is drawn at this fraction of its size. */
  scale?: number;
  /** The person's colour group (stripe + name), resolved by the caller. */
  group?: { name: string; color: TagColor } | null;
  /** What the card shows and how it is coloured; the tree's setting. */
  cards?: CardAppearance;
  /** Derive the tint for the dark palette; paper output is always light. */
  dark?: boolean;
  /** Accessible name for the card ("Name, years"). */
  ariaLabel: string;
  labels: { née: string; living: string; unknownDate: string; warning: string; private: string };
  /** Changes when a web font finished loading, so the text is measured again. */
  textVersion?: number;
  onPointerDown?: (e: PointerEvent<SVGGElement>, id: string) => void;
  onSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
}

/**
 * One person card. Fixed width, one of four fixed heights; text is truncated, never grows.
 * Deceased: † plus a slate border. Sex: square/circle/diamond marker. Branch tag: stripe +
 * label. Rendered identically on screen and in print (only the detail level differs).
 */
export const PersonCard = memo(function PersonCard({ person, x, y, level, locale, selected, provisional = false, hasWarning, print = false, blackAndWhite = false, sparse = false, scale = 1, group = null, cards = DEFAULT_CARDS, dark = false, ariaLabel, labels, textVersion = 0, onPointerDown, onSelect, onOpen }: PersonCardProps) {
  const color = usePalette();
  const h = cardHeight(level, print);
  const w = card.width;
  const textLevel: DetailLevel = sparse ? 'minimal' : level;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- textVersion only invalidates the measurement
  const text = useMemo(() => cardText(person, textLevel, locale, print, labels, cards), [person, textLevel, locale, print, labels, cards, textVersion]);
  const border = text.deceased ? color.slate : color.ink;
  // Black and white has no colour to spend: the marker alone says which sex was recorded.
  const picked = cards.sexTint && !blackAndWhite && person.sex !== 'unknown' ? cards.tints[person.sex] : null;
  const fill = picked ? tintFor(picked, dark) : color.paper;
  const stripe = group ? (blackAndWhite ? `url(#pat-${tagPattern[group.color]})` : tagColor[group.color]) : null;
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
      transform={scale === 1 ? `translate(${x} ${y})` : `translate(${x} ${y}) scale(${scale})`}
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
      <rect x={card.border / 2} y={card.border / 2} width={w - card.border} height={h - card.border} rx={card.radius} fill={fill} stroke={border} strokeWidth={card.border} strokeDasharray={provisional ? '4 3' : undefined} />
      {stripe && <rect x={card.border} y={card.border} width={card.stripeWidth} height={h - card.border * 2} fill={stripe} />}
      {stripe && group && cards.groupName && (
        <text x={w - card.padding.right - card.marker - 8} y={card.padding.top + 11} fontSize={12} fontWeight={500} fill={color.slate} textAnchor="end">
          {group.name}
        </text>
      )}
      {cards.sexMarker && <SexMarker sex={person.sex} x={w - card.padding.right - card.marker} y={card.padding.top} />}
      {person.isPrivate && (
        <g aria-label={labels.private} role="img" transform={`translate(${left} ${h - card.padding.bottom - 9})`}>
          <rect x={0} y={4} width={9} height={6} rx={1} fill={color.slate} />
          <path d="M2 4 V2.5 A2.5 2.5 0 0 1 7 2.5 V4" fill="none" stroke={color.slate} strokeWidth={1.4} />
        </g>
      )}
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
  const c = usePalette().ink;
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
