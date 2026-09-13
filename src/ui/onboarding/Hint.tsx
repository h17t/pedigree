import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import { useHints } from '@/onboarding/hints';
import type { HintId } from '@/onboarding/hints';

/**
 * One contextual tip, shown only while it is the active hint. Rendered next to the control
 * it talks about; dismissing it is remembered on this device.
 */
export function Hint({ id, className = '' }: { id: HintId; className?: string }) {
  const { t } = useT();
  const active = useHints((s) => s.active);
  const dismiss = useHints((s) => s.dismiss);
  if (active !== id) return null;
  return (
    <div className={`hint-callout ${className}`.trim()} role="note" aria-label={t('hints.label')}>
      <div className="hint-callout-text">
        <span className="hint-callout-title">{t(`hints.${id}.title` as TKey)}</span>
        <span>{t(`hints.${id}.body` as TKey)}</span>
      </div>
      <button type="button" className="btn btn-quiet" onClick={() => dismiss(id)}>
        {t('hints.dismiss')}
      </button>
    </div>
  );
}
