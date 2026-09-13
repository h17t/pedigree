import { useStatus } from '../status';
import { useT } from '@/i18n';

/** Persistent, dismissible messages announced politely. */
export function StatusMessages() {
  const messages = useStatus((s) => s.messages);
  const dismiss = useStatus((s) => s.dismiss);
  const { t } = useT();
  return (
    <div className="status-region" role="status" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} className={`notice notice-${m.kind === 'info' ? 'info' : m.kind}`}>
          <p>{m.text}</p>
          <div className="btn-row btn-row-end">
            <button type="button" className="btn btn-quiet" onClick={() => dismiss(m.id)}>
              {t('common.dismiss')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
