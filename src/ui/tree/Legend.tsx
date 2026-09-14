import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import { cssColor as color, tagColor } from '@/design/tokens';
import { useAppStore } from '@/store/store';

const LINE_ITEMS: { key: string; draw: React.ReactNode }[] = [
  { key: 'marriage', draw: (<><line x1="0" y1="10" x2="48" y2="10" stroke={color.ink} strokeWidth="8" /><line x1="0" y1="10" x2="48" y2="10" stroke={color.paper} strokeWidth="4" /></>) },
  { key: 'divorced', draw: (<><line x1="0" y1="10" x2="48" y2="10" stroke={color.ink} strokeWidth="8" /><line x1="0" y1="10" x2="48" y2="10" stroke={color.paper} strokeWidth="4" /><path d="M14 19 l8 -18 M24 19 l8 -18" stroke={color.ink} strokeWidth="3" strokeLinecap="round" /></>) },
  { key: 'partnership', draw: <line x1="0" y1="10" x2="48" y2="10" stroke={color.ink} strokeWidth="2" strokeDasharray="8 6" /> },
  { key: 'unknownUnion', draw: <line x1="0" y1="10" x2="48" y2="10" stroke={color.ink} strokeWidth="2" /> },
  { key: 'biological', draw: <line x1="0" y1="10" x2="48" y2="10" stroke={color.ink} strokeWidth="2" /> },
  { key: 'adopted', draw: <line x1="0" y1="10" x2="48" y2="10" stroke={color.ink} strokeWidth="2" strokeDasharray="8 6" /> },
  { key: 'step', draw: <line x1="0" y1="10" x2="48" y2="10" stroke={color.ink} strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" /> },
  { key: 'male', draw: <rect x="19" y="5" width="10" height="10" fill={color.ink} /> },
  { key: 'female', draw: <circle cx="24" cy="10" r="5" fill={color.ink} /> },
  { key: 'diverse', draw: <path d="M24 5 l5 5 -5 5 -5 -5 z" fill={color.ink} /> },
  { key: 'warning', draw: <path d="M19 15 l10 0 l-5 -9 z" fill={color.warn} /> },
  { key: 'stripe', draw: (<><rect x="14" y="2" width="20" height="16" rx="2" fill={color.paper} stroke={color.ink} strokeWidth="1.5" /><rect x="15" y="3" width="4" height="14" fill={color.line} /></>) },
];
const TEXT_ITEMS = ['deceased', 'about', 'before', 'after', 'unknownSex', 'truncated'];

/** The legend explains every line style and mark on the canvas in words. */
export function Legend({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const groups = useAppStore((s) => s.project?.groups ?? []);
  return (
    <section className="legend panel" aria-labelledby="legend-title">
      <div className="legend-head">
        <h2 id="legend-title" className="legend-title">{t('tree.legend')}</h2>
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
      <ul className="legend-list">
        {LINE_ITEMS.map((it) => (
          <li key={it.key}>
            <svg width="48" height="20" viewBox="0 0 48 20" aria-hidden="true">
              {it.draw}
            </svg>
            <span>{t(`tree.legendItems.${it.key}` as TKey)}</span>
          </li>
        ))}
        {groups.map((g) => (
          <li key={g.id}>
            <svg width="48" height="20" viewBox="0 0 48 20" aria-hidden="true">
              <rect x="14" y="2" width="20" height="16" rx="2" fill={color.paper} stroke={color.ink} strokeWidth="1.5" />
              <rect x="15" y="3" width="4" height="14" fill={tagColor[g.color]} />
            </svg>
            <span>{g.name || t(`edit.tagColors.${g.color}` as TKey)}</span>
          </li>
        ))}
        {TEXT_ITEMS.map((k) => (
          <li key={k}>
            <span className="legend-spacer" aria-hidden="true" />
            <span>{t(`tree.legendItems.${k}` as TKey)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
